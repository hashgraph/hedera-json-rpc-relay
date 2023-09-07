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
import { solidity } from 'ethereum-waffle';
import chai, { expect } from 'chai';
import WebSocket from 'ws';
chai.use(solidity);

import { Utils } from '../../helpers/utils';
import assertions from '../../helpers/assertions';
import { AliasAccount } from '../../clients/servicesClient';
import { predefined, WebSocketError } from '../../../../../packages/relay';
import { ethers } from 'ethers';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import Assertions from '../../helpers/assertions';
import LogContractJson from '../../contracts/Logs.json';
import Constants from '../../helpers/constants';
import IERC20Json from '../../contracts/openzeppelin/IERC20.json';

const WS_RELAY_URL = `ws://localhost:${constants.WEB_SOCKET_PORT}`;

const establishConnection = async () => {
  const provider = await new ethers.WebSocketProvider(WS_RELAY_URL);
  await provider.send('eth_chainId', [null]);
  return provider;
};

const unsubscribeAndCloseConnections = async (provider: ethers.WebSocketProvider, subId: string) => {
  const result = await provider.send('eth_unsubscribe', [subId]);
  provider.destroy();
  return result;
};

const createLogs = async (contract: ethers.Contract, requestId) => {
  const gasOptions = await Utils.gasOptions(requestId);

  const tx1 = await contract.log0(10, gasOptions);
  await tx1.wait();

  const tx2 = await contract.log1(1, gasOptions);
  await tx2.wait();

  const tx3 = await contract.log2(1, 2, gasOptions);
  await tx3.wait();

  const tx4 = await contract.log3(10, 20, 31, gasOptions);
  await tx4.wait();

  const tx5 = await contract.log4(11, 22, 33, 44, gasOptions);
  await tx5.wait();

  await new Promise((resolve) => setTimeout(resolve, 2000));
};

