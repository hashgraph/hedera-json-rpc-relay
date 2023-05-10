/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import { Logger } from 'pino';
import { Registry, Counter } from 'prom-client';
import { SDKClient } from '../../clients/sdkClient';

export default class ClientService {
  private transactionCount: number;
  private errorCount: number;
  private resetDuration: number;

  private clientMain: Client;
  private client: SDKClient;
  private logger: Logger;
  private readonly register: Registry;
  private clientResetCounter: Counter;

  private chainIds = {
    mainnet: 0x127,
    testnet: 0x128,
    previewnet: 0x129,
  };

  /**
   * @param {Logger} logger
   * @param {Registry} register
   */
  constructor(logger: Logger, register: Registry) {
    dotenv.config({ path: findConfig('.env') || '' });

    this.logger = logger;

    const hederaNetwork: string = (process.env.HEDERA_NETWORK || '{}').toLowerCase();
    this.clientMain = this.initClient(logger, hederaNetwork);
    this.client = this.initSDKClient(logger, register);

    this.transactionCount = 0;
    this.errorCount = 0;
    this.resetDuration = 600000;

    this.register = register;

    const metricCounterName = 'rpc_relay_client_service';
    register.removeSingleMetric(metricCounterName);
    this.clientResetCounter = new Counter({
      name: metricCounterName,
      help: 'Relay Client Service',
      registers: [register],
      labelNames: ['mode', 'methodName'],
    });
  }

  /**
   *  Increment transaction counter. If limit is reached, reset client. Check also if resetDuration has been reached and reset the client, if yes.
   */
  public incrementTransactions() {}

  /**
   *  Increment error encountered counter. If limit is reached, reset client. Check also if resetDuration has been reached and reset the client, if yes.
   */
  public incrementErrors() {}

  /**
   * Reset the main client, SDK Client and reset all counters.
   */
  private resetClient() {
    // this.client = null;
  }

  /**
   * Return main client
   * @returns Main Client
   */
  public getClient() {
    return this.clientMain;
  }

  /**
   * Return configured sdk client
   * @returns SDK Client
   */
  public getSDKClient(): SDKClient {
    return this.client;
  }

  /**
   * Configure SDK Client from main client
   * @param {Logger} logger
   * @param {Registry} register
   * @returns SDK Client
   */
  private initSDKClient(logger: Logger, register: Registry): SDKClient {
    return new SDKClient(this.clientMain, logger.child({ name: `consensus-node` }), register);
  }

  /**
   * Configure Client
   * @param {Logger} logger
   * @param {string} hederaNetwork
   * @param {string | null} type
   * @returns Client
   */
  private initClient(logger: Logger, hederaNetwork: string, type: string | null = null): Client {
    let client: Client;
    if (hederaNetwork in this.chainIds) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }

    if (type === 'eth_sendRawTransaction') {
      if (process.env.OPERATOR_ID_ETH_SENDRAWTRANSACTION && process.env.OPERATOR_KEY_ETH_SENDRAWTRANSACTION) {
        client = client.setOperator(
          AccountId.fromString(process.env.OPERATOR_ID_ETH_SENDRAWTRANSACTION),
          PrivateKey.fromString(process.env.OPERATOR_KEY_ETH_SENDRAWTRANSACTION)
        );
      } else {
        logger.warn(`Invalid 'ETH_SENDRAWTRANSACTION' env variables provided`);
      }
    } else {
      if (process.env.OPERATOR_ID_MAIN && process.env.OPERATOR_KEY_MAIN) {
        client = client.setOperator(
          AccountId.fromString(process.env.OPERATOR_ID_MAIN.trim()),
          PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN)
        );
      } else {
        logger.warn(`Invalid 'OPERATOR' env variables provided`);
      }
    }

    client.setTransportSecurity(process.env.CLIENT_TRANSPORT_SECURITY === 'true' || false);
    client.setRequestTimeout(parseInt(process.env.SDK_REQUEST_TIMEOUT || '10000'));

    logger.info(
      `SDK client successfully configured to ${JSON.stringify(hederaNetwork)} for account ${
        client.operatorAccountId
      } with request timeout value: ${process.env.SDK_REQUEST_TIMEOUT}`
    );

    return client;
  }
}
