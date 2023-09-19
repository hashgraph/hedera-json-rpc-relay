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
import chai from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import shell from 'shelljs';
import pino from 'pino';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

import fs from 'fs';
import ServicesClient from '../clients/servicesClient';
import MirrorClient from '../clients/mirrorClient';
import RelayClient from '../clients/relayClient';
import app from '../../dist/server';
import { app as wsApp } from '@hashgraph/json-rpc-ws-server/dist/webSocketServer';
import { Hbar } from '@hashgraph/sdk';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';

const testLogger = pino({
  name: 'hedera-json-rpc-relay',
  level: process.env.LOG_LEVEL || 'trace',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
    },
  },
});
const logger = testLogger.child({ name: 'rpc-acceptance-test' });

const USE_LOCAL_NODE = process.env.LOCAL_NODE || 'true';
const NETWORK = process.env.HEDERA_NETWORK || '';
const OPERATOR_KEY = process.env.OPERATOR_KEY_MAIN || '';
const OPERATOR_ID = process.env.OPERATOR_ID_MAIN || '';
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || '';
const LOCAL_RELAY_URL = 'http://localhost:7546';
const RELAY_URL = process.env.E2E_RELAY_HOST || LOCAL_RELAY_URL;
let startOperatorBalance: Hbar;
global.relayIsLocal = RELAY_URL === LOCAL_RELAY_URL;

describe('RPC Server Acceptance Tests', function () {
  this.timeout(240 * 1000); // 240 seconds

  let relayServer; // Relay Server
  let socketServer;
  global.servicesNode = new ServicesClient(
    NETWORK,
    OPERATOR_ID,
    OPERATOR_KEY,
    logger.child({ name: `services-test-client` }),
  );
  global.mirrorNode = new MirrorClient(MIRROR_NODE_URL, logger.child({ name: `mirror-node-test-client` }));
  global.relay = new RelayClient(RELAY_URL, logger.child({ name: `relay-test-client` }));
  global.relayServer = relayServer;
  global.socketServer = socketServer;
  global.logger = logger;

  before(async () => {
    // configuration details
    logger.info('Acceptance Tests Configurations successfully loaded');
    logger.info(`LOCAL_NODE: ${process.env.LOCAL_NODE}`);
    logger.info(`CHAIN_ID: ${process.env.CHAIN_ID}`);
    logger.info(`HEDERA_NETWORK: ${process.env.HEDERA_NETWORK}`);
    logger.info(`OPERATOR_ID_MAIN: ${process.env.OPERATOR_ID_MAIN}`);
    logger.info(`MIRROR_NODE_URL: ${process.env.MIRROR_NODE_URL}`);
    logger.info(`E2E_RELAY_HOST: ${process.env.E2E_RELAY_HOST}`);

    if (USE_LOCAL_NODE === 'true') {
      runLocalHederaNetwork();
    }

    if (global.relayIsLocal) {
      runLocalRelay();
    }

    // cache start balance
    startOperatorBalance = await global.servicesNode.getOperatorBalance();
  });

  after(async function () {
    const endOperatorBalance = await global.servicesNode.getOperatorBalance();
    const cost = startOperatorBalance.toTinybars().subtract(endOperatorBalance.toTinybars());
    logger.info(`Acceptance Tests spent ${Hbar.fromTinybars(cost)}`);

    if (USE_LOCAL_NODE === 'true') {
      // stop local-node
      logger.info('Shutdown local node');
      shell.exec('hedera stop');
    }

    //stop relay
    logger.info('Stop relay');
    if (relayServer !== undefined) {
      relayServer.close();
    }

    if (process.env.TEST_WS_SERVER === 'true' && socketServer !== undefined) {
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

  function runLocalHederaNetwork() {
    // set env variables for docker images until local-node is updated
    process.env['NETWORK_NODE_IMAGE_TAG'] = '0.42.0-alpha.4';
    process.env['HAVEGED_IMAGE_TAG'] = '0.42.0-alpha.4';
    process.env['MIRROR_IMAGE_TAG'] = '0.88.0-beta2';

    console.log(
      `Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`,
    );

    console.log('Installing local node...');
    shell.exec(`npm install @hashgraph/hedera-local -g`);

    console.log('Starting local node...');
    shell.exec(`hedera start -d`);
    console.log('Hedera Hashgraph local node env started');
  }

  function runLocalRelay() {
    // start local relay, stop relay instance in local
    shell.exec('docker stop json-rpc-relay');

    logger.info(`Start relay on port ${constants.RELAY_PORT}`);
    relayServer = app.listen({ port: constants.RELAY_PORT });

    if (process.env.TEST_WS_SERVER === 'true') {
      shell.exec('docker stop json-rpc-relay-ws');
      logger.info(`Start ws-server on port ${constants.WEB_SOCKET_PORT}`);
      global.socketServer = wsApp.listen({ port: constants.WEB_SOCKET_PORT });
    }
  }
});
