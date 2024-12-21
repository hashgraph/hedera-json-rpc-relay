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
import { Server } from 'node:http';

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { ConfigName } from '@hashgraph/json-rpc-config-service/src/services/configName';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { RequestDetails } from '@hashgraph/json-rpc-relay/dist/lib/types';
import { setServerTimeout } from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/utils';
import app from '@hashgraph/json-rpc-server/dist/server';
import MirrorClient from '@hashgraph/json-rpc-server/tests/clients/mirrorClient';
import RelayClient from '@hashgraph/json-rpc-server/tests/clients/relayClient';
import ServicesClient from '@hashgraph/json-rpc-server/tests/clients/servicesClient';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { app as wsApp } from '@hashgraph/json-rpc-ws-server/dist/webSocketServer';
import { AccountId, Hbar } from '@hashgraph/sdk';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

chai.use(chaiAsPromised);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
const DOT_ENV = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../../../.env')));

const testLogger = pino({
  name: 'hedera-json-rpc-relay',
  level: ConfigService.get(ConfigName.LOG_LEVEL) || 'trace',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
    },
  },
});
const logger = testLogger.child({ name: 'rpc-acceptance-test' });

const NETWORK = ConfigService.get(ConfigName.HEDERA_NETWORK) || DOT_ENV.HEDERA_NETWORK || '';
const OPERATOR_KEY = ConfigService.get(ConfigName.OPERATOR_KEY_MAIN) || DOT_ENV.OPERATOR_KEY_MAIN || '';
const OPERATOR_ID = ConfigService.get(ConfigName.OPERATOR_ID_MAIN) || DOT_ENV.OPERATOR_ID_MAIN || '';
const MIRROR_NODE_URL = ConfigService.get(ConfigName.MIRROR_NODE_URL) || DOT_ENV.MIRROR_NODE_URL || '';
const LOCAL_RELAY_URL = 'http://localhost:7546';
const RELAY_URL = ConfigService.get(ConfigName.E2E_RELAY_HOST) || LOCAL_RELAY_URL;
const CHAIN_ID = ConfigService.get(ConfigName.CHAIN_ID) || '0x12a';
let startOperatorBalance: Hbar;
global.relayIsLocal = RELAY_URL === LOCAL_RELAY_URL;

describe('RPC Server Acceptance Tests', function () {
  this.timeout(240 * 1000); // 240 seconds

  const requestDetails = new RequestDetails({ requestId: 'rpc_batch1Test', ipAddress: '0.0.0.0' });
  global.servicesNode = new ServicesClient(
    NETWORK,
    OPERATOR_ID,
    OPERATOR_KEY,
    logger.child({ name: `services-test-client` }),
  );
  global.mirrorNode = new MirrorClient(MIRROR_NODE_URL, logger.child({ name: `mirror-node-test-client` }));
  global.relay = new RelayClient(RELAY_URL, logger.child({ name: `relay-test-client` }));
  global.logger = logger;

  before(async () => {
    // configuration details
    logger.info('Acceptance Tests Configurations successfully loaded');
    logger.info(`LOCAL_NODE: ${ConfigService.get(ConfigName.LOCAL_NODE)}`);
    logger.info(`CHAIN_ID: ${ConfigService.get(ConfigName.CHAIN_ID)}`);
    logger.info(`HEDERA_NETWORK: ${NETWORK}`);
    logger.info(`OPERATOR_ID_MAIN: ${OPERATOR_ID}`);
    logger.info(`MIRROR_NODE_URL: ${MIRROR_NODE_URL}`);
    logger.info(`E2E_RELAY_HOST: ${ConfigService.get(ConfigName.E2E_RELAY_HOST)}`);

    if (global.relayIsLocal) {
      runLocalRelay();
    }

    // cache start balance
    startOperatorBalance = await global.servicesNode.getOperatorBalance();
    const initialAccount: AliasAccount = await global.servicesNode.createInitialAliasAccount(
      RELAY_URL,
      CHAIN_ID,
      Utils.generateRequestId(),
    );

    global.accounts = new Array<AliasAccount>(initialAccount);
    await global.mirrorNode.get(`/accounts/${initialAccount.address}`, requestDetails);
  });

  after(async function () {
    const operatorAddress = `0x${AccountId.fromString(OPERATOR_ID).toSolidityAddress()}`;
    const accounts: AliasAccount[] = global.accounts;
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      try {
        const balance = await account.wallet.provider?.getBalance(account.address);
        const tx = {
          to: operatorAddress,
          value: balance,
        };
        const feeData = await account.wallet.provider?.getFeeData();
        const gasEstimation = await account.wallet.provider?.estimateGas(tx);

        // we multiply by 10 to add tolerance
        // @ts-ignore
        const cost = BigInt(gasEstimation * feeData?.gasPrice) * BigInt(10);

        await account.wallet.sendTransaction({
          to: operatorAddress,
          gasLimit: gasEstimation,
          // @ts-ignore
          value: balance - cost,
        });
        logger.info(`Account ${account.address} refunded back to operator ${balance} th.`);
      } catch (error) {
        logger.error(`Account ${account.address} couldn't send the hbars back to the operator: ${error}`);
      }
    }

    const endOperatorBalance = await global.servicesNode.getOperatorBalance();
    const cost = startOperatorBalance.toTinybars().subtract(endOperatorBalance.toTinybars());
    logger.info(`Acceptance Tests spent ${Hbar.fromTinybars(cost)}`);

    //stop relay
    logger.info('Stop relay');
    const relayServer: Server = global.relayServer;
    if (relayServer !== undefined) {
      relayServer.close();
    }

    const socketServer: Server = global.socketServer;
    if (ConfigService.get(ConfigName.TEST_WS_SERVER) && socketServer !== undefined) {
      socketServer.close();
    }
  });

  describe('Acceptance tests', async () => {
    fs.readdirSync(path.resolve(__dirname, './')).forEach((file) => {
      if (fs.statSync(path.resolve(__dirname, file)).isDirectory()) {
        fs.readdirSync(path.resolve(__dirname, file)).forEach((subFile) => {
          loadTest(`${file}/${subFile}`);
        });
      } else {
        loadTest(file);
      }
    });
  });

  function loadTest(testFile) {
    if (testFile !== 'index.spec.ts' && testFile.endsWith('.spec.ts')) {
      require(`./${testFile}`);
    }
  }

  function runLocalRelay() {
    // start local relay, relay instance in local should not be running

    logger.info(`Start relay on port ${constants.RELAY_PORT}`);
    const relayServer = app.listen({ port: constants.RELAY_PORT });
    global.relayServer = relayServer;
    setServerTimeout(relayServer);

    if (ConfigService.get(ConfigName.TEST_WS_SERVER)) {
      logger.info(`Start ws-server on port ${constants.WEB_SOCKET_PORT}`);
      global.socketServer = wsApp.listen({ port: constants.WEB_SOCKET_PORT });
    }
  }
});
