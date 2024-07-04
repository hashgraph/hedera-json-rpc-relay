/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

describe('@web-socket-batch-1 eth_getBlockByHash', async function () {
  const METHOD_NAME = 'eth_getBlockByHash';
  const INVALID_PARAMS = [
    [],
    ['0xhbar', false],
    ['0xhedera', true],
    [WsTestConstant.FAKE_TX_HASH],
    [WsTestConstant.FAKE_TX_HASH, '54'],
    [WsTestConstant.FAKE_TX_HASH, '0xhbar'],
    [WsTestConstant.FAKE_TX_HASH, true, 39],
    [WsTestConstant.FAKE_TX_HASH, false, 39],
  ];

  let ethersWsProvider: WebSocketProvider;

  beforeEach(async () => {
    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to be closed after all
    if (global && global.socketServer) {
      expect(global.socketServer._connections).to.eq(0);
    }
  });

  describe(WsTestConstant.STANDARD_WEB_SOCKET, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail eth_getBlockByHash on Standard Web Socket and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsStandardWebSocket(METHOD_NAME, params);
      });
    }

    it(`@release Should execute eth_getBlockByHash on Standard Web Socket and handle valid requests correctly`, async () => {
      const expectedResult = await global.relay.call('eth_getBlockByNumber', ['latest', true]);
      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [expectedResult.hash, true]);
      WsTestHelper.assertJsonRpcObject(response);
      expect(response.result).to.deep.eq(expectedResult);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail eth_getBlockByHash on Ethers Web Socket Provider and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`@release Should execute eth_getBlockByHash on Ethers Web Socket Provider and handle valid requests correctly`, async () => {
      const expectedResult = await global.relay.call('eth_getBlockByNumber', ['latest', true]);
      const result = await ethersWsProvider.send(METHOD_NAME, [expectedResult.hash, true]);
      expect(result).to.deep.eq(expectedResult);
    });
  });
});
