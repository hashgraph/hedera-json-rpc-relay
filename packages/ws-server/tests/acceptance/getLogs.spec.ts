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

describe('@release @web-socket eth_getLogs', async function () {
  const EXPECTED_VALUE = 7;
  const METHOD_NAME = 'eth_getLogs';
  const INVALID_PARAMS = [
    [],
    [{}, ''],
    [{}, '0xhbar', false],
    [
      {
        address: '0xhedera',
        fromBlock: 'latest',
        toBlock: 'latest',
      },
    ],
    [
      {
        address: WsTestConstant.FAKE_TX_HASH,
        fromBlock: '0xhedera',
        toBlock: 'latest',
      },
    ],
    [
      {
        address: WsTestConstant.FAKE_TX_HASH,
        fromBlock: 'latest',
        toBlock: '0xhedera',
      },
    ],
  ];

  // @notice: The simple contract artifacts (ABI & bytecode) below simply has event LuckyNum(uint256) which emitted during deployment with a value of 7
  const SIMPLE_CONTRACT_ABI = [
    {
      inputs: [],
      stateMutability: 'nonpayable',
      type: 'constructor',
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      name: 'LuckyNum',
      type: 'event',
    },
  ];
  const SIMPLE_CONTRACT_BYTECODE =
    '0x6080604052348015600f57600080fd5b507f4e7df42af9a017b7c655a28ef10cbc8f05b2b088f087ee02416cfa1a96ac3be26007604051603e91906091565b60405180910390a160aa565b6000819050919050565b6000819050919050565b6000819050919050565b6000607d6079607584604a565b605e565b6054565b9050919050565b608b816068565b82525050565b600060208201905060a460008301846084565b92915050565b603f8060b76000396000f3fe6080604052600080fdfea264697066735822122084db7fe76bde5c9c041d61bb40294c56dc6d339bdbc8e0cd285fc4008ccefc2c64736f6c63430008180033';

  let wsFilterObj: any,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    accounts[0] = await global.servicesNode.createAliasAccount(100, global.relay.provider);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts[0] to propagate

    // deploy contract
    const contractFactory = new ethers.ContractFactory(
      SIMPLE_CONTRACT_ABI,
      SIMPLE_CONTRACT_BYTECODE,
      accounts[0].wallet,
    );
    const contract = await contractFactory.deploy();

    // prepare filter object
    wsFilterObj = {
      address: contract.target,
      fromBlock: '0x0',
      toBlock: 'latest',
    };
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
      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [wsFilterObj]);
      WsTestHelper.assertJsonRpcObject(response);

      const logs = response.result;
      expect(logs[0].address.toLowerCase()).to.eq(wsFilterObj.address.toLowerCase());
      expect(logs[0].logIndex).to.eq('0x0'); // the event has only one input
      expect(parseInt(logs[0].data)).to.eq(EXPECTED_VALUE);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
      const logs = await ethersWsProvider.send(METHOD_NAME, [wsFilterObj]);

      expect(logs[0].address.toLowerCase()).to.eq(wsFilterObj.address.toLowerCase());
      expect(logs[0].logIndex).to.eq('0x0'); // the event has only one input
      expect(parseInt(logs[0].data)).to.eq(EXPECTED_VALUE);
    });
  });
});
