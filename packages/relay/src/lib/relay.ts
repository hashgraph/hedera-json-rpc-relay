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
import { Utils } from '../utils';
import { Poller } from './poller';
import { Web3Impl } from './web3';
import EventEmitter from 'events';
import constants from './constants';
import { Client, Hbar } from '@hashgraph/sdk';
import { RequestDetails } from './types';
import { prepend0x } from '../formatters';
import { MirrorNodeClient } from './clients';
import { Gauge, Registry } from 'prom-client';
import { Eth, Net, Relay, Subs, Web3 } from '../index';
import HAPIService from './services/hapiService/hapiService';
import { HbarLimitService } from './services/hbarLimitService';
import { SubscriptionController } from './subscriptionController';
import MetricService from './services/metricService/metricService';
import { CacheService } from './services/cacheService/cacheService';
import { HbarSpendingPlanConfigService } from './config/hbarSpendingPlanConfigService';
import { HbarSpendingPlanRepository } from './db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from './db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from './db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';

dotenv.config({ path: findConfig('.env') || '' });

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
   * @property {HbarSpendingPlanConfigService} hbarSpendingPlanConfigService - The service responsible for managing HBAR spending plans.
   */
  private readonly hbarSpendingPlanConfigService: HbarSpendingPlanConfigService;

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
  constructor(
    private readonly logger: Logger,
    register: Registry,
  ) {
    logger.info('Configurations successfully loaded');

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();
    const configuredChainId = process.env.CHAIN_ID || constants.CHAIN_IDS[hederaNetwork] || '298';
    const chainId = prepend0x(Number(configuredChainId).toString(16));

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TOTAL;

    this.eventEmitter = new EventEmitter();
    this.cacheService = new CacheService(logger.child({ name: 'cache-service' }), register);

    const hbarSpendingPlanRepository = new HbarSpendingPlanRepository(
      this.cacheService,
      logger.child({ name: 'hbar-spending-plan-repository' }),
    );
    const ethAddressHbarSpendingPlanRepository = new EthAddressHbarSpendingPlanRepository(
      this.cacheService,
      logger.child({ name: 'eth-address-hbar-spending-plan-repository' }),
    );
    const ipAddressHbarSpendingPlanRepository = new IPAddressHbarSpendingPlanRepository(
      this.cacheService,
      logger.child({ name: 'ip-address-hbar-spending-plan-repository' }),
    );
    const hbarLimitService = new HbarLimitService(
      hbarSpendingPlanRepository,
      ethAddressHbarSpendingPlanRepository,
      ipAddressHbarSpendingPlanRepository,
      logger.child({ name: 'hbar-rate-limit' }),
      register,
      Hbar.fromTinybars(total),
      duration,
    );

    const hapiService = new HAPIService(logger, register, this.cacheService, this.eventEmitter, hbarLimitService);

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

    // Note: Since the main capturing metric logic of the `MetricService` class works by listening to specific events,
    //       this class does not need an instance but must still be initiated.
    new MetricService(
      logger,
      hapiService.getSDKClient(),
      this.mirrorNodeClient,
      register,
      this.eventEmitter,
      hbarLimitService,
    );

    this.ethImpl = new EthImpl(
      hapiService,
      this.mirrorNodeClient,
      logger.child({ name: 'relay-eth' }),
      chainId,
      register,
      this.cacheService,
    );

    this.hbarSpendingPlanConfigService = new HbarSpendingPlanConfigService(
      logger.child({ name: 'hbar-spending-plan-config-service' }),
      hbarSpendingPlanRepository,
      ethAddressHbarSpendingPlanRepository,
      ipAddressHbarSpendingPlanRepository,
    );

    if (process.env.SUBSCRIPTIONS_ENABLED && process.env.SUBSCRIPTIONS_ENABLED === 'true') {
      const poller = new Poller(this.ethImpl, logger.child({ name: `poller` }), register);
      this.subImpl = new SubscriptionController(poller, logger.child({ name: `subscr-ctrl` }), register);
    }

    this.initOperatorMetric(this.clientMain, this.mirrorNodeClient, logger, register);

    this.populatePreconfiguredSpendingPlans().then();

    logger.info('Relay running with chainId=%s', chainId);
  }

  /**
   * Populates pre-configured spending plans from a configuration file.
   * @returns {Promise<void>} A promise that resolves when the spending plans have been successfully populated.
   */
  private async populatePreconfiguredSpendingPlans(): Promise<void> {
    return this.hbarSpendingPlanConfigService
      .populatePreconfiguredSpendingPlans()
      .then((plansUpdated) => {
        if (plansUpdated > 0) {
          this.logger.info('Pre-configured spending plans populated successfully');
        }
      })
      .catch((e) => this.logger.warn(`Failed to load pre-configured spending plans: ${e.message}`));
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
  ): Gauge {
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
          const account = await mirrorNodeClient.getAccount(
            clientMain.operatorAccountId!.toString(),
            new RequestDetails({ requestId: Utils.generateRequestId(), ipAddress: '' }),
          );
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
