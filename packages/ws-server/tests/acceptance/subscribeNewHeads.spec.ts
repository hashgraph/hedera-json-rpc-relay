/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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
import WebSocket from 'ws';
import { ethers } from 'ethers';
import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { predefined } from '@hashgraph/json-rpc-relay';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import Assertions from '@hashgraph/json-rpc-server/tests/helpers/assertions';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
chai.use(solidity);

const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
const ethAddressRegex = /^0x[a-fA-F0-9]*$/;

function verifyResponse(response: any, done: Mocha.Done, webSocket: any, includeTransactions: boolean) {
  if (response?.params?.result?.transactions?.length > 0) {
    try {
      expect(response).to.have.property('jsonrpc', '2.0');
      expect(response).to.have.property('method', 'eth_subscription');
      expect(response).to.have.property('params');
      expect(response.params).to.have.property('result');
      expect(response.params.result).to.have.property('difficulty');
      expect(response.params.result).to.have.property('extraData');
      expect(response.params.result).to.have.property('gasLimit');
      expect(response.params.result).to.have.property('gasUsed');
      expect(response.params.result).to.have.property('logsBloom');
      expect(response.params.result).to.have.property('miner');
      expect(response.params.result).to.have.property('nonce');
      expect(response.params.result).to.have.property('number');
      expect(response.params.result).to.have.property('parentHash');
      expect(response.params.result).to.have.property('receiptsRoot');
      expect(response.params.result).to.have.property('sha3Uncles');
      expect(response.params.result).to.have.property('stateRoot');
      expect(response.params.result).to.have.property('timestamp');
      expect(response.params.result).to.have.property('transactionsRoot');
      expect(response.params.result).to.have.property('hash');
      expect(response.params).to.have.property('subscription');

      if (includeTransactions) {
        expect(response.params.result).to.have.property('transactions');
        expect(response.params.result.transactions).to.have.lengthOf(1);
        expect(response.params.result.transactions[0]).to.have.property('hash');
        expect(response.params.result.transactions[0]).to.have.property('nonce');
        expect(response.params.result.transactions[0]).to.have.property('blockHash');
        expect(response.params.result.transactions[0]).to.have.property('blockNumber');
        expect(response.params.result.transactions[0]).to.have.property('transactionIndex');
        expect(response.params.result.transactions[0]).to.have.property('from');
        expect(response.params.result.transactions[0]).to.have.property('to');
        expect(response.params.result.transactions[0]).to.have.property('value');
        expect(response.params.result.transactions[0]).to.have.property('gas');
        expect(response.params.result.transactions[0]).to.have.property('gasPrice');
        expect(response.params.result.transactions[0]).to.have.property('input');
        expect(response.params.result.transactions[0]).to.have.property('v');
        expect(response.params.result.transactions[0]).to.have.property('r');
        expect(response.params.result.transactions[0]).to.have.property('s');
        expect(response.params.result.transactions[0]).to.have.property('type');
        expect(response.params.result.transactions[0]).to.have.property('maxFeePerGas');
        expect(response.params.result.transactions[0]).to.have.property('maxPriorityFeePerGas');
        expect(response.params.result.transactions[0]).to.have.property('chainId');
      } else {
        expect(response.params.result).to.have.property('transactions');
        expect(response.params.result.transactions).to.have.lengthOf(1);
        expect(response.params.result.transactions[0]).to.match(ethAddressRegex);
      }
      done();
    } catch (error) {
      webSocket.close();
      done(error);
    }
  }
}

