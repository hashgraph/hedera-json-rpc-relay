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
import { Relay, Eth, Net, Web3, Subs } from '../index';
import { Web3Impl } from './web3';
import { NetImpl } from './net';
import { EthImpl } from './eth';
import { Poller } from './poller';
import { SubscriptionController } from './subscriptionController';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { Logger } from 'pino';
import { MirrorNodeClient, SDKClient } from './clients';
import { Registry } from 'prom-client';
import ClientService from './services/clientService';

export class RelayImpl implements Relay {
  private static chainIds = {
    mainnet: 0x127,
    testnet: 0x128,
    previewnet: 0x129,
  };

  private readonly clientMain: Client;
  private readonly mirrorNodeClient: MirrorNodeClient;
  private readonly web3Impl: Web3;
  private readonly netImpl: Net;
  private readonly ethImpl: Eth;
  private readonly subImpl?: Subs;

  constructor(logger: Logger, register: Registry) {
    dotenv.config({ path: findConfig('.env') || '' });
    logger.info('Configurations successfully loaded');

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();

    const configuredChainId =
      process.env.CHAIN_ID || RelayImpl.chainIds[hederaNetwork] || '298';
    const chainId = EthImpl.prepend0x(Number(configuredChainId).toString(16));
    const clientService = new ClientService(logger, register);
    this.clientMain = clientService.getClient();

    this.web3Impl = new Web3Impl(this.clientMain);
    this.netImpl = new NetImpl(this.clientMain, chainId);

    this.mirrorNodeClient = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      register,
      undefined,
      process.env.MIRROR_NODE_URL_WEB3 || process.env.MIRROR_NODE_URL || '',
    );

    this.ethImpl = new EthImpl(
      clientService,
      this.mirrorNodeClient,
      logger.child({ name: 'relay-eth' }),
      chainId);

    if (process.env.SUBSCRIPTIONS_ENABLED && process.env.SUBSCRIPTIONS_ENABLED === 'true') {
      const poller = new Poller(this.ethImpl, logger, register);
      this.subImpl = new SubscriptionController(poller, logger, register);
    }

    logger.info('Relay running with chainId=%s', chainId);
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
