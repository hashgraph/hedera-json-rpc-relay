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
import { solidity } from 'ethereum-waffle';
import chai, { expect } from 'chai';
import WebSocket from 'ws';
chai.use(solidity);

import { ethers } from 'ethers';
import Assertions from '../../helpers/assertions';
import { predefined } from '@hashgraph/json-rpc-relay';
const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;

describe('@web-socket Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds

  let server;

  let wsProvider;
  let originalWsNewHeadsEnabledValue, originalWsSubcriptionLimitValue;

  before(async () => {
    const { socketServer } = global;
    server = socketServer;

    // cache original ENV values
    originalWsNewHeadsEnabledValue = process.env.WS_NEW_HEADS_ENABLED;
    originalWsSubcriptionLimitValue = process.env.WS_SUBSCRIPTION_LIMIT;
  });

  beforeEach(async () => {
    process.env.WS_NEW_HEADS_ENABLED = originalWsNewHeadsEnabledValue;

    process.env.WS_SUBSCRIPTION_LIMIT = '10';

    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (server) expect(server._connections).to.equal(1);
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (server) expect(server._connections).to.equal(0);
    process.env.WS_SUBSCRIPTION_LIMIT = originalWsSubcriptionLimitValue;
  });

  describe('Configuration', async function () {
    it('Should return unsupported method when WS_NEW_HEADS_ENABLED is set to false', async function () {
      const webSocket = new WebSocket(WS_RELAY_URL);
      process.env.WS_NEW_HEADS_ENABLED = 'false';
      let response = '';
      const messagePromise = new Promise((resolve, reject) => {
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
          response = data;
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
    });
  });

  describe('Subscriptions for newHeads', async function () {
    it('should subscribe to newHeads and receive a valid JSON RPC response', (done) => {
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
      webSocket.on('message', function incoming(data) {
        const response = JSON.parse(data);
        console.log(`responseCounter: ${responseCounter}, response: ${JSON.stringify(response)}`);
        responseCounter++;
        try {
          // Validate the structure of the JSON RPC response
          // first response is the subscription ID
          if (responseCounter === 1) {
            expect(response).to.have.property('jsonrpc', '2.0');
            expect(response).to.have.property('id', 1);
            expect(response).to.have.property('result'); // Subscription ID
            // Ensure the result is a non-empty string (a valid subscription ID)
            expect(response.result).to.be.a('string').that.is.not.empty;
          } else {
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
          }

          if (responseCounter > 1) {
            // Test is done
            webSocket.close();
            done();
          }
        } catch (error) {
          webSocket.close();
          done(error);
        }
      });

      webSocket.on('error', (error) => {
        done(error);
      });
    });
  });
});
