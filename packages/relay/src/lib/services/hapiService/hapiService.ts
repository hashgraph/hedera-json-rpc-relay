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
import { Logger } from 'pino';
import EventEmitter from 'events';
import findConfig from 'find-config';
import constants from '../../constants';
import { Utils } from './../../../utils';
import HbarLimit from '../../hbarlimiter';
import { Registry, Counter } from 'prom-client';
import { SDKClient } from '../../clients/sdkClient';
import { CacheService } from '../cacheService/cacheService';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import fs from 'fs';
import { EnvProvider } from '@hashgraph/json-rpc-env-provider/dist/services';

export default class HAPIService {
  private transactionCount: number;
  private errorCodes: number[];
  private resetDuration: number;
  private shouldReset: boolean;

  private isReinitEnabled: boolean;
  private isTimeResetDisabled: boolean;

  private initialTransactionCount: number;
  private initialErrorCodes: number[];
  private initialResetDuration: number;

  private hederaNetwork: string;
  private clientMain: Client;

  /**
   * The SDK Client use for connecting to both the consensus nodes and mirror node. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private client: SDKClient;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private logger: Logger;

  /**
   * This limiter tracks hbar expenses and limits.
   * @private
   */
  private hbarLimiter: HbarLimit;

  /**
   * An instance of EventEmitter used for emitting and handling events within the class.
   *
   * @private
   * @readonly
   * @type {EventEmitter}
   */
  private readonly eventEmitter: EventEmitter;

  /**
   * @private
   */
  private readonly register: Registry;
  private clientResetCounter: Counter;
  private readonly cacheService: CacheService;

  /**
   * @private
   */
  private config: any;

  /**
   * Constructs an instance of the class, initializes configuration settings, and sets up various services.
   *
   * @param {Logger} logger - The logger instance used for logging.
   * @param {Registry} register - The registry instance for metrics and other services.
   * @param {HbarLimit} hbarLimiter - The Hbar rate limiter instance.
   * @param {CacheService} cacheService - The cache service instance.
   * @param {EventEmitter} eventEmitter - The event emitter instance used for emitting events.
   */
  constructor(
    logger: Logger,
    register: Registry,
    hbarLimiter: HbarLimit,
    cacheService: CacheService,
    eventEmitter: EventEmitter,
  ) {
    dotenv.config({ path: findConfig('.env') || '' });
    if (fs.existsSync(findConfig('.env') || '')) {
      this.config = dotenv.parse(fs.readFileSync(findConfig('.env') || ''));
    } else {
      this.config = {};
    }

    this.logger = logger;
    this.hbarLimiter = hbarLimiter;

    this.eventEmitter = eventEmitter;
    this.hederaNetwork = (EnvProvider.get('HEDERA_NETWORK') || this.config.HEDERA_NETWORK || '{}').toLowerCase();
    this.clientMain = this.initClient(logger, this.hederaNetwork);

    this.cacheService = cacheService;
    this.client = this.initSDKClient(logger);

    const currentDateNow = Date.now();
    this.initialTransactionCount = parseInt(EnvProvider.get('HAPI_CLIENT_TRANSACTION_RESET')!) || 0;
    this.initialResetDuration = parseInt(EnvProvider.get('HAPI_CLIENT_DURATION_RESET')!) || 0;
    this.initialErrorCodes = JSON.parse(EnvProvider.get('HAPI_CLIENT_ERROR_RESET') || '[21, 50]');

    this.transactionCount = this.initialTransactionCount;
    this.resetDuration = currentDateNow + this.initialResetDuration;
    this.errorCodes = this.initialErrorCodes;

    this.isReinitEnabled = true;
    this.isTimeResetDisabled = this.resetDuration === currentDateNow;

    if (this.transactionCount === 0 && this.errorCodes.length === 0 && this.isTimeResetDisabled) {
      this.isReinitEnabled = false;
    }
    this.shouldReset = false;

    this.register = register;
    const metricCounterName = 'rpc_relay_client_service';
    this.register.removeSingleMetric(metricCounterName);
    this.clientResetCounter = new Counter({
      name: metricCounterName,
      help: 'Relay Client Service',
      registers: [register],
      labelNames: ['transactions', 'duration', 'errors'],
    });
  }

  /**
   *  Decrement transaction counter. If 0 is reached, reset the client. Check also if resetDuration has been reached and reset the client, if yes.
   */
  private decrementTransactionCounter() {
    if (this.transactionCount == 0) {
      return;
    }

    this.transactionCount--;
    if (this.transactionCount <= 0) {
      this.shouldReset = true;
    }
  }

  /**
   *  Decrement error encountered counter. If 0 is reached, reset the client. Check also if resetDuration has been reached and reset the client, if yes.
   */
  public decrementErrorCounter(statusCode: number) {
    if (!this.isReinitEnabled || this.errorCodes.length === 0) {
      return;
    }

    if (this.errorCodes.includes(statusCode)) {
      this.shouldReset = true;
    }
  }