describe('@web-socket Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const CHAIN_ID = process.env.CHAIN_ID || 0;
  let server;
  // @ts-ignore
  const { servicesNode, relay, mirrorNode } = global;

  // cached entities
  let requestId;
  let wsProvider;
  const accounts: AliasAccount[] = [];
  let logContractSigner;
  // Cached original ENV variables
  let originalWsMaxInactivityTtl;
  let originalWsMultipleAddressesEnabledValue;

  const topics = [
    '0xa8fb2f9a49afc2ea148319326c7208965555151db2ce137c05174098730aedc3',
    '0x0000000000000000000000000000000000000000000000000000000000000004',
    '0x0000000000000000000000000000000000000000000000000000000000000006',
    '0x0000000000000000000000000000000000000000000000000000000000000007',
  ];

  before(async () => {
    const { socketServer } = global;
    server = socketServer;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(5, relay.provider, requestId);
    // Deploy Log Contract
    logContractSigner = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);

    // cache original ENV values
    originalWsMultipleAddressesEnabledValue = process.env.WS_MULTIPLE_ADDRESSES_ENABLED;

    // allow mirror node a 5 full record stream write windows (5 sec) and a buffer to persist setup details
    await new Promise((r) => setTimeout(r, 5000));
  });

  beforeEach(async () => {
    // restore original ENV value
    process.env.WS_MULTIPLE_ADDRESSES_ENABLED = originalWsMultipleAddressesEnabledValue;

    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    requestId = Utils.generateRequestId();
    // Stabilizes the initial connection test.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (server) expect(server._connections).to.equal(1);
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (server) expect(server._connections).to.equal(0);
  });

  describe('Connection', async function () {
    it('establishes connection', async function () {
      expect(wsProvider).to.exist;
      expect(wsProvider.ready).to.eq(true);
    });

    it('receives ping messages', async function () {
      expect(wsProvider).to.exist;
      expect(wsProvider.ready).to.eq(true);

      let pings = 0;
      wsProvider.websocket.on('message', (message) => {
        pings++;
      });

      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(pings).to.eq(3);
    });

    it('Socket server responds to the eth_chainId event', async function () {
      const response = await wsProvider.send('eth_chainId', []);
      expect(response).to.eq(CHAIN_ID);
    });

    it('Establishes multiple connections', async function () {
      const secondProvider = new ethers.WebSocketProvider(WS_RELAY_URL);

      const response = await secondProvider.send('eth_chainId', []);
      expect(response).to.eq(CHAIN_ID);
      expect(server._connections).to.equal(2);

      secondProvider.destroy();
    });

    it('Subscribe and Unsubscribe', async function () {
      // subscribe
      const subId = await wsProvider.send('eth_subscribe', ['logs', { address: logContractSigner.target }]);
      // unsubscribe
      const result = await wsProvider.send('eth_unsubscribe', [subId]);

      expect(subId).to.be.length(34);
      expect(subId.substring(0, 2)).to.be.eq('0x');
      expect(result).to.be.eq(true);
    });

    it('Subscribe and receive log event and unsubscribe', async function () {
      const loggerContractWS = new ethers.Contract(logContractSigner.target, LogContractJson.abi, wsProvider);
      let eventReceived;
      loggerContractWS.once('Log1', (val) => {
        eventReceived = val;
      });

      // perform an action on the SC that emits a Log1 event
      await logContractSigner.log1(100, await Utils.gasOptions(requestId));
      // wait 1s to expect the message
      await new Promise((resolve) => setTimeout(resolve, 4000));

      expect(eventReceived).to.be.eq(BigInt(100));
    });

    it('Multiple ws connections and multiple subscriptions per connection', async function () {
      const wsConn1 = new ethers.WebSocketProvider(`ws://localhost:${constants.WEB_SOCKET_PORT}`);

      const wsConn2 = new ethers.WebSocketProvider(`ws://localhost:${constants.WEB_SOCKET_PORT}`);

      // using WS providers with LoggerContract
      const loggerContractWS1 = new ethers.Contract(logContractSigner.target, LogContractJson.abi, wsConn1);
      const loggerContractWS2 = new ethers.Contract(logContractSigner.target, LogContractJson.abi, wsConn2);

      // subscribe to Log1 of LoggerContract for all connections
      let eventReceivedWS1;
      loggerContractWS1.once('Log1', (val) => {
        eventReceivedWS1 = val;
      });

      //Subscribe to Log3 of LoggerContract for 2 connections
      let param1Log3ReceivedWS2;
      let param2Log3ReceivedWS2;
      let param3Log3ReceivedWS2;
      loggerContractWS2.once('Log3', (val1, val2, val3) => {
        param1Log3ReceivedWS2 = val1;
        param2Log3ReceivedWS2 = val2;
        param3Log3ReceivedWS2 = val3;
      });

      //Generate the Logs.
      const gasOptions = await Utils.gasOptions(requestId);
      const tx1 = await logContractSigner.log1(100, gasOptions);
      await tx1.wait();
      const tx2 = await logContractSigner.log3(4, 6, 7, gasOptions);
      await tx2.wait();
      // wait 2s to expect the message
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // validate we received everything as expected
      expect(eventReceivedWS1).to.be.eq(BigInt(100));
      expect(param1Log3ReceivedWS2).to.be.eq(BigInt(4));
      expect(param2Log3ReceivedWS2).to.be.eq(BigInt(6));
      expect(param3Log3ReceivedWS2).to.be.eq(BigInt(7));

      // destroy all WS connections
      wsConn1.destroy();
      wsConn2.destroy();
    });

    it('When JSON is invalid, expect INVALID_REQUEST Error message', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      let response = '';
      webSocket.on('message', function incoming(data) {
        response = data;
      });
      webSocket.on('open', function open() {
        // send invalid JSON, missing closing bracket
        webSocket.send('{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1');
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(JSON.parse(response).code).to.eq(predefined.INVALID_REQUEST.code);
      expect(JSON.parse(response).name).to.eq(predefined.INVALID_REQUEST.name);
      expect(JSON.parse(response).message).to.eq(predefined.INVALID_REQUEST.message);

      webSocket.close();
    });

    // skip this test if using a remote relay since updating the env vars would not affect it
    if (global.relayIsLocal) {
      it('Subscribe to multiple contracts on same subscription', async function () {
        process.env.WS_MULTIPLE_ADDRESSES_ENABLED = 'true'; // enable feature flag for this test
        await new Promise((resolve) => setTimeout(resolve, 10000));

        const logContractSigner2 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
        const logContractSigner3 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
        const addressCollection = [logContractSigner.target, logContractSigner2.target, logContractSigner3.target];
        let subscriptionId = '';
        const webSocket = new WebSocket(WS_RELAY_URL);

        let latestEventFromSubscription;
        webSocket.on('message', function incoming(data) {
          const parsed = JSON.parse(data);
          if (parsed.id !== null || parsed.method) {
            if (subscriptionId == '') {
              subscriptionId = parsed.result;
            } else {
              latestEventFromSubscription = parsed;
            }
          }
        });

        webSocket.on('open', function open() {
          const request = `{"jsonrpc":"2.0","method":"eth_subscribe","params":["logs", {"address":${JSON.stringify(
            addressCollection,
          )}}],"id":1}`;
          webSocket.send(request);
        });
        await new Promise((resolve) => setTimeout(resolve, 500)); // wait for subscription to be created

        const gasOptions = await Utils.gasOptions(requestId, 500_000);

        // create event on contract 1
        const tx1 = await logContractSigner.log1(100, gasOptions);
        await tx1.wait();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for event to be received
        expect('1: ' + latestEventFromSubscription.params.result.address).to.be.eq(
          '1: ' + logContractSigner.target.toLowerCase(),
        );
        expect('1: ' + latestEventFromSubscription.params.subscription).to.be.eq('1: ' + subscriptionId);

        // create event on contract 2
        const tx2 = await logContractSigner2.log1(200, gasOptions);
        await tx2.wait();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for event to be received
        expect('2: ' + latestEventFromSubscription.params.result.address).to.be.eq(
          '2: ' + logContractSigner2.target.toLowerCase(),
        );
        expect('2: ' + latestEventFromSubscription.params.subscription).to.be.eq('2: ' + subscriptionId);

        // create event on contract 3
        const tx3 = await logContractSigner3.log1(300, gasOptions);
        await tx3.wait();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for event to be received
        expect('3: ' + latestEventFromSubscription.params.result.address).to.be.eq(
          '3: ' + logContractSigner3.target.toLowerCase(),
        );
        expect('3: ' + latestEventFromSubscription.params.subscription).to.be.eq('3: ' + subscriptionId);

        // close the connection
        webSocket.close();

        // wait for the connections to be closed
        await new Promise((resolve) => setTimeout(resolve, 500));
        process.env.WS_MULTIPLE_ADDRESSES_ENABLED = originalWsMultipleAddressesEnabledValue; // restore original value
      });
    }

    it('Subscribe to multiple contracts on same subscription Should fail with INVALID_PARAMETER due to feature flag disabled', async function () {
      process.env.WS_MULTIPLE_ADDRESSES_ENABLED = 'false'; // disable feature flag
      const logContractSigner2 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
      const addressCollection = [logContractSigner.target, logContractSigner2.target];
      const webSocket = new WebSocket(WS_RELAY_URL);
      const requestId = 3;
      webSocket.on('open', function open() {
        const request = `{"jsonrpc":"2.0","method":"eth_subscribe","params":["logs", {"address":${JSON.stringify(
          addressCollection,
        )}}],"id":${requestId}}`;
        webSocket.send(request);
      });
      let response;
      webSocket.on('message', function incoming(data) {
        response = JSON.parse(data);
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(response.id).to.be.eq(requestId);
      expect(response.error.code).to.be.eq(-32602);
      expect(response.error.name).to.be.eq('Invalid parameter');
      expect(response.error.message).to.be.eq(
        `Invalid parameter filters.address: Only one contract address is allowed`,
      );

      // post test clean-up
      webSocket.close();

      // wait 500 ms for the connection to be closed
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('Expect Unsupported Method Error message when subscribing for newHeads method', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      let response = {};
      webSocket.on('message', function incoming(data) {
        response = JSON.parse(data);
      });
      webSocket.on('open', function open() {
        webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"],"id":1}');
      });

      // wait 500ms to expect the message
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
      expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
      expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

      // close the connection
      webSocket.close();
    });

    it('Expect Unsupported Method Error message when subscribing for newPendingTransactions method', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      let response = {};
      webSocket.on('message', function incoming(data) {
        response = JSON.parse(data);
      });
      webSocket.on('open', function open() {
        webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["newPendingTransactions"],"id":1}');
      });

      // wait 500ms to expect the message
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
      expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
      expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

      // close the connection
      webSocket.close();
    });

    it('Expect Unsupported Method Error message when subscribing for "other" method', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      let response = {};
      webSocket.on('message', function incoming(data) {
        response = JSON.parse(data);
      });
      webSocket.on('open', function open() {
        webSocket.send('{"jsonrpc":"2.0","method":"eth_subscribe","params":["other"],"id":1}');
      });

      // wait 500ms to expect the message
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(response.error.code).to.eq(predefined.UNSUPPORTED_METHOD.code);
      expect(response.error.name).to.eq(predefined.UNSUPPORTED_METHOD.name);
      expect(response.error.message).to.eq(predefined.UNSUPPORTED_METHOD.message);

      // close the connection
      webSocket.close();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for the connection to be closed
    });

    it('Closes connections to the server on webSocket close', async function () {
      // start with the one existing connection to the server.
      expect(server._connections).to.equal(1);

      let provider = await establishConnection();
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(server._connections).to.equal(2);

      // subscribe
      let subId = await provider.send('eth_subscribe', ['logs', { address: logContractSigner.target }]);
      // unsubscribe
      let result = await unsubscribeAndCloseConnections(provider, subId);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(server._connections).to.equal(1);
      expect(result).to.be.true;

      // Let's try with 3 connections
      provider = await establishConnection();
      await new Promise((resolve) => setTimeout(resolve, 200));
      // subscribe
      subId = await provider.send('eth_subscribe', ['logs', { address: logContractSigner.target }]);
      expect(server._connections).to.equal(2);

      const provider2 = await establishConnection();
      await new Promise((resolve) => setTimeout(resolve, 200));
      // subscribe
      const subId2 = await provider.send('eth_subscribe', ['logs', { address: logContractSigner.target }]);
      expect(server._connections).to.equal(3);

      // unsubscribe
      result = await unsubscribeAndCloseConnections(provider2, subId2);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(server._connections).to.equal(2);

      // unsubscribe
      result = await unsubscribeAndCloseConnections(provider, subId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(server._connections).to.equal(1);
    });
  });

  describe('Connection limit', async function () {
    let originalWsMaxConnectionLimit,
      providers: ethers.WebSocketProvider[] = [];

    beforeEach(async () => {
      // cache original ENV values
      originalWsMaxConnectionLimit = process.env.WS_CONNECTION_LIMIT;
      process.env.WS_CONNECTION_LIMIT = 5;

      // We already have one connection
      expect(server._connections).to.equal(1);

      for (let i = 1; i < parseInt(process.env.WS_CONNECTION_LIMIT); i++) {
        providers.push(await establishConnection());
      }

      // Server is at max connections
      expect(server._connections).to.equal(parseInt(process.env.WS_CONNECTION_LIMIT));
    });

    afterEach(async () => {
      // Return ENV variables to their original value
      process.env.WS_CONNECTION_LIMIT = originalWsMaxConnectionLimit;

      for (const provider of providers) {
        await provider.destroy();
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(server._connections).to.equal(1);
    });

    it('Does not allow more connections than the connection limit', async function () {
      const excessProvider = new ethers.WebSocketProvider(WS_RELAY_URL);

      let closeEventHandled = false;
      excessProvider.websocket.on('close', (code, message) => {
        closeEventHandled = true;
        expect(code).to.equal(WebSocketError.CONNECTION_LIMIT_EXCEEDED.code);
        expect(message.toString('utf8')).to.equal(WebSocketError.CONNECTION_LIMIT_EXCEEDED.message);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(closeEventHandled).to.eq(true);
    });
  });

  describe('Connection TTL', async function () {
    let TEST_TTL = 5000;

    this.beforeAll(async () => {
      // cache original ENV values
      originalWsMaxInactivityTtl = process.env.WS_MAX_INACTIVITY_TTL || '300000';
      process.env.WS_MAX_INACTIVITY_TTL = TEST_TTL.toString();
    });
    this.afterAll(async () => {
      // Return ENV variables to their original value
      process.env.WS_MAX_INACTIVITY_TTL = originalWsMaxInactivityTtl;
    });

    it('Connection TTL is enforced, should close all connections', async function () {
      const wsConn2 = await new ethers.WebSocketProvider(WS_RELAY_URL);
      const wsConn3 = await new ethers.WebSocketProvider(WS_RELAY_URL);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for the connections to be established

      // we verify that we have 3 connections, since we already have one from the beforeEach hook (wsProvider)
      expect(server._connections).to.equal(3);

      let closeEventHandled2 = false;
      wsConn2.websocket.on('close', (code, message) => {
        closeEventHandled2 = true;
        expect(code).to.equal(WebSocketError.TTL_EXPIRED.code);
        expect(message.toString('utf8')).to.equal(WebSocketError.TTL_EXPIRED.message);
      });

      let closeEventHandled3 = false;
      wsConn3.websocket.on('close', (code, message) => {
        closeEventHandled3 = true;
        expect(code).to.equal(WebSocketError.TTL_EXPIRED.code);
        expect(message.toString('utf8')).to.equal(WebSocketError.TTL_EXPIRED.message);
      });

      await new Promise((resolve) => setTimeout(resolve, parseInt(process.env.WS_MAX_INACTIVITY_TTL) + 1000));

      expect(closeEventHandled2).to.eq(true);
      expect(closeEventHandled3).to.eq(true);
      expect(server._connections).to.equal(0);
    });

    describe('Connection TTL is reset', async function () {
      const initialWaitTime = 2000;
      let timeAtStart, closeEventHandled;

      beforeEach(async () => {
        timeAtStart = Date.now();

        closeEventHandled = false;
        wsProvider.websocket.on('close', (code, message) => {
          expect(code).to.equal(WebSocketError.TTL_EXPIRED.code);
          expect(message.toString('utf8')).to.equal(WebSocketError.TTL_EXPIRED.message);

          closeEventHandled = true;
          const timeAtDisconnect = Date.now();
          expect(timeAtDisconnect - timeAtStart).to.be.gte(TEST_TTL + initialWaitTime);
        });
      });

      afterEach(async () => {
        // wait for TTL to trigger + buffer time
        await new Promise((resolve) => setTimeout(resolve, TEST_TTL + 1000));
        expect(closeEventHandled).to.eq(true);
        // @ts-ignore
        wsProvider = false;
      });

      it('when the client sends a message', async function () {
        await new Promise((resolve) => setTimeout(resolve, initialWaitTime));

        const response = await wsProvider.send('eth_chainId', []);
        expect(response).to.eq(CHAIN_ID);
      });

      it('when the server sends a message', async function () {
        let eventCaptured = false;
        wsProvider.on({ address: logContractSigner.target }, function (data) {
          eventCaptured = true;
        });

        await new Promise((resolve) => setTimeout(resolve, initialWaitTime));
        const gasOptions = await Utils.gasOptions(requestId);
        const tx = await logContractSigner.log1(5, gasOptions);
        await tx.wait();

        // buffer time
        await new Promise((resolve) => setTimeout(resolve, 1000));

        expect(eventCaptured).to.eq(true);
      });
    });
  });

  describe('Subscribes to log events', async function () {
    let logContractSigner2, logContractSigner3, wsLogsProvider, contracts, cLen;
    let ANONYMOUS_LOG_DATA, topic1, topic2;
    let eventsReceivedGlobal: any[] = [];

    // Deploy several contracts
    before(async function () {
      wsLogsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);

      const logContractMirror = await mirrorNode.get(`/contracts/${logContractSigner.target}`, requestId);
      const logContractLongZeroAddress = Utils.idToEvmAddress(logContractMirror.contract_id);

      logContractSigner2 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);
      logContractSigner3 = await Utils.deployContractWithEthersV2([], LogContractJson, accounts[0].wallet);

      await createLogs(logContractSigner2, requestId);
      const mirrorLogs = await mirrorNode.get(`/contracts/${logContractSigner2.target}/results/logs`, requestId);

      expect(mirrorLogs).to.exist;
      expect(mirrorLogs.logs).to.exist;
      expect(mirrorLogs.logs.length).to.eq(5);

      ANONYMOUS_LOG_DATA = mirrorLogs.logs[4].data;
      topic1 = mirrorLogs.logs[3].topics[0];
      topic2 = mirrorLogs.logs[3].topics[1];

      const invalidTopic = '0x9999999999999999999999999999999999999999999999999999999999999999';

      const testFilters = [
        // currently, there is no way to gossip about all contract logs
        // ethers v6 .getSubscription() method expects "ProviderEvent" https://github.com/ethers-io/ethers.js/blob/main/src.ts/providers/abstract-provider.ts#L230
        // and "ProviderEvent" doesn't support '*' filter https://github.com/ethers-io/ethers.js/blob/main/src.ts/providers/provider.ts#L1781
        'debug',
        {
          address: logContractSigner.target,
        }, // logs from single contract with evm address
        {
          address: logContractLongZeroAddress,
        }, // logs from single contract with long zero address
        {
          topics: [topic1],
        }, // logs for topic emitted by several contracts
        {
          topics: [
            topic1, // emitted only by Log1 method
            topic2, // emitted by Log1 and Log2 methods
          ],
        }, // logs for multiple topics
        {
          address: logContractSigner2.target,
          topics: [
            topic1, // emitted only by Log1 method
            topic2, // emitted by Log1 and Log2 methods
          ],
        }, // logs filtered by multiple topics and single address
        {
          address: logContractSigner2.target,
          topics: [invalidTopic],
        }, // subscribing to valid address and invalid topic
      ];

      for (let i = 0; i < testFilters.length; i++) {
        eventsReceivedGlobal[i] = [];
        ((i) => {
          wsLogsProvider.on(testFilters[i], (event) => {
            eventsReceivedGlobal[i].push(event);
          });
        })(i);
      }

      contracts = [logContractSigner, logContractSigner2, logContractSigner3];
      cLen = contracts.length;

      // Create logs from all deployed contracts
      for (let i = 0; i < cLen; i++) {
        await createLogs(contracts[i], requestId);
      }

      await wsLogsProvider.websocket.close();
    });

    it('Subscribes for debug', async function () {
      await new Promise((r) => setTimeout(r, 2000));

      let eventsReceived = eventsReceivedGlobal[0];
      const subscriptionEvents = eventsReceived.filter((e) => e?.payload?.method === 'eth_subscribe');
      const receiveRpcResultEvents = eventsReceived.filter((e) => e?.action === 'receiveRpcResult');

      expect(eventsReceived.length).to.eq(12);
      expect(subscriptionEvents.length).to.equal(6);
      expect(receiveRpcResultEvents.length).to.equal(6);
    });

    it('Subscribes for contract logs for a specific contract address (using evmAddress)', async function () {
      let eventsReceived = eventsReceivedGlobal[1];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(5);

      assertions.expectAnonymousLog(eventsReceived[0], logContractSigner, ANONYMOUS_LOG_DATA);
      assertions.expectLogArgs(eventsReceived[1], logContractSigner, [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[2], logContractSigner, [BigInt(1), BigInt(2)]);
      assertions.expectLogArgs(eventsReceived[3], logContractSigner, [BigInt(10), BigInt(20), BigInt(31)]);
      assertions.expectLogArgs(eventsReceived[4], logContractSigner, [BigInt(11), BigInt(22), BigInt(33), BigInt(44)]);
    });

    it('Subscribes for contract logs for a specific contract address (using long zero address)', async function () {
      let eventsReceived = eventsReceivedGlobal[2];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(5);

      assertions.expectAnonymousLog(eventsReceived[0], logContractSigner, ANONYMOUS_LOG_DATA);
      assertions.expectLogArgs(eventsReceived[1], logContractSigner, [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[2], logContractSigner, [BigInt(1), BigInt(2)]);
      assertions.expectLogArgs(eventsReceived[3], logContractSigner, [BigInt(10), BigInt(20), BigInt(31)]);
      assertions.expectLogArgs(eventsReceived[4], logContractSigner, [BigInt(11), BigInt(22), BigInt(33), BigInt(44)]);
    });

    it('Subscribes for contract logs for a single topic', async function () {
      let eventsReceived = eventsReceivedGlobal[3];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(3);

      assertions.expectLogArgs(eventsReceived[0], contracts[0], [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[1], contracts[1], [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[2], contracts[2], [BigInt(1)]);
    });

    it('Subscribes for contract logs for multiple topics', async function () {
      let eventsReceived = eventsReceivedGlobal[4];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(3);

      assertions.expectLogArgs(eventsReceived[0], contracts[0], [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[1], contracts[1], [BigInt(1)]);
      assertions.expectLogArgs(eventsReceived[2], contracts[2], [BigInt(1)]);
    });

    it('Subscribes for contract logs for address and multiple topics', async function () {
      let eventsReceived = eventsReceivedGlobal[5];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(1);

      assertions.expectLogArgs(eventsReceived[0], contracts[1], [BigInt(1)]);
    });

    it('Subscribing for contract logs for a speciffic contract address and a wrong topic.', async function () {
      let eventsReceived = eventsReceivedGlobal[6];

      // Only the logs from logContractSigner.target are captured
      expect(eventsReceived.length).to.eq(0);
    });
  });

  describe('Subscribes to hts tokens and listens for synthetic log events', async function () {
    let htsToken,
      wsHtsProvider,
      htsAccounts = [],
      htsEventsReceived = [];

    before(async function () {
      htsAccounts[0] = await servicesNode.createAliasAccount(400, relay.provider, requestId);
      htsAccounts[1] = await servicesNode.createAliasAccount(200, relay.provider, requestId);
      htsAccounts[2] = await servicesNode.createAliasAccount(5, relay.provider, requestId);

      const htsResult = await servicesNode.createHTS({
        tokenName: 'TEST_TOKEN',
        symbol: 'TKN',
        treasuryAccountId: htsAccounts[0].accountId.toString(),
        initialSupply: 100000,
        adminPrivateKey: htsAccounts[0].privateKey,
      });

      await servicesNode.associateHTSToken(
        htsAccounts[1].accountId,
        htsResult.receipt.tokenId,
        htsAccounts[1].privateKey,
        htsResult.client,
        requestId,
      );
      await servicesNode.associateHTSToken(
        htsAccounts[2].accountId,
        htsResult.receipt.tokenId,
        htsAccounts[2].privateKey,
        htsResult.client,
        requestId,
      );

      const tokenAddress = Utils.idToEvmAddress(htsResult.receipt.tokenId.toString());
      htsToken = new ethers.Contract(tokenAddress, IERC20Json.abi, htsAccounts[0].wallet);
    });

    beforeEach(async function () {
      wsHtsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
      htsEventsReceived = [];
      wsHtsProvider.on(
        {
          address: htsToken.target,
        },
        (event) => {
          htsEventsReceived.push(event);
        },
      );
    });

    afterEach(async function () {
      await wsHtsProvider.websocket.close();
    });

    it('captures transfer events', async function () {
      const balanceBefore = await htsToken.balanceOf(htsAccounts[1].wallet.address);
      expect(balanceBefore.toString()).to.eq('0', 'verify initial balance');

      const tx = await htsToken.transfer(htsAccounts[1].wallet.address, 1, Constants.GAS.LIMIT_1_000_000);
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const balanceAfter = await htsToken.balanceOf(htsAccounts[1].wallet.address);
      expect(balanceAfter.toString()).to.eq('1', 'token is successfully transferred');

      expect(htsEventsReceived.length).to.eq(1, 'log is captured');
      assertions.expectLogArgs(htsEventsReceived[0], htsToken, [
        htsAccounts[0].wallet.address,
        htsAccounts[1].wallet.address,
        BigInt(1),
      ]);
    });

    it('captures approve and transferFrom events', async function () {
      const tx = await htsToken.approve(htsAccounts[1].wallet.address, 1, Constants.GAS.LIMIT_1_000_000);
      await tx.wait();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const allowance = await htsToken.allowance(htsAccounts[0].wallet.address, htsAccounts[1].wallet.address);
      expect(allowance.toString()).to.eq('1', 'token is successfully approved');

      const tx2 = await htsToken
        .connect(htsAccounts[1].wallet)
        .transferFrom(htsAccounts[0].wallet.address, htsAccounts[2].wallet.address, 1, Constants.GAS.LIMIT_1_000_000);
      await tx2.wait();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // FIXME enable assert when allowance bug is fixed in mirror node (expected to be fixed in v0.87)
      // const allowanceAfter = await htsToken.allowance(htsAccounts[0].wallet.address, htsAccounts[1].wallet.address);
      // expect(allowanceAfter.toString()).to.eq('0', 'token is successfully transferred');

      expect(htsEventsReceived.length).to.eq(2, 'logs are captured');

      assertions.expectLogArgs(htsEventsReceived[0], htsToken, [
        htsAccounts[0].wallet.address,
        htsAccounts[1].wallet.address,
        BigInt(1),
      ]);

      assertions.expectLogArgs(htsEventsReceived[1], htsToken, [
        htsAccounts[0].wallet.address,
        htsAccounts[2].wallet.address,
        BigInt(1),
      ]);
    });
  });

  describe('ethSubscribe Logs Params Validations', async function () {
    after(() => {
      // wait 500ms to let the server close the connections
      return new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('Calling eth_subscribe Logs with a non existent address should fail', async function () {
      const missingContract = '0xea4168c4cbb744ec22dea4a4bfc5f74b6fe27816';
      const expectedError = predefined.INVALID_PARAMETER(
        `filters.address`,
        `${missingContract} is not a valid contract or token type or does not exists`,
      );

      await Assertions.assertPredefinedRpcError(expectedError, wsProvider.send, true, wsProvider, [
        'eth_subscribe',
        ['logs', { address: missingContract }],
      ]);
    });

    it('Calling eth_subscribe Logs with an empty address should fail', async function () {
      const expectedError = predefined.INVALID_PARAMETER(
        `'address' for EthSubscribeLogsParamsObject`,
        `Expected 0x prefixed string representing the address (20 bytes) or an array of addresses, value: `,
      );
      const missingContract = '';

      await Assertions.assertPredefinedRpcError(expectedError, wsProvider.send, true, wsProvider, [
        'eth_subscribe',
        ['logs', { address: missingContract }],
      ]);
    });

    it('Calling eth_subscribe Logs with an invalid topics should fail', async function () {
      const expectedError = predefined.INVALID_PARAMETER(
        `'topics' for EthSubscribeLogsParamsObject`,
        `Expected an array or array of arrays containing 0x prefixed string representing the hash (32 bytes) of a topic, value: 0x000`,
      );

      await Assertions.assertPredefinedRpcError(expectedError, wsProvider.send, true, wsProvider, [
        'eth_subscribe',
        ['logs', { address: logContractSigner.target, topics: ['0x000'] }],
      ]);
    });
  });

  // skip this test if using a remote relay since updating the env vars would not affect it
  if (global.relayIsLocal) {
    describe('IP connection limits', async function () {
      let originalConnectionLimitPerIp;

      before(() => {
        originalConnectionLimitPerIp = process.env.WS_CONNECTION_LIMIT_PER_IP;
        process.env.WS_CONNECTION_LIMIT_PER_IP = 3;
      });

      after(() => {
        process.env.WS_CONNECTION_LIMIT_PER_IP = originalConnectionLimitPerIp;
      });

      it('Does not allow more connections from the same IP than the specified limit', async function () {
        const providers = [];

        // Creates the maximum allowed connections
        for (let i = 1; i < parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP); i++) {
          providers.push(await new ethers.WebSocketProvider(WS_RELAY_URL));
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Repeat the following several times to make sure the internal counters are consistently correct
        for (let i = 0; i < 3; i++) {
          expect(server._connections).to.equal(parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP));

          // The next connection should be closed by the server
          const provider = await new ethers.WebSocketProvider(WS_RELAY_URL);

          let closeEventHandled = false;
          provider.websocket.on('close', (code, message) => {
            closeEventHandled = true;
            expect(code).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.code);
            expect(message.toString('utf8')).to.equal(WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED.message);
          });

          await new Promise((resolve) => setTimeout(resolve, 1000));
          expect(server._connections).to.equal(parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP));
          expect(closeEventHandled).to.eq(true);

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        for (const p of providers) {
          await p.destroy();
        }
      });
    });

    describe('Connection subscription limits', async function () {
      let originalSubsPerConnection;

      before(() => {
        originalSubsPerConnection = process.env.WS_SUBSCRIPTION_LIMIT;
        process.env.WS_SUBSCRIPTION_LIMIT = 2;
      });

      after(() => {
        process.env.WS_SUBSCRIPTION_LIMIT = originalSubsPerConnection;
      });

      it('Does not allow more subscriptions per connection than the specified limit', async function () {
        let errorsHandled = 0;

        // Create different subscriptions
        for (let i = 0; i < 3; i++) {
          if (i === 2) {
            const expectedError = predefined.MAX_SUBSCRIPTIONS;
            await Assertions.assertPredefinedRpcError(expectedError, wsProvider.send, true, wsProvider, [
              'eth_subscribe',
              [
                'logs',
                {
                  address: logContractSigner.target,
                  topics: [topics[i]],
                },
              ],
            ]);
          } else {
            await wsProvider.send('eth_subscribe', [
              'logs',
              {
                address: logContractSigner.target,
                topics: [topics[i]],
              },
            ]);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      it('Calling eth_unsubscribe decrements the internal counters', async function () {
        let errorsHandled = 0;

        // Create different subscriptions
        for (let i = 0; i < 3; i++) {
          try {
            const subId = await wsProvider.send('eth_subscribe', [
              'logs',
              {
                address: logContractSigner.target,
                topics: [topics[i]],
              },
            ]);

            await wsProvider.send('eth_unsubscribe', [subId]);
          } catch (e: any) {
            errorsHandled++;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(errorsHandled).to.eq(0);
      });
    });
  }
});
