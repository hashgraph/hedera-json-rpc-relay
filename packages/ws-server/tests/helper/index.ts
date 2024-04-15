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

import WebSocket from 'ws';
import { expect } from 'chai';
import { WebSocketProvider } from 'ethers';

export class WsTestHelper {
  static async assertFailInvalidParamsEthersWsProvider(
    wsProvider: WebSocketProvider,
    methodName: string,
    params: any[],
  ) {
    try {
      await wsProvider.send(methodName, params);
      expect(true).to.eq(false);
    } catch (error) {
      if (error.info) error = error.info;
      expect(error.error).to.exist;
      expect(error.error.code).to.eq(-32602);
    }
  }

  static async sendRequestToStandardWebSocket(method: string, params: any[], ms?: number | undefined) {
    const webSocket = new WebSocket(WsTestConstant.WS_RELAY_URL);

    let response: any;

    webSocket.on('open', () => {
      webSocket.send(JSON.stringify(WsTestHelper.prepareJsonRpcObject(method, params)));
    });

    webSocket.on('message', (data: string) => {
      response = JSON.parse(data);
    });

    while (!response) {
      await new Promise((resolve) => setTimeout(resolve, ms || 100));
    }

    webSocket.close();
    return response;
  }

  static async assertFailInvalidParamsStandardWebSocket(method: string, params: any[]) {
    const response = await WsTestHelper.sendRequestToStandardWebSocket(method, params);
    WsTestHelper.assertJsonRpcObject(response);
    expect(response.error).to.exist;
    expect(response.error.code).to.eq(-32602);
  }

  static assertJsonRpcObject(obj: any) {
    expect(obj).to.exist;
    expect(obj.id).to.eq(1);
    expect(obj.jsonrpc).to.eq('2.0');
  }

  static prepareJsonRpcObject(method: string, params: any[]) {
    return {
      id: 1,
      jsonrpc: '2.0',
      method,
      params,
    };
  }
}

export class WsTestConstant {
  static FAKE_TX_HASH = `0x${'00'.repeat(20)}`;
  static STANDARD_WEB_SOCKET = 'Standard Web Socket';
  static ETHERS_WS_PROVIDER = 'Ethers Web Socket Provider';
  static WS_RELAY_URL = process.env.WS_RELAY_URL || `ws://127.0.0.1:8546`;
}
