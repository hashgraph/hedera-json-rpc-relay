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
import { AliasAccount } from '../../clients/servicesClient';

describe('@release @web-socket eth_getStorageAt', async function () {
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const METHOD_NAME = 'eth_getStorageAt';
  const INVALID_PARAMS = [
    [],
    ['0xfFC7d3ff264c838aD75167e64d043794bf1BD52e'],
    ['0xfFC7d3ff264c838aD75167e64d043794bf1BD52e', '0x0', 'latest', '0xhedera'],
  ];

  const INVALID_VALUES = [
    ['', ''],
    ['0xfFC7d3ff264c838aD75167e64d043794bf1BD52e', ''],
    ['', '0x0'],
    ['0xfFC7d3ff264c838aD75167e64d043794bf1BD52e', 36, 'latest'],
    ['0xfFC7d3ff264c838aD75167e64d043794bf1BD52e', '0xhbar', 'latest'],
  ];

  let accounts: AliasAccount[] = [];
  let requestId: string, wsProvider: WebSocketProvider;

  before(async () => {
    // @ts-ignore
    const { servicesNode, relay } = global;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    await new Promise((r) => setTimeout(r, 3000));
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
        expect(error.error).to.exist;
        expect(error.error.code).to.eq(-32602);
        expect(error.error.name).to.eq('Invalid parameters');
        expect(error.error.message).to.eq('Invalid params');
      }
    });
  }

  for (const params of INVALID_VALUES) {
    it(`Should handle invalid value. params=[${JSON.stringify(params)}]`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, [...params]);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.error).to.exist;
        expect(error.error.code).to.eq(-32603);
        expect(error.error.name).to.eq('Internal error');
        expect(error.error.message).to.contain('Error invoking RPC');
      }
    });
  }

  it(`Should handle valid requests correctly`, async () => {
    // @notice: The simple contract artifacts (ABI & bytecode) below simply has one state at position 0, which will be assigned to the number `7` within the consutrctor after deployment
    const SIMPLE_CONTRACT_ABI = [
      {
        inputs: [],
        stateMutability: 'nonpayable',
        type: 'constructor',
      },
    ];
    const SIMPLE_CONTRACT_BYTECODE =
      '0x6080604052348015600f57600080fd5b506007600081905550603f8060256000396000f3fe6080604052600080fdfea2646970667358221220416347bd1607cf1f0e7ec93afab3d5fe283173dd5e6ce3928dce940edd5c1fb564736f6c63430008180033';
    const contractFactory = new ethers.ContractFactory(
      SIMPLE_CONTRACT_ABI,
      SIMPLE_CONTRACT_BYTECODE,
      accounts[0].wallet,
    );
    const contract = await contractFactory.deploy();

    // prepare transaction params
    const ADDRESS = contract.target;
    const POSITION = '0x0';
    const BLOCK_TAG = 'latest';
    const EXPECTED_VALUE = 7;
    const params = [ADDRESS, POSITION, BLOCK_TAG];

    // call getStorageAt
    const result = await wsProvider.send(METHOD_NAME, params);
    expect(parseInt(result)).to.eq(EXPECTED_VALUE);
  });
});
