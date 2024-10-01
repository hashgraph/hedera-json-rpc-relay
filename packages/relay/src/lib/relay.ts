/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import { Logger } from 'pino';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { Poller } from './poller';
import { Web3Impl } from './web3';
import EventEmitter from 'events';
import constants from './constants';
import HbarLimit from './hbarlimiter';
import { Client } from '@hashgraph/sdk';
import { prepend0x } from '../formatters';
import { MirrorNodeClient } from './clients';
import { Gauge, Registry } from 'prom-client';
import { Relay, Eth, Net, Web3, Subs } from '../index';
import HAPIService from './services/hapiService/hapiService';
import { SubscriptionController } from './subscriptionController';
import MetricService from './services/metricService/metricService';
import { CacheService } from './services/cacheService/cacheService';

export class RelayImpl implements Relay {
  /**
   * @private
   * @readonly
   * @property {Client} clientMain - The primary Hedera client used for interacting with the Hedera network.
   */
  private readonly clientMain: Client;

  /**
   * @private
   * @readonly
   * @property {MirrorNodeClient} mirrorNodeClient - The client used to interact with the Hedera Mirror Node for retrieving historical data.
   */
  private readonly mirrorNodeClient: MirrorNodeClient;

  /**
   * @private
   * @readonly
   * @property {Web3} web3Impl - The Web3 implementation used for Ethereum-compatible interactions.
   */
  private readonly web3Impl: Web3;

  /**
   * @private
   * @readonly
   * @property {Net} netImpl - The Net implementation used for handling network-related Ethereum JSON-RPC requests.
   */
  private readonly netImpl: Net;

  /**
   * @private
   * @readonly
   * @property {Eth} ethImpl - The Eth implementation used for handling Ethereum-specific JSON-RPC requests.
   */
  private readonly ethImpl: Eth;

  /**
   * @private
   * @readonly
   * @property {Subs} [subImpl] - An optional implementation for handling subscription-related JSON-RPC requests.
   */
  private readonly subImpl?: Subs;

  /**
   * @private
   * @readonly
   * @property {CacheService} cacheService - The service responsible for caching data to improve performance.
   */
  private readonly cacheService: CacheService;

  /**
   * @private
   * @readonly
   * @property {MetricService} metricService - The service responsible for capturing and reporting metrics.
   */
  private readonly metricService: MetricService;

  /**
   * An instance of EventEmitter used for emitting and handling events within the class.
   *
   * @private
   * @readonly
   * @type {EventEmitter}
   */
  private readonly eventEmitter: EventEmitter;

  /**
   * Initializes the main components of the relay service, including Hedera network clients,
   * Ethereum-compatible interfaces, caching, metrics, and subscription management.
   *
   * @param {Logger} logger - Logger instance for logging system messages.
   * @param {Registry} register - Registry instance for registering metrics.
   */
  constructor(logger: Logger, register: Registry) {
    logger.info('Configurations successfully loaded');

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();
    const configuredChainId = process.env.CHAIN_ID || constants.CHAIN_IDS[hederaNetwork] || '298';
    const chainId = prepend0x(Number(configuredChainId).toString(16));

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TOTAL.toNumber();
    const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, register);

    this.eventEmitter = new EventEmitter();
    this.cacheService = new CacheService(logger.child({ name: 'cache-service' }), register);
    const hapiService = new HAPIService(logger, register, hbarLimiter, this.cacheService, this.eventEmitter);
    this.clientMain = hapiService.getMainClientInstance();

    this.web3Impl = new Web3Impl(this.clientMain);
    this.netImpl = new NetImpl(this.clientMain);

    this.mirrorNodeClient = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      register,
      this.cacheService,
      undefined,
      process.env.MIRROR_NODE_URL_WEB3 || process.env.MIRROR_NODE_URL || '',
    );

    this.metricService = new MetricService(
      logger,
      hapiService.getSDKClient(),
      this.mirrorNodeClient,
      hbarLimiter,
      register,
      this.eventEmitter,
    );

    this.ethImpl = new EthImpl(
      hapiService,
      this.mirrorNodeClient,
      logger.child({ name: 'relay-eth' }),
      chainId,
      register,
      this.cacheService,
    );

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
  private initOperatorMetric(
    clientMain: Client,
    mirrorNodeClient: MirrorNodeClient,
    logger: Logger,
    register: Registry,
  ) {
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
          this.labels({ accountId: clientMain.operatorAccountId?.toString() }).set(accountBalance);
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
