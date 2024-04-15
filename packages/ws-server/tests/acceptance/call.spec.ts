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
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import ERC20MockJson from '@hashgraph/json-rpc-server/tests/contracts/ERC20Mock.json';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/clients/servicesClient';

describe('@release @web-socket eth_call', async function () {
  const METHOD_NAME = 'eth_call';
  const INVALID_PARAMS = [
    ['{}', false, '0x0'],
    ["{ to: '0xabcdef', data: '0x1a2b3c4d' }", 36, ''],
  ];

  const INVALID_TX_INFO = [
    [{ to: 123, data: '0x18160ddd' }, 'latest'],
    [{ to: '0x', data: '0x18160ddd' }, 'latest'],
    [{ to: '0xabcdef', data: '0x18160ddd' }, 'latest'],
  ];

  const TOKEN_NAME = Utils.randomString(10);
  const TOKEN_SYMBOL = Utils.randomString(5);
  const TOKEN_INIT_SUPPLY = 10000n;

  const VALID_DATA = [
    {
      sighash: '0x06fdde03',
      output: TOKEN_NAME,
    },
    {
      sighash: '0x95d89b41',
      output: TOKEN_SYMBOL,
    },
    {
      sighash: '0x18160ddd',
      output: TOKEN_INIT_SUPPLY,
    },
  ];

  let requestId: string,
    erc20TokenAddr: string,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider,
    erc20EtherInterface: ethers.Interface;

  before(async () => {
    accounts[0] = await global.servicesNode.createAliasAccount(100, global.relay.provider, requestId);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts[0] to propagate

    const erc20Contract = await Utils.deployContractWithEthers(
      [TOKEN_NAME, TOKEN_SYMBOL, accounts[0].address, TOKEN_INIT_SUPPLY],
      ERC20MockJson,
      accounts[0].wallet,
      global.relay,
    );

    erc20TokenAddr = await erc20Contract.getAddress();
    erc20EtherInterface = new ethers.Interface(ERC20MockJson.abi);
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

    for (const params of INVALID_TX_INFO) {
      it(`Should fail ${METHOD_NAME} on ${
        WsTestConstant.STANDARD_WEB_SOCKET
      } and handle invalid TX_INFO. params=[${JSON.stringify(params)}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsStandardWebSocket(METHOD_NAME, params);
      });
    }

    for (const data of VALID_DATA) {
      it(`Should execute ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} and handle valid requests correctly`, async () => {
        const tx = {
          to: erc20TokenAddr,
          data: data.sighash,
        };

        const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [tx, 'latest']);
        WsTestHelper.assertJsonRpcObject(response);

        const outputASCII = erc20EtherInterface.decodeFunctionResult(
          erc20EtherInterface.getFunction(data.sighash)!,
          response.result,
        );
        expect(outputASCII[0]).to.eq(data.output);
      });
    }
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    for (const params of INVALID_TX_INFO) {
      it(`Should fail ${METHOD_NAME} on ${
        WsTestConstant.ETHERS_WS_PROVIDER
      } and handle invalid TX_INFO. params=[${JSON.stringify(params)}]`, async () => {
        try {
          await ethersWsProvider.send(METHOD_NAME, params);
          expect(true).to.eq(false);
        } catch (error) {
          expect(error).to.exist;
          expect(error.argument).to.eq('address');
          expect(error.code).to.eq('INVALID_ARGUMENT');
          expect(error.shortMessage).to.eq('invalid address');
        }
      });
    }

    for (const data of VALID_DATA) {
      it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
        const tx = {
          to: erc20TokenAddr,
          data: data.sighash,
        };

        const output = await ethersWsProvider.send(METHOD_NAME, [tx, 'latest']);
        const outputASCII = erc20EtherInterface.decodeFunctionResult(
          erc20EtherInterface.getFunction(data.sighash)!,
          output,
        );
        expect(outputASCII[0]).to.eq(data.output);
      });
    }
  });
});
