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

// external resources
import { solidity } from "ethereum-waffle";
import chai, {assert, expect} from "chai";
chai.use(solidity);

import {Utils} from '../../helpers/utils';
import { finished } from "stream";
import bodyParser from "koa-bodyparser";
const {ethers} = require('ethers');

const FOUR_TWENTY_NINE_RESPONSE = 'Unexpected server response: 429';

const establishConnection = async () => {
        const provider = await new ethers.providers.WebSocketProvider(
            `ws://localhost:${process.env.WEB_SOCKET_PORT}`
        );
        await provider.send('eth_chainId');
}; 

async function expectedErrorAndConnections(server: any): Promise<void> {
    
    let expectedErrorMessageResult = false;
    let expectedNumberOfOpenConnections = false;

    const listeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');

    process.on('uncaughtException', function (err) {

        expectedErrorMessageResult = (err.message === FOUR_TWENTY_NINE_RESPONSE);
        expectedNumberOfOpenConnections = (server._connections == parseInt(process.env.CONNECTION_LIMIT));

        assert.equal(expectedErrorMessageResult, true, `Incorrect error message returned. Expected ${FOUR_TWENTY_NINE_RESPONSE}, got ${err.message}`);
        assert.equal(expectedNumberOfOpenConnections, true, `Incorrect number of open connections. Expected ${process.env.CONNECTION_LIMIT}, got ${server._connections}`);

        process.removeAllListeners('uncaughtException');
        listeners.forEach(async (listener) => {
            process.on('uncaughtException', listener);

        });
    });

    try {
        process.nextTick(async () => {
            await establishConnection();
        });
    } catch (err) {
        console.log('Caught!', err.message);
    }
};

describe('@web-socket Acceptance Tests', async function() {
    this.timeout(240 * 1000); // 240 seconds
    const CHAIN_ID = process.env.CHAIN_ID || 0;
    let server;

    // cached entities
    let requestId;
    let wsProvider;

    this.beforeEach(async () => {
        const { socketServer } = global;
        server = socketServer;
        
        wsProvider = await new ethers.providers.WebSocketProvider(
            `ws://localhost:${process.env.WEB_SOCKET_PORT}`
        );

        requestId = Utils.generateRequestId();
        // Stabilizes the initial connection test.
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    this.afterEach(async () => {
        wsProvider.destroy();
    });


    describe('Connection', async function() {
        it('establishes connection', async function() {
            expect(wsProvider).to.exist;
            expect(wsProvider._wsReady).to.eq(true);
        });

        it('Socket server responds to the eth_chainId event', async function() {
            const response = await wsProvider.send('eth_chainId');
            expect(response).to.eq(CHAIN_ID);
        });

        it('Establishes multiple connections', async function() {

            const secondProvider = new ethers.providers.WebSocketProvider(
                    `ws://localhost:${process.env.WEB_SOCKET_PORT}`
            );

            const response = await secondProvider.send('eth_chainId');
            expect(response).to.eq(CHAIN_ID);
            expect(server._connections).to.equal(2);

            secondProvider.destroy();
        });

        it('Does not allow more connections than the connection limit', async function() {
            // We already have one connection
            for (let i = 1; i < parseInt(process.env.CONNECTION_LIMIT); i++) {
                await establishConnection();
            }

            expect(server._connections).to.equal(parseInt(process.env.CONNECTION_LIMIT));

            await expectedErrorAndConnections(server);

            await new Promise(resolve => setTimeout(resolve, 1000));
 
        });
    });
});


