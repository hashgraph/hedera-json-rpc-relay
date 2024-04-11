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

describe('@release @web-socket eth_getLogs', async function () {
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const METHOD_NAME = 'eth_getLogs';
  const INVALID_PARAMS = [
    [{}, ''],
    [],
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
        address: '0x637a6A8e5A69C087c24983B05261F63f64ED7e9b',
        fromBlock: '0xhedera',
        toBlock: 'latest',
      },
    ],
    [
      {
        address: '0x637a6A8e5A69C087c24983B05261F63f64ED7e9b',
        fromBlock: 'latest',
        toBlock: '0xhedera',
      },
    ],
  ];

  let accounts: AliasAccount[] = [];
  let requestId: string, wsProvider: WebSocketProvider;

  before(async () => {
    // @ts-ignore
    const { servicesNode, relay } = global;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts[0] to propagate
  });

  beforeEach(async () => {
    wsProvider = new ethers.WebSocketProvider(WS_RELAY_URL);
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
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
      }
    });
  }

  it('Should handle valid data correctly', async () => {
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

    // deploy contract
    const contractFactory = new ethers.ContractFactory(
      SIMPLE_CONTRACT_ABI,
      SIMPLE_CONTRACT_BYTECODE,
      accounts[0].wallet,
    );
    const contract = await contractFactory.deploy();

    // prepare filter object
    const FILTER = {
      address: contract.target,
      fromBlock: '0x0',
      toBlock: 'latest',
    };

    const EXPECTED_VALUE = 7;
    const log = await wsProvider.send(METHOD_NAME, [FILTER]);

    expect(log[0].address.toLowerCase()).to.eq(contract.target.toString().toLowerCase());
    expect(log[0].logIndex).to.eq('0x0'); // the event has only one input
    expect(parseInt(log[0].data)).to.eq(EXPECTED_VALUE);
  });
});