  private checkResetDuration() {
    if (this.isTimeResetDisabled) {
      return;
    }

    if (this.resetDuration < Date.now()) {
      this.shouldReset = true;
    }
  }

  /**
   * Reset the SDK Client and all counters.
   */
  private resetClient() {
    this.clientResetCounter
      .labels(this.transactionCount.toString(), this.resetDuration.toString(), this.errorCodes.toString())
      .inc(1);

    this.clientMain = this.initClient(this.logger, this.hederaNetwork);
    this.client = this.initSDKClient(this.logger);
    this.resetCounters();
  }

  /**
   * Reset all counters with predefined configuration.
   */
  private resetCounters() {
    this.transactionCount = this.initialTransactionCount;
    this.resetDuration = Date.now() + this.initialResetDuration;

    this.shouldReset = false;
  }

  /**
   * Configure SDK Client from main client
   * @param {Logger} logger
   * @returns SDK Client
   */
  private initSDKClient(logger: Logger): SDKClient {
    return new SDKClient(
      this.clientMain,
      logger.child({ name: `consensus-node` }),
      this.hbarLimiter,
      this.cacheService,
      this.eventEmitter,
    );
  }

  /**
   * Configure Client
   * @param {Logger} logger
   * @param {string} hederaNetwork
   * @param {string | null} type
   * @returns Client
   */
  private initClient(logger: Logger, hederaNetwork: string, type: string | null = null): Client {
    let client: Client, privateKey: PrivateKey;
    if (hederaNetwork in constants.CHAIN_IDS) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }

    if (type === 'eth_sendRawTransaction') {
      if (EnvProvider.get('OPERATOR_ID_ETH_SENDRAWTRANSACTION') && EnvProvider.get('OPERATOR_KEY_ETH_SENDRAWTRANSACTION')) {
        // @ts-ignore
        privateKey = Utils.createPrivateKeyBasedOnFormat(EnvProvider.get('OPERATOR_KEY_ETH_SENDRAWTRANSACTION'));
        // @ts-ignore
        client = client.setOperator(AccountId.fromString(EnvProvider.get('OPERATOR_ID_ETH_SENDRAWTRANSACTION')), privateKey);
      } else {
        logger.warn(`Invalid 'ETH_SENDRAWTRANSACTION' env variables provided`);
      }
    } else {
      const operatorId: string = EnvProvider.get('OPERATOR_ID_MAIN') || this.config.OPERATOR_ID_MAIN || '';
      const operatorKey: string = EnvProvider.get('OPERATOR_KEY_MAIN') || this.config.OPERATOR_KEY_MAIN || '';

      if (operatorId && operatorKey) {
        privateKey = Utils.createPrivateKeyBasedOnFormat(operatorKey);
        client = client.setOperator(AccountId.fromString(operatorId.trim()), privateKey);
      } else {
        logger.warn(`Invalid 'OPERATOR' env variables provided`);
      }
    }

    client.setTransportSecurity(EnvProvider.get('CLIENT_TRANSPORT_SECURITY') === 'true' || false);

    const SDK_REQUEST_TIMEOUT = parseInt(EnvProvider.get('SDK_REQUEST_TIMEOUT') || '10000');
    client.setRequestTimeout(SDK_REQUEST_TIMEOUT);

    logger.info(
      `SDK client successfully configured to ${JSON.stringify(hederaNetwork)} for account ${
        client.operatorAccountId
      } with request timeout value: ${SDK_REQUEST_TIMEOUT}`,
    );

    return client;
  }

  /**
   * Return current main client instance
   * @returns Main Client
   */
  public getMainClientInstance() {
    return this.clientMain;
  }

  /**
   * Return configured sdk client and reinitialize it before retuning, if needed.
   * @returns SDK Client
   */
  public getSDKClient(): SDKClient {
    if (!this.isReinitEnabled) {
      return this.client;
    }

    if (this.shouldReset) {
      this.logger.warn(`SDK Client reinitialization.`);
      this.resetClient();
    }
    this.decrementTransactionCounter();
    this.checkResetDuration();

    return this.client;
  }

  /**
   * Return true if reinitialization feature is enabled.
   * @returns isEnabled boolean
   */
  public getIsReinitEnabled() {
    return this.isReinitEnabled;
  }

  /**
   * Return transaction count with current sdk instance.
   * @returns transactionCount
   */
  public getTransactionCount() {
    return this.transactionCount;
  }

  /**
   * Return error codes which can trigger a sdk instance reinitialization.
   * @returns errorCodes
   */
  public getErrorCodes() {
    return this.errorCodes;
  }

  /**
   * Return time until reset of the current sdk instance.
   */
  public getTimeUntilReset() {
    return this.resetDuration - Date.now();
  }
}
