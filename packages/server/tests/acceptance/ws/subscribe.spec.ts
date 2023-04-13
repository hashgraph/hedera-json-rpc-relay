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
    // Cached original ENV variables
    let originalWsMaxConnectionTtl;
    let originalWsMultipleAddressesEnabledValue;

    const topics = [
        "0xa8fb2f9a49afc2ea148319326c7208965555151db2ce137c05174098730aedc3",
        "0x0000000000000000000000000000000000000000000000000000000000000004",
        "0x0000000000000000000000000000000000000000000000000000000000000006",
        "0x0000000000000000000000000000000000000000000000000000000000000007"
    ]

    this.beforeAll(async () => {
        accounts[0] = await servicesNode.createAliasAccount(30, relay.provider, requestId);
        // Deploy Log Contract
        logContractSigner = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
        // cache original ENV values
        originalWsMaxConnectionTtl = process.env.WS_MAX_CONNECTION_TTL;
        originalWsMultipleAddressesEnabledValue = process.env.WS_MULTIPLE_ADDRESSES_ENABLED;

        process.env.WS_MAX_CONNECTION_TTL = '10000';
    });

    this.beforeEach(async () => {
        // restore original ENV value
        process.env.WS_MULTIPLE_ADDRESSES_ENABLED = originalWsMultipleAddressesEnabledValue;

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

        it('Subscribe to multiple contracts on same subscription', async function () {
            process.env.WS_MULTIPLE_ADDRESSES_ENABLED = "true"; // enable feature flag for this test
            await new Promise(resolve => setTimeout(resolve, 10000));

            const logContractSigner2 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
            const logContractSigner3 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
            const addressCollection = [logContractSigner.address, logContractSigner2.address, logContractSigner3.address];
            let subscriptionId = "";
            const webSocket = new WebSocket(WS_RELAY_URL);

            let latestEventFromSubscription;
            webSocket.on('message', function incoming(data) {
                if(subscriptionId == ""){
                    subscriptionId = JSON.parse(data).result;
                } else {
                    latestEventFromSubscription = JSON.parse(data);
                }
            });

            webSocket.on('open', function open() {
                const request = `{"jsonrpc":"2.0","method":"eth_subscribe","params":["logs", {"address":${JSON.stringify(addressCollection)}}],"id":1}`;
                webSocket.send(request);
            });
            await new Promise(resolve => setTimeout(resolve, 500)); // wait for subscription to be created

            // create event on contract 1
            await logContractSigner.log1(100);
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait for event to be received
            expect("1: " + latestEventFromSubscription.params.result.address).to.be.eq("1: " + logContractSigner.address.toLowerCase());
            expect("1: " + latestEventFromSubscription.params.subscription).to.be.eq("1: " + subscriptionId);

            // create event on contract 2
            await logContractSigner2.log1(200);
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait for event to be received
            expect("2: " + latestEventFromSubscription.params.result.address).to.be.eq("2: " + logContractSigner2.address.toLowerCase());
            expect("2: " + latestEventFromSubscription.params.subscription).to.be.eq("2: " + subscriptionId);

            // create event on contract 3
            await logContractSigner3.log1(300);
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait for event to be received
            expect("3: " + latestEventFromSubscription.params.result.address).to.be.eq("3: " + logContractSigner3.address.toLowerCase());
            expect("3: " + latestEventFromSubscription.params.subscription).to.be.eq("3: " + subscriptionId);

            // close the connection
            webSocket.close();

            // wait for the connections to be closed
            await new Promise(resolve => setTimeout(resolve, 500));
            process.env.WS_MULTIPLE_ADDRESSES_ENABLED = originalWsMultipleAddressesEnabledValue; // restore original value
        });


        it('Subscribe to multiple contracts on same subscription Should fail with INVALID_PARAMETER due to feature flag disabled', async function () {
            const originalWsMultipleAddressesEnabledValue = process.env.WS_MULTIPLE_ADDRESSES_ENABLED; // cache original value
            process.env.WS_MULTIPLE_ADDRESSES_ENABLED = "false"; // disable feature flag
            const logContractSigner2 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
            const addressCollection = [logContractSigner.address, logContractSigner2.address];
            const webSocket = new WebSocket(WS_RELAY_URL);
            const requestId = 3;
            webSocket.on('open', function open() {
                const request = `{"jsonrpc":"2.0","method":"eth_subscribe","params":["logs", {"address":${JSON.stringify(addressCollection)}}],"id":${requestId}}`;
                webSocket.send(request);
            });
            let response;
            webSocket.on('message', function incoming(data) {
                response = JSON.parse(data);
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(response.id).to.be.eq(requestId);
            expect(response.error.code).to.be.eq(-32602);
            expect(response.error.name).to.be.eq('Invalid parameter');
            expect(response.error.message).to.be.eq(`Invalid parameter filters.address: Only one contract address is allowed`);

            // post test clean-up
            webSocket.close();

            // wait 500 ms for the connection to be closed
            await new Promise(resolve => setTimeout(resolve, 500));
        });


        it('Connection TTL is enforced, should close all connections', async function() {
            const wsConn2 = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);
            const wsConn3 = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait for the connections to be established

            // we verify that we have 3 connections, since we already have one from the beforeEach hook (wsProvider)
            expect(server._connections).to.equal(3);

            let closeEventHandled2 = false;
            wsConn2._websocket.on('close', (code, message) => {
                closeEventHandled2 = true;
                expect(code).to.equal(WebSocketError.TTL_EXPIRED.code);
                expect(message).to.equal(WebSocketError.TTL_EXPIRED.message);
            })

            let closeEventHandled3 = false;
            wsConn2._websocket.on('close', (code, message) => {
                closeEventHandled3 = true;
                expect(code).to.equal(WebSocketError.TTL_EXPIRED.code);
                expect(message).to.equal(WebSocketError.TTL_EXPIRED.message);
            })

            await new Promise(resolve => setTimeout(resolve, parseInt(process.env.WS_MAX_CONNECTION_TTL) + 1000));

            expect(closeEventHandled2).to.eq(true);
            expect(closeEventHandled3).to.eq(true);
            expect(server._connections).to.equal(0);
        });

        it('Expect Unsupported Method Error message when subscribing for newHeads method', async function() {
            const webSocket = new WebSocket(WS_RELAY_URL);
            let response = {};
            webSocket.on('message', function incoming(data) {
                response = JSON.parse(data);
            });
            webSocket.on('open', function open() {
                webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"],"id":1}');
            });

            // wait 500ms to expect the message
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
            expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
            expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

            // close the connection
            webSocket.close();
        });

        it('Expect Unsupported Method Error message when subscribing for newPendingTransactions method', async function() {
            const webSocket = new WebSocket(WS_RELAY_URL);
            let response = {};
            webSocket.on('message', function incoming(data) {
                response = JSON.parse(data);
            });
            webSocket.on('open', function open() {
                webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["newPendingTransactions"],"id":1}');
            });

            // wait 500ms to expect the message
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
            expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
            expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

            // close the connection
            webSocket.close();
        });

        it('Expect Unsupported Method Error message when subscribing for "other" method', async function() {
            const webSocket = new WebSocket(WS_RELAY_URL);
            let response = {};
            webSocket.on('message', function incoming(data) {
                response = JSON.parse(data);
            });
            webSocket.on('open', function open() {
                webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["other"],"id":1}');
            });

            // wait 500ms to expect the message
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
            expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
            expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

            // close the connection
            webSocket.close();
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for the connection to be closed
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
                originalConnectionLimitPerIp = process.env.WS_CONNECTION_LIMIT_PER_IP;
                process.env.WS_CONNECTION_LIMIT_PER_IP = 3;
            });

            after(() => {
                process.env.WS_CONNECTION_LIMIT_PER_IP = originalConnectionLimitPerIp;
            });

            it('Does not allow more connections from the same IP than the specified limit', async function() {
                const providers = [];

                // Creates the maximum allowed connections
                for (let i = 1; i < parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP); i++) {
                    providers.push(await new ethers.providers.WebSocketProvider(WS_RELAY_URL));
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Repeat the following several times to make sure the internal counters are consistently correct
                for (let i = 0; i < 3; i++) {
                    expect(server._connections).to.equal(parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP));

                    // The next connection should be closed by the server
                    const provider = await new ethers.providers.WebSocketProvider(WS_RELAY_URL);

                    let closeEventHandled = false;
                    provider._websocket.on('close', (code, message) => {
                        closeEventHandled = true;
                        expect(code).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.code);
                        expect(message).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.message);
                    })

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    expect(server._connections).to.equal(parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP));
                    expect(closeEventHandled).to.eq(true);

                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                for (const p of providers) {
                    await p.destroy();
                }

            });
        });

        describe('Connection subscription limits', async function() {
            let originalSubsPerConnection;

            before(() => {
                originalSubsPerConnection = process.env.WS_SUBSCRIPTION_LIMIT;
                process.env.WS_SUBSCRIPTION_LIMIT = 2;
            });

            after(() => {
                process.env.WS_SUBSCRIPTION_LIMIT = originalSubsPerConnection;
            });

            it('Does not allow more subscriptions per connection than the specified limit', async function() {
                let errorsHandled = 0;

                // Create different subscriptions
                for (let i = 0; i < 3; i++) {
                    try {
                        const subId = await wsProvider.send('eth_subscribe',["logs", {
                            address: logContractSigner.address,
                            topics: [topics[i]]
                        }]);
                    }
                    catch(e: any) {
                        expect(e.code).to.eq(predefined.MAX_SUBSCRIPTIONS.code);
                        expect(e.message).to.eq(predefined.MAX_SUBSCRIPTIONS.message);
                        errorsHandled++;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
                expect(errorsHandled).to.eq(1);
            });

            it('Calling eth_unsubscribe decrements the internal counters', async function() {
                let errorsHandled = 0;

                // Create different subscriptions
                for (let i = 0; i < 3; i++) {
                    try {
                        const subId = await wsProvider.send('eth_subscribe',["logs", {
                            address: logContractSigner.address,
                            topics: [topics[i]]
                        }]);

                        const result = await wsProvider.send('eth_unsubscribe', [subId]);
                    }
                    catch(e: any) {
                        errorsHandled++;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
                expect(errorsHandled).to.eq(0);
            });
        });
    });
});

