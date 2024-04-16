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
import { expect } from 'chai';
import { ethers, WebSocketProvider } from 'ethers';
import { WsTestConstant, WsTestHelper } from '../helper';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/clients/servicesClient';

describe('@release @web-socket eth_getBalance', async function () {
  const METHOD_NAME = 'eth_getBalance';
  const INVALID_PARAMS = [
    [],
    [false],
    [WsTestConstant.FAKE_TX_HASH],
    ['0xhbar', 'latest'],
    ['0xhedera', 'latest'],
    [WsTestConstant.FAKE_TX_HASH, true, 39],
    [WsTestConstant.FAKE_TX_HASH, '0xhedera'],
    [WsTestConstant.FAKE_TX_HASH, '0xhbar', 36],
  ];

  let accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    accounts[0] = await global.servicesNode.createAliasAccount(100, global.relay.provider);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts[0] to propagate
  });

  beforeEach(async () => {
    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to be closed after all
    expect(global.socketServer._connections).to.eq(0);
  });

  describe(WsTestConstant.STANDARD_WEB_SOCKET, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsStandardWebSocket(METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} and handle valid requests correctly`, async () => {
      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [accounts[0].address, 'latest']);
      WsTestHelper.assertJsonRpcObject(response);

      const expectedResult = await global.relay.call(METHOD_NAME, [accounts[0].address, 'latest']);
      expect(response.result).to.eq(expectedResult);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
      const expectedResult = await global.relay.call(METHOD_NAME, [accounts[0].address, 'latest']);
      const result = await ethersWsProvider.send(METHOD_NAME, [accounts[0].address, 'latest']);
      expect(result).to.eq(expectedResult);
    });
  });
});
