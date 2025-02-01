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

import WebSocket from 'ws';
import { expect } from 'chai';
import { WebSocketProvider } from 'ethers';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { ConfigServiceTestHelper } from '../../../config-service/tests/configServiceTestHelper';

export class WsTestHelper {
  static async assertFailInvalidParamsEthersWsProvider(
    wsProvider: WebSocketProvider,
    methodName: string,
    params: any[],
  ) {
    try {
      await wsProvider.send(methodName, params);
      expect(true).to.eq(false);
    } catch (error: any) {
      if (error.info) error = error.info;
      expect(error.error).to.exist;
      expect(error.error.code).to.be.oneOf([-32602, -32603]);
    }
  }

  static async sendRequestToStandardWebSocket(method: string, params: any, ms?: number | undefined) {
    const BATCH_REQUEST_METHOD_NAME = 'batch_request';
    const webSocket = new WebSocket(WsTestConstant.WS_RELAY_URL);

    let response: any;

    if (method === BATCH_REQUEST_METHOD_NAME) {
      webSocket.on('open', () => {
        webSocket.send(JSON.stringify(params));
      });
    } else {
      webSocket.on('open', () => {
        webSocket.send(JSON.stringify(WsTestHelper.prepareJsonRpcObject(method, params)));
      });
    }

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
    expect(response.error.code).to.be.oneOf([-32602, -32603]);
  }

  static assertJsonRpcObject(obj: any) {
    expect(obj).to.exist;
    expect(obj.id).to.eq(1);
    expect(obj.jsonrpc).to.eq('2.0');
    expect(obj.method).to.not.exist; // Should not have method field in response for standard non-subscription methods
  }

  static prepareJsonRpcObject(method: string, params: any[]) {
    return {
      id: 1,
      jsonrpc: '2.0',
      method,
      params,
    };
  }

  /**
   * Temporarily overrides environment variables for the duration of the encapsulating describe block.
   * @param envs - An object containing key-value pairs of environment variables to set.
   *
   * @example
   * describe('given TEST is set to false', () => {
   *   overrideEnvsInMochaDescribe({ TEST: false });
   *
   *   it('should return false', () => {
   *     expect(ConfigService.get('TEST')).to.equal(false);
   *   });
   * });
   *
   * it('should return true', () => {
   *   expect(ConfigService.get('TEST')).to.equal(true);
   * });
   */
  static overrideEnvsInMochaDescribe(envs: NodeJS.Dict<any>) {
    let envsToReset: NodeJS.Dict<string> = {};

    const overrideEnv = (key: string, value: any) => {
      if (value === undefined) {
        ConfigServiceTestHelper.remove(key);
      } else {
        ConfigServiceTestHelper.dynamicOverride(key, value);
      }
    };

    before(() => {
      for (const key in envs) {
        // @ts-ignore
        envsToReset[key] = ConfigService.get(key);
        overrideEnv(key, envs[key]);
      }
    });

    after(() => {
      for (const key in envs) {
        overrideEnv(key, envsToReset[key]);
      }
    });
  }

  /**
   * Overrides environment variables for the duration of the provided tests.
   *
   * @param {NodeJS.Dict<string>} envs - An object containing key-value pairs of environment variables to set.
   * @param {Function} tests - A function containing the tests to run with the overridden environment variables.
   *
   * @example
   * withOverriddenEnvsInMochaTest({ TEST: false }, () => {
   *   it('should return false', () => {
   *     expect(ConfigService.get('TEST')).to.equal(false);
   *   });
   * });
   *
   * it('should return true', () => {
   *   expect(ConfigService.get('TEST')).to.equal(true);
   * });
   */
  static withOverriddenEnvsInMochaTest(envs: NodeJS.Dict<any>, tests: () => void) {
    const overriddenEnvs = Object.entries(envs)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    describe(`given ${overriddenEnvs} are set`, () => {
      WsTestHelper.overrideEnvsInMochaDescribe(envs);

      tests();
    });
  }
}

export class WsTestConstant {
  public static readonly FAKE_TX_HASH = `0x${'00'.repeat(20)}`;
  public static readonly STANDARD_WEB_SOCKET = 'Standard Web Socket';
  public static readonly ETHERS_WS_PROVIDER = 'Ethers Web Socket Provider';
  public static readonly WS_RELAY_URL = ConfigService.get('WS_RELAY_URL');
}
