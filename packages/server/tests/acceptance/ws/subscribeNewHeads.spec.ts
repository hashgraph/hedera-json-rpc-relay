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

const createSubscription = (ws, subscriptionId) => {
  return new Promise((resolve, reject) => {
    ws.on('message', function incoming(data) {
      const response = JSON.parse(data);
      if (response.id === subscriptionId && response.result) {
        console.log(`Subscription ${subscriptionId} successful with ID: ${response.result}`);
        resolve(response.result); // Resolve with the subscription ID
      } else if (response.method === 'eth_subscription') {
        console.log(`Subscription ${subscriptionId} received block:`, response.params.result);
        // You can add more logic here to handle incoming blocks
      }
    });

    ws.on('open', function open() {
      ws.send(
        JSON.stringify({
          id: subscriptionId,
          jsonrpc: '2.0',
          method: 'eth_subscribe',
          params: ['newHeads'],
        }),
      );
    });

    ws.on('error', (error) => {
      reject(error);
    });
  });
};

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
    });
  });
});
