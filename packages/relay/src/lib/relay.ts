/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import dotenv from 'dotenv';
import findConfig from 'find-config';
dotenv.config({ path: findConfig('.env') || '' });
import { Relay, Eth, Net, Web3, Subs } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { Poller } from './poller';
import { SubscriptionController } from './subscriptionController';
import { Client } from '@hashgraph/sdk';
import { Logger } from 'pino';
import { ClientCache, MirrorNodeClient } from './clients';
import { Gauge, Registry } from 'prom-client';
import HAPIService from './services/hapiService/hapiService';
import constants from './constants';
import HbarLimit from './hbarlimiter';
import { prepend0x } from '../formatters';

export class RelayImpl implements Relay {
  private readonly clientMain: Client;
  private readonly mirrorNodeClient: MirrorNodeClient;
  private readonly web3Impl: Web3;
  private readonly netImpl: Net;
  private readonly ethImpl: Eth;
  private readonly subImpl?: Subs;
  private readonly clientCache: ClientCache;

  constructor(logger: Logger, register: Registry, cache : ClientCache) {
    logger.info('Configurations successfully loaded');

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();

    const configuredChainId =
      process.env.CHAIN_ID || constants.CHAIN_IDS[hederaNetwork] || '298';
    const chainId = prepend0x(Number(configuredChainId).toString(16));

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, register);

    if(cache != undefined) {
        this.clientCache = cache;
    } else {
        this.clientCache = new ClientCache(logger.child({ name: 'client-cache' }), register);
    }

    const hapiService = new HAPIService(logger, register, hbarLimiter, this.clientCache);
    this.clientMain = hapiService.getMainClientInstance();

    this.web3Impl = new Web3Impl(this.clientMain);
    this.netImpl = new NetImpl(this.clientMain, chainId);

    this.mirrorNodeClient = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      register,
      this.clientCache,
      undefined,
      process.env.MIRROR_NODE_URL_WEB3 || process.env.MIRROR_NODE_URL || ''
    );

    this.ethImpl = new EthImpl(
      hapiService,
      this.mirrorNodeClient,
      logger.child({ name: 'relay-eth' }),
      chainId,
      register,
      this.clientCache);

    if (process.env.SUBSCRIPTIONS_ENABLED && process.env.SUBSCRIPTIONS_ENABLED === 'true') {
      const poller = new Poller(this.ethImpl, logger.child({ name: `poller` }), register);
      this.subImpl = new SubscriptionController(poller, logger.child({ name: `subscr-ctrl` }), register);
    }

    this.initOperatorMetric(this.clientMain, this.mirrorNodeClient, logger, register);
    logger.info('Relay running with chainId=%s', chainId);
  }

  /**
 * Initialize operator account metrics
 * @param {Client} clientMain
 * @param {MirrorNodeClient} mirrorNodeClient
 * @param {Logger} logger
 * @param {Registry} register
 * @returns {Gauge} Operator Metric
 */
  private initOperatorMetric(clientMain: Client, mirrorNodeClient: MirrorNodeClient, logger: Logger, register: Registry) {
    const metricGaugeName = 'rpc_relay_operator_balance';
    register.removeSingleMetric(metricGaugeName);
    return new Gauge({
        name: metricGaugeName,
        help: 'Relay operator balance gauge',
        labelNames: ['mode', 'type', 'accountId'],
        registers: [register],
        async collect() {
            // Invoked when the registry collects its metrics' values.
            // Allows for updated account balance tracking
            try {
                const account = await mirrorNodeClient.getAccount(clientMain.operatorAccountId!.toString());
                const accountBalance = account.balance?.balance;
                this.labels({ 'accountId': clientMain.operatorAccountId?.toString() })
                    .set(accountBalance);
            } catch (e: any) {
                logger.error(e, `Error collecting operator balance. Skipping balance set`);
            }
        },
    });
  }

  web3(): Web3 {
    return this.web3Impl;
  }

  net(): Net {
    return this.netImpl;
  }

  eth(): Eth {
    return this.ethImpl;
  }

  subs(): Subs | undefined {
    return this.subImpl;
  }

  mirrorClient(): MirrorNodeClient {
    return this.mirrorNodeClient;
  }
}
