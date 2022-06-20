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
import path from 'path';
import shell from 'shelljs';
import pino from 'pino';
import fs from 'fs';
import ServicesClient from '../clients/servicesClient';
import MirrorClient from '../clients/mirrorClient';
import RelayClient from '../clients/relayClient';
import app from '../../dist/server';

const testLogger = pino({
    name: 'hedera-json-rpc-relay',
    level: process.env.LOG_LEVEL || 'trace',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true
        }
    }
});
const logger = testLogger.child({ name: 'rpc-acceptance-test' });

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const USE_LOCAL_NODE = process.env.LOCAL_NODE || 'true';
const NETWORK = process.env.HEDERA_NETWORK || '';
const OPERATOR_KEY = process.env.OPERATOR_KEY_MAIN || '';
const OPERATOR_ID = process.env.OPERATOR_ID_MAIN || '';
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || '';
const LOCAL_RELAY_URL = 'http://localhost:7546';
const RELAY_URL = process.env.E2E_RELAY_HOST || LOCAL_RELAY_URL;

describe('RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    let relayServer; // Relay Server
    global.servicesNode = new ServicesClient(NETWORK, OPERATOR_ID, OPERATOR_KEY, logger.child({name: `services-client`}));
    global.mirrorNode = new MirrorClient(MIRROR_NODE_URL, logger.child({name: `mirror-node-client`}));
    global.relay = new RelayClient(RELAY_URL, logger.child({name: `relay-client`}));
    global.relayServer = relayServer;
    global.logger = logger;

    before(async () => {

        if (USE_LOCAL_NODE === 'true') {
            runLocalHederaNetwork();
        }

        if (RELAY_URL === LOCAL_RELAY_URL) {
            runLocalRelay();
        }

    });

    after(function () {
        if (USE_LOCAL_NODE === 'true') {
            // stop local-node
            logger.info('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        logger.info('Stop relay');
        if (relayServer !== undefined) {
            relayServer.close();
        }
    });

    describe("Acceptance tests", async () => {
        const tests = fs.readdirSync(path.resolve(__dirname, './'))
            .filter(test => test !== 'index.spec.ts' && test.endsWith('.spec.ts'))

        for( const test of tests) {
            require(`./${test}`);
        }
    });

    function runLocalHederaNetwork() {
        // set env variables for docker images until local-node is updated
        process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
        process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
        process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
        logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

        // start local-node
        logger.debug('Start local node');
        shell.exec('npx hedera-local restart');
        logger.trace('Hedera Hashgraph local node env started');
    }

    function runLocalRelay() {
        // start relay
        logger.info(`Start relay on port ${process.env.SERVER_PORT}`);
        relayServer = app.listen({port: process.env.SERVER_PORT});
    }

});
