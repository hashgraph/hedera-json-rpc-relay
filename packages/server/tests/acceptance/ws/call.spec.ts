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
import { Utils } from '../../helpers/utils';
import { ethers, WebSocketProvider } from 'ethers';
import ERC20MockJson from '../../contracts/ERC20Mock.json';
import { AliasAccount } from '../../clients/servicesClient';

describe('@release @web-socket eth_call', async function () {
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const METHOD_NAME = 'eth_call';
  const INVALID_PARAMS = [
    ["{ to: '0xabcdef', data: '0x1a2b3c4d' }", 36, ''],
    ['{}', false, '0x0'],
  ];

  const INVALID_TX_INFO_A = [
    [{ to: 123, data: '0x18160ddd' }, 'latest'],
    [{ to: '0x', data: '0x18160ddd' }, 'latest'],
    [{ to: '0xabcdef', data: '0x18160ddd' }, 'latest'],
  ];
  const INVALID_TX_INFO_B = [
    [{ to: '0x88019982753D059db392934Ba3AA07e5228C485B', data: '' }, 'latest'],
    [{ to: '0x88019982753D059db392934Ba3AA07e5228C485B', data: '0x1816' }, 'latest'],
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

  let accounts: AliasAccount[] = [];
  let requestId: string, wsProvider: WebSocketProvider;
  let erc20TokenAddr: string, erc20EtherInterface: ethers.Interface;

  before(async () => {
    // @ts-ignore
    const { servicesNode, relay } = global;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    await new Promise((r) => setTimeout(r, 3000));

    const erc20Contract = await Utils.deployContractWithEthers(
      [TOKEN_NAME, TOKEN_SYMBOL, accounts[0].address, TOKEN_INIT_SUPPLY],
      ERC20MockJson,
      accounts[0].wallet,
      relay,
    );

    erc20TokenAddr = await erc20Contract.getAddress();
    erc20EtherInterface = new ethers.Interface(ERC20MockJson.abi);
  });

  beforeEach(async () => {
    wsProvider = new ethers.WebSocketProvider(WS_RELAY_URL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  for (const params of INVALID_PARAMS) {
    it(`Should throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, params);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.info).to.exist;
        expect(error.info.error.code).to.eq(-32602);
        expect(error.info.error.name).to.eq('Invalid parameters');
        expect(error.info.error.message).to.eq('Invalid params');
      }
    });
  }

  for (const params of INVALID_TX_INFO_A) {
    it(`Should handle invalid TX_INFO A. params=[${JSON.stringify(params)}]`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, [...params]);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error).to.exist;
        expect(error.argument).to.eq('address');
        expect(error.code).to.eq('INVALID_ARGUMENT');
        expect(error.shortMessage).to.eq('invalid address');
      }
    });
  }

  for (const params of INVALID_TX_INFO_B) {
    it(`Should handle invalid TX_INFO B. params=[${JSON.stringify(params)}]`, async () => {
      const res = await wsProvider.send(METHOD_NAME, [...params]);
      expect(res).to.eq('0x');
    });
  }

  for (const data of VALID_DATA) {
    it(`Should handle valid requests correctly`, async () => {
      const tx = {
        to: erc20TokenAddr,
        data: data.sighash,
      };

      const output = await wsProvider.send(METHOD_NAME, [tx, 'latest']);
      const result = erc20EtherInterface.decodeFunctionResult(erc20EtherInterface.getFunction(data.sighash)!, output);
      expect(result[0]).to.eq(data.output);
    });
  }
});