describe('@web-socket-batch-3 eth_subscribe newHeads', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const accounts: AliasAccount[] = [];
  const CHAIN_ID = process.env.CHAIN_ID || 0;
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));

  let mirrorNodeServer, requestId, rpcServer, wsServer;

  let wsProvider;
  let originalWsNewHeadsEnabledValue, originalWsSubcriptionLimitValue;

  before(async () => {
    // @ts-ignore
    const { socketServer, mirrorNode, relay } = global;
    mirrorNodeServer = mirrorNode;
    rpcServer = relay;
    wsServer = socketServer;

    requestId = Utils.generateRequestId();
    const initialAccount: AliasAccount = global.accounts[0];
    const initialAmount: string = '5000000000'; //50 Hbar

    const neededAccounts: number = 2;
    accounts.push(
      ...(await Utils.createMultipleAliasAccounts(
        mirrorNode,
        initialAccount,
        neededAccounts,
        initialAmount,
        requestId,
      )),
    );
    global.accounts.push(...accounts);

    // cache original ENV values
    originalWsNewHeadsEnabledValue = process.env.WS_NEW_HEADS_ENABLED;
    originalWsSubcriptionLimitValue = process.env.WS_SUBSCRIPTION_LIMIT;
  });

  beforeEach(async () => {
    process.env.WS_NEW_HEADS_ENABLED = originalWsNewHeadsEnabledValue;
    process.env.WS_SUBSCRIPTION_LIMIT = '10';

    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    process.env.WS_SUBSCRIPTION_LIMIT = originalWsSubcriptionLimitValue;
  });

  describe('Configuration', async function () {
    it('Should return unsupported method when WS_NEW_HEADS_ENABLED is set to false', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      process.env.WS_NEW_HEADS_ENABLED = 'false';
      const messagePromise = new Promise<void>((resolve, reject) => {
        webSocket.on('message', function incoming(data) {
          try {
            const response = JSON.parse(data);
            expect(response).to.have.property('error');
            expect(response.error).to.have.property('code');
            expect(response.error.code).to.equal(-32601);
            expect(response.error).to.have.property('message');
            expect(response.error.message).to.equal('Unsupported JSON-RPC method');
            expect(response.error).to.have.property('name');
            expect(response.error.name).to.equal('Method not found');
            resolve();
          } catch (error) {
            reject(error);
          }
        });
        webSocket.on('open', function open() {
          // send the request for newHeads
          webSocket.send('{"id":1,"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"]}');
        });
        webSocket.on('error', (error) => {
          reject(error); // Reject the promise on WebSocket error
        });
      });
      await messagePromise;

      webSocket.close();
      process.env.WS_NEW_HEADS_ENABLED = originalWsNewHeadsEnabledValue;
    });

    it('Does not allow more subscriptions per connection than the specified limit with newHeads', async function () {
      process.env.WS_SUBSCRIPTION_LIMIT = '2';
      process.env.WS_NEW_HEADS_ENABLED = 'true';
      // Create different subscriptions
      for (let i = 0; i < 3; i++) {
        if (i === 2) {
          const expectedError = predefined.MAX_SUBSCRIPTIONS;
          await Assertions.assertPredefinedRpcError(expectedError, wsProvider.send, true, wsProvider, [
            'eth_subscribe',
            ['newHeads'],
          ]);
        } else {
          await wsProvider.send('eth_subscribe', ['newHeads']);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      process.env.WS_NEW_HEADS_ENABLED = originalWsNewHeadsEnabledValue;
    });

    it('@release should subscribe to newHeads even when WS_NEW_HEADS_ENABLED=undefined, and receive a valid JSON RPC response', async (done) => {
      delete process.env.WS_NEW_HEADS_ENABLED;
      expect(process.env.WS_NEW_HEADS_ENABLED).to.be.undefined;

      const webSocket = new WebSocket(WS_RELAY_URL);
      const subscriptionId = 1;
      webSocket.on('open', function open() {
        webSocket.send(
          JSON.stringify({
            id: subscriptionId,
            jsonrpc: '2.0',
            method: 'eth_subscribe',
            params: ['newHeads', { includeTransactions: true }],
          }),
        );
      });

      let responseCounter = 0;

      Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, rpcServer, requestId, mirrorNodeServer);
      webSocket.on('message', function incoming(data) {
        const response = JSON.parse(data);
        responseCounter++;
        verifyResponse(response, done, webSocket, true);
        if (responseCounter > 1) {
          webSocket.close();
        }
      });
      done();
    });
  });

  describe('Subscriptions for newHeads', async function () {
    this.beforeEach(() => {
      process.env.WS_NEW_HEADS_ENABLED = 'true';
    });

    it('should subscribe to newHeads, include transactions true, and receive a valid JSON RPC response', (done) => {
      const webSocket = new WebSocket(WS_RELAY_URL);
      const subscriptionId = 1;
      webSocket.on('open', function open() {
        webSocket.send(
          JSON.stringify({
            id: subscriptionId,
            jsonrpc: '2.0',
            method: 'eth_subscribe',
            params: ['newHeads', { includeTransactions: true }],
          }),
        );
      });

      let responseCounter = 0;

      Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, rpcServer, requestId, mirrorNodeServer);
      webSocket.on('message', function incoming(data) {
        const response = JSON.parse(data);

        responseCounter++;
        verifyResponse(response, done, webSocket, true);
        if (responseCounter > 1) {
          webSocket.close();
          done();
        }
      });
    });

    it('should subscribe to newHeads, without the "include transactions", and receive a valid JSON RPC response', (done) => {
      const webSocket = new WebSocket(WS_RELAY_URL);
      const subscriptionId = 1;
      webSocket.on('open', function open() {
        webSocket.send(
          JSON.stringify({
            id: subscriptionId,
            jsonrpc: '2.0',
            method: 'eth_subscribe',
            params: ['newHeads'],
          }),
        );
      });

      let responseCounter = 0;

      Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, rpcServer, requestId, mirrorNodeServer);
      webSocket.on('message', function incoming(data) {
        const response = JSON.parse(data);

        responseCounter++;
        verifyResponse(response, done, webSocket, false);
        if (responseCounter > 1) {
          webSocket.close();
          done();
        }
      });
    });

    it('should subscribe to newHeads, with "include transactions false", and receive a valid JSON RPC response', (done) => {
      const webSocket = new WebSocket(WS_RELAY_URL);
      const subscriptionId = 1;
      webSocket.on('open', function open() {
        webSocket.send(
          JSON.stringify({
            id: subscriptionId,
            jsonrpc: '2.0',
            method: 'eth_subscribe',
            params: ['newHeads', { includeTransactions: false }],
          }),
        );
      });

      let responseCounter = 0;

      Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, rpcServer, requestId, mirrorNodeServer);
      webSocket.on('message', function incoming(data) {
        const response = JSON.parse(data);

        responseCounter++;
        verifyResponse(response, done, webSocket, false);
        if (responseCounter > 1) {
          webSocket.close();
          done();
        }
      });
    });
  });
});
