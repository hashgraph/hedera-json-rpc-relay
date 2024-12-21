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
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { predefined } from '@hashgraph/json-rpc-relay/dist';
import { expect } from 'chai';
import { ethers, WebSocketProvider } from 'ethers';

import { ConfigName } from '../../../config-service/src/services/configName';
import { WsTestConstant, WsTestHelper } from '../helper';

describe('@web-socket-batch-request Batch Requests', async function () {
  const METHOD_NAME = 'batch_request';
  let ethersWsProvider: WebSocketProvider;
  let batchRequests: any = [];

  before(async () => {
    batchRequests = [
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      },
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
      },
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [global.accounts[0].address, 'latest'],
      },
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: ['0xhedera', 'latest'], // invalid param
      },
      {
        id: 1,
        jsonrpc: '2.0',
        method: 'getLogs', // invalid method
        params: [],
      },
    ];
  });

  beforeEach(async () => {
    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to the WS server to be closed after all
    if (global && global.socketServer) {
      if (global && global.socketServer) {
        expect(global.socketServer._connections).to.eq(0);
      }
    }
  });

  WsTestHelper.withOverriddenEnvsInMochaTest({ WS_BATCH_REQUESTS_ENABLED: true }, () => {
    it(`@release Should submit batch requests to WS server using Standard Web Socket and retrieve batch responses`, async () => {
      // call batch request
      const batchResponses = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, batchRequests);

      // individually process each request
      let promises: any = [];
      batchRequests.forEach((request: any) => {
        promises.push(WsTestHelper.sendRequestToStandardWebSocket(request.method, request.params));
      });
      const individualResponses = await Promise.all(promises);

      expect(batchResponses).to.deep.eq(individualResponses);
    });

    WsTestHelper.withOverriddenEnvsInMochaTest({ WS_BATCH_REQUESTS_MAX_SIZE: 1 }, () => {
      it('Should submit batch requests to WS server and get batchRequestAmountMaxExceed if requests size exceeds WS_BATCH_REQUESTS_MAX_SIZE', async () => {
        const batchResponses = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, batchRequests);

        const expectedError = predefined.BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED(
          batchRequests.length,
          Number(ConfigService.get(ConfigName.WS_BATCH_REQUESTS_MAX_SIZE)),
        );
        delete expectedError.data;

        expect(batchResponses[0].error).to.deep.eq(expectedError);
      });
    });
  });

  WsTestHelper.withOverriddenEnvsInMochaTest({ WS_BATCH_REQUESTS_ENABLED: false }, () => {
    it('Should submit batch requests to WS server and get batchRequestDisabledError if WS_BATCH_REQUESTS_DISABLED=false ', async () => {
      const batchResponses = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, batchRequests);

      const expectedError = predefined.WS_BATCH_REQUESTS_DISABLED;
      delete expectedError.data;

      expect(batchResponses[0].error).to.deep.eq(expectedError);
    });
  });
});
