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
import WebSocket from 'ws';
chai.use(solidity);

import {Utils} from '../../helpers/utils';
import {AliasAccount} from "../../clients/servicesClient";
import {predefined, WebSocketError} from '../../../../../packages/relay';
const {ethers} = require('ethers');
const LogContractJson = require('../../contracts/Logs.json');

const FOUR_TWENTY_NINE_RESPONSE = 'Unexpected server response: 429';
const WS_RELAY_URL = `ws://localhost:${process.env.WEB_SOCKET_PORT}`;

const establishConnection = async () => {
        const provider = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);
        await provider.send('eth_chainId');
        return provider;
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
    // @ts-ignore
    const {servicesNode, relay} = global;

    // cached entities
    let requestId;
    let wsProvider;
    const accounts: AliasAccount[] = [];
    let logContractSigner;
    let originalWsMaxConnectionTtl;

    this.beforeAll(async () => {
        accounts[0] = await servicesNode.createAliasAccount(30, relay.provider, requestId);
        // Deploy Log Contract
        logContractSigner = await Utils.deployContractWithEthers([], LogContractJson, accounts[0].wallet, relay);
        // Override ENV variable for this test only
        originalWsMaxConnectionTtl = process.env.WS_MAX_CONNECTION_TTL; // cache original value
        process.env.WS_MAX_CONNECTION_TTL = '10000';
    });

    this.beforeEach(async () => {
        const { socketServer } = global;
        server = socketServer;

        wsProvider = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);

        requestId = Utils.generateRequestId();
        // Stabilizes the initial connection test.
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(server._connections).to.equal(1);
    });

    this.afterEach(async () => {
        await wsProvider.destroy();
        await new Promise(resolve => setTimeout(resolve, 1000));
        expect(server._connections).to.equal(0);
    });

    this.afterAll(async () => {
        // Return ENV variables to their original value
        process.env.WS_MAX_CONNECTION_TTL = originalWsMaxConnectionTtl;
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
                   WS_RELAY_URL
            );

            const response = await secondProvider.send('eth_chainId');
            expect(response).to.eq(CHAIN_ID);
            expect(server._connections).to.equal(2);

            secondProvider.destroy();
        });

        it('Subscribe and Unsubscribe', async function () {
            // subscribe
            const subId = await wsProvider.send('eth_subscribe',["logs", {"address":logContractSigner.address}]);
            // unsubscribe
            const result = await wsProvider.send('eth_unsubscribe', [subId]);

            expect(subId).to.be.length(34);
            expect(subId.substring(0,2)).to.be.eq("0x");
            expect(result).to.be.eq(true);
        });

        it('Subscribe and receive log event and unsubscribe', async function () {
            const loggerContractWS = new ethers.Contract(logContractSigner.address, LogContractJson.abi, wsProvider);
            let eventReceived;
            loggerContractWS.once("Log1", (val) => {
                eventReceived = val;
            });

            // perform an action on the SC that emits a Log1 event
            await logContractSigner.log1(100);
            // wait 1s to expect the message
            await new Promise(resolve => setTimeout(resolve, 2000));

            expect(eventReceived).to.be.eq(100);
        });

        it('Multiple ws connections and multiple subscriptions per connection', async function () {
            const wsConn1 = new ethers.providers.WebSocketProvider(
                `ws://localhost:${process.env.WEB_SOCKET_PORT}`
            );

            const wsConn2 = new ethers.providers.WebSocketProvider(
                `ws://localhost:${process.env.WEB_SOCKET_PORT}`
            );

            // using WS providers with LoggerContract
            const loggerContractWS1 = new ethers.Contract(logContractSigner.address, LogContractJson.abi, wsConn1);
            const loggerContractWS2 = new ethers.Contract(logContractSigner.address, LogContractJson.abi, wsConn2);

            // subscribe to Log1 of LoggerContract for all connections
            let eventReceivedWS1;
            loggerContractWS1.once("Log1", (val) => {
                eventReceivedWS1 = val;
            });

            //Subscribe to Log3 of LoggerContract for 2 connections
            let param1Log3ReceivedWS2;
            let param2Log3ReceivedWS2;
            let param3Log3ReceivedWS2;
            loggerContractWS2.once("Log3", (val1, val2, val3) => {
                param1Log3ReceivedWS2 = val1;
                param2Log3ReceivedWS2 = val2;
                param3Log3ReceivedWS2 = val3;
            });

            //Generate the Logs.
            await logContractSigner.log1(100);
            await logContractSigner.log3(4, 6, 7);
            // wait 2s to expect the message
            await new Promise(resolve => setTimeout(resolve, 3000));

            // validate we received everything as expected
            expect(eventReceivedWS1).to.be.eq(100);
            expect(param1Log3ReceivedWS2).to.be.eq(4);
            expect(param2Log3ReceivedWS2).to.be.eq(6);
            expect(param3Log3ReceivedWS2).to.be.eq(7);

            // destroy all WS connections
            wsConn1.destroy();
            wsConn2.destroy();
        });

        it('When JSON is invalid, expect INVALID_REQUEST Error message', async function() {

            const webSocket = new WebSocket(WS_RELAY_URL);
            let response = "";
            webSocket.on('message', function incoming(data) {
                response = data;
            });
            webSocket.on('open', function open() {
                webSocket.send('{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1');
            });
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(JSON.parse(response).code).to.eq(predefined.INVALID_REQUEST.code);
            expect(JSON.parse(response).name).to.eq(predefined.INVALID_REQUEST.name);
            expect(JSON.parse(response).message).to.eq(predefined.INVALID_REQUEST.message);

            webSocket.close();
        });

        it('Connection TTL is enforced, should close all connections', async function() {
            const wsConn2 = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);
            const wsConn3 = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait for the connections to be established

            // we verify that we have 3 connections, since we already have one from the beforeEach hook (wsProvider)
            expect(server._connections).to.equal(3);


            await new Promise(resolve => setTimeout(resolve, parseInt(process.env.WS_MAX_CONNECTION_TTL) + 1000));
            expect(server._connections).to.equal(0);
        });

        it('Does not allow more connections than the connection limit', async function() {
            // We already have one connection
            expect(server._connections).to.equal(1);

            let providers: ethers.providers.WebSocketProvider[] = [];
            for (let i = 1; i < parseInt(process.env.CONNECTION_LIMIT); i++) {
                providers.push(await establishConnection());
            }

            expect(server._connections).to.equal(parseInt(process.env.CONNECTION_LIMIT));

            await expectedErrorAndConnections(server);

            await new Promise(resolve => setTimeout(resolve, 1000));

            for (const p of providers) {
                await p.destroy();
            }

            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(server._connections).to.equal(1);
        });

        describe('IP connection limits', async function() {
            let originalConnectionLimitPerIp;

            before(() => {
                originalConnectionLimitPerIp = process.env.CONNECTION_LIMIT_PER_IP;
                process.env.CONNECTION_LIMIT_PER_IP = 3;
            });

            after(() => {
                process.env.CONNECTION_LIMIT_PER_IP = originalConnectionLimitPerIp;
            });

            it('Does not allow more connections from the same IP than the specified limit', async function() {
                const providers = [];
                let closeEventHandled = false;

                // Creates the maximum allowed connections
                for (let i = 1; i < parseInt(process.env.CONNECTION_LIMIT_PER_IP); i++) {
                    providers.push(await new ethers.providers.WebSocketProvider(WS_RELAY_URL));
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Repeat the following several times to make sure the internal counters are consistently correct
                for (let i = 0; i < 3; i++) {
                    expect(server._connections).to.equal(parseInt(process.env.CONNECTION_LIMIT_PER_IP));

                    // The next connection should be closed by the server
                    const provider = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);

                    provider._websocket.on('close', (code, message) => {
                        closeEventHandled = true;
                        expect(code).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.code);
                        expect(message).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.message);
                    })

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    expect(server._connections).to.equal(parseInt(process.env.CONNECTION_LIMIT_PER_IP));
                    expect(closeEventHandled).to.eq(true);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                for (const p of providers) {
                    await p.destroy();
                }

            });
        });
    });
});


