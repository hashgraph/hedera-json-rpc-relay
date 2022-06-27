/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import sinon from 'sinon';
import cache from 'js-cache';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { RelayImpl } from '@hashgraph/json-rpc-relay';
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';
import { MirrorNode } from '../../src/lib/mirrorNode';
import { expectUnsupportedMethod } from '../helpers';

import pino from 'pino';
import { Block, Transaction } from '../../src/lib/model';
import constants from '../../src/lib/constants';
import { SDKClient } from '../../src/lib/clients';
const logger = pino();
const registry = new Registry();
const Relay = new RelayImpl(logger, registry);

const validateHash = (hash: string, len?: number) => {
  let regex;
  if (len && len > 0) {
    regex = new RegExp(`^0x[a-f0-9]{${len}}$`);
  } else {
    regex = new RegExp(`^0x[a-f0-9]*$`);
  }

  return !!hash.match(regex);
};

const verifyBlockConstants = (block: Block) => {
  expect(block.baseFeePerGas).equal(EthImpl.zeroHex);
  expect(block.difficulty).equal(EthImpl.zeroHex);
  expect(block.extraData).equal(EthImpl.emptyHex);
  expect(block.miner).equal(EthImpl.zeroAddressHex);
  expect(block.mixHash).equal(EthImpl.zeroHex32Byte);
  expect(block.nonce).equal(EthImpl.zeroHex8Byte);
  expect(block.receiptsRoot).equal(EthImpl.zeroHex32Byte);
  expect(block.sha3Uncles).equal(EthImpl.emptyArrayHex);
  expect(block.stateRoot).equal(EthImpl.zeroHex32Byte);
  expect(block.totalDifficulty).equal(EthImpl.zeroHex);
  expect(block.uncles).to.deep.equal([]);
};

let mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let sdkClientStub;

describe('Eth calls using MirrorNode', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  this.beforeAll(() => {
    // mock axios
    const instance = axios.create({
      baseURL: 'https://localhost:5551/api/v1',
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10 * 1000
    });

    // @ts-ignore
    mock = new MockAdapter(instance, { onNoMatch: "throwException" });
    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, instance);
    sdkClientStub = sinon.createStubInstance(SDKClient);
    // @ts-ignore
    ethImpl = new EthImpl(sdkClientStub, new MirrorNode(logger.child({ name: `mirror-node-faux` })), mirrorNodeInstance, logger, '0x12a');
  });

  this.beforeEach(() => {
    // reset cache and mock
    cache.clear();
    mock.reset();
  });

  const blockHashTrimmed = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
  const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;
  const blockHash2 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6c`;
  const blockHash3 = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6d`;
  const blockHashPreviousTrimmed = '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298';
  const blockNumber = 3;
  const blockNumber2 = 4;
  const blockNumber3 = 5;
  const blockNumberHex = `0x${blockNumber.toString(16)}`;
  const blockTransactionCount = 77;
  const maxGasLimit = 250000;
  const maxGasLimitHex = EthImpl.numberTo0x(maxGasLimit);
  const firstTransactionTimestampSeconds = '1653077547';
  const firstTransactionTimestampSecondsHex = EthImpl.numberTo0x(Number(firstTransactionTimestampSeconds));
  const contractAddress1 = '0x000000000000000000000000000000000000055f';
  const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
  const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const contractHash2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
  const contractHash3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
  const contractAddress2 = '0x000000000000000000000000000000000000055e';
  const contractTimestamp2 = '1653077542.701408897';
  const contractTimestamp3 = '1653088542.123456789';
  const contractId1 = '0.0.5001';
  const contractId2 = '0.0.5002';

  const defaultBlock = {
    'count': blockTransactionCount,
    'hapi_version': '0.27.0',
    'hash': blockHash,
    'name': '2022-05-03T06_46_26.060890949Z.rcd',
    'number': blockNumber,
    'previous_hash': '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
    'size': null,
    'timestamp': {
      'from': '1651560386.060890949',
      'to': '1651560389.060890949'
    }
  };


  const defaultContractResults = {
    'results': [
      {
        'amount': 1,
        'bloom': '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        'call_result': '0x6080604052600436106100385760003560e01c80632b6adf431461003c5780633d99e80d1461010f5780634bfdab701461015257610038565b5b5b005b61010d600480360360408110156100535760006000fd5b81019080803563ffffffff169060200190929190803590602001906401000000008111156100815760006000fd5b8201836020820111156100945760006000fd5b803590602001918460018302840111640100000000831117156100b75760006000fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f8201169050808301925050505050505090909192909091929050505061018a565b005b34801561011c5760006000fd5b50610150600480360360208110156101345760006000fd5b81019080803563ffffffff169060200190929190505050610292565b005b34801561015f5760006000fd5b506101686102b7565b604051808263ffffffff1663ffffffff16815260200191505060405180910390f35b60008263ffffffff166effffffffffffffffffffffffffffff1690508073ffffffffffffffffffffffffffffffffffffffff166108fc60019081150290604051600060405180830381858888f193505050501580156101ee573d600060003e3d6000fd5b507f930f628a0950173c55b8f7d31636aa82e481f09d70191adc38b8c8cd186a0ad7826040518080602001828103825283818151815260200191508051906020019080838360005b838110156102525780820151818401525b602081019050610236565b50505050905090810190601f16801561027f5780820380516001836020036101000a031916815260200191505b509250505060405180910390a1505b5050565b80600060006101000a81548163ffffffff021916908363ffffffff1602179055505b50565b6000600060009054906101000a900463ffffffff1690506102d3565b9056fea265627a7a723158201b51cf608b8b7e2c5d36bd8733f2213b669e5d1cfa53b67f52a7e878d1d7bb0164736f6c634300050b0032',
        'contract_id': '0.0.1375',
        'created_contract_ids': ['0.0.1375'],
        'error_message': null,
        'from': '0x0000000000000000000000000000000000000557',
        'function_parameters': '0x',
        'gas_limit': maxGasLimit,
        'gas_used': 200000,
        'timestamp': `${contractTimestamp1}`,
        'to': `${contractAddress1}`
      },
      {
        'amount': 0,
        'bloom': '0x00000000000000000000000000000000000000000000000000000000000000040000000000000000000001000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000',
        'call_result': '0x',
        'contract_id': '0.0.1374',
        'created_contract_ids': [],
        'error_message': null,
        'from': '0x0000000000000000000000000000000000000557',
        'function_parameters': '0x2b6adf430000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000084865792c204d6121000000000000000000000000000000000000000000000000',
        'gas_limit': maxGasLimit - 1000,
        'gas_used': 80000,
        'timestamp': `${contractTimestamp2}`,
        'to': `${contractAddress2}`
      }
    ],
    'links': {
      'next': '/api/v1/contracts/results?limit=2&timestamp=lt:1653077542.701408897'
    }
  };

  const defaultDetailedContractResults = {
    'access_list': '0x',
    'amount': 2000000000,
    'block_gas_used': 50000000,
    'block_hash': blockHash,
    'block_number': blockNumber,
    'bloom': '0x0505',
    'call_result': '0x0606',
    'chain_id': '0x',
    'contract_id': contractId1,
    'created_contract_ids': ['0.0.7001'],
    'error_message': null,
    'from': '0x0000000000000000000000000000000000001f41',
    'function_parameters': '0x0707',
    'gas_limit': 1000000,
    'gas_price': '0x4a817c80',
    'gas_used': 123,
    'hash': contractHash1,
    'logs': [
      {
        'address': contractAddress1,
        'bloom': '0x0123',
        'contract_id': contractId1,
        'data': '0x0123',
        'index': 0,
        'topics': [
          '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0xe8d47b56e8cdfa95f871b19d4f50a857217c44a95502b0811a350fec1500dd67'
        ]
      },
    ],
    'max_fee_per_gas': '0x',
    'max_priority_fee_per_gas': '0x',
    'nonce': 1,
    'r': '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    'result': 'SUCCESS',
    's': '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
    'state_changes': [
      {
        'address': contractAddress1,
        'contract_id': contractId1,
        'slot': '0x0000000000000000000000000000000000000000000000000000000000000101',
        'value_read': '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
        'value_written': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      }
    ],
    'status': '0x1',
    'timestamp': contractTimestamp1,
    'to': contractAddress1,
    'transaction_index': 1,
    'type': 2,
    'v': 1
  };

  const defaultDetailedContractResults2 = {
    ...defaultDetailedContractResults, ...{
      'timestamp': contractTimestamp2,
      'block_hash': blockHash2,
      'block_number': blockNumber2,
      'hash': contractHash2
    }
  };

  const defaultDetailedContractResults3 = {
    ...defaultDetailedContractResults, ...{
      'timestamp': contractTimestamp3,
      'block_hash': blockHash3,
      'block_number': blockNumber3,
      'hash': contractHash3,
      'contract_id': contractId2,
    }
  };

  const detailedContractResultNotFound = { "_status": { "messages": [{ "message": "No correlating transaction" }] } };

  const defaultDetailedContractResultsWithNullNullableValues = {
    ...defaultDetailedContractResults,
    r: null,
    s: null
  };

  const results = defaultContractResults.results;
  const totalGasUsed = EthImpl.numberTo0x(results[0].gas_used + results[1].gas_used);

  const logBloom1 = '0x1111';
  const logBloom2 = '0x2222';
  const logBloom3 = '0x3333';
  const logBloom4 = '0x4444';

  const defaultLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    "0x0000000000000000000000000000000000000000000000000000000000000005"
  ];

  const defaultLogs = {
    "logs": [
      {
        "address": "0x0000000000000000000000000000000002131951",
        "bloom": logBloom1,
        "contract_id": contractId1,
        "data": "0x",
        "index": 0,
        "topics": defaultLogTopics,
        "root_contract_id": "0.0.34806097",
        "timestamp": contractTimestamp1
      },
      {
        "address": "0x0000000000000000000000000000000002131951",
        "bloom": logBloom2,
        "contract_id": contractId1,
        "data": "0x",
        "index": 1,
        "topics": defaultLogTopics,
        "root_contract_id": "0.0.34806097",
        "timestamp": contractTimestamp1
      },
      {
        "address": "0x0000000000000000000000000000000002131951",
        "bloom": logBloom3,
        "contract_id": contractId1,
        "data": "0x",
        "index": 0,
        "topics": [],
        "root_contract_id": "0.0.34806097",
        "timestamp": contractTimestamp2
      },
      {
        "address": "0x0000000000000000000000000000000002131951",
        "bloom": logBloom4,
        "contract_id": contractId2,
        "data": "0x",
        "index": 0,
        "topics": [],
        "root_contract_id": "0.0.34806097",
        "timestamp": contractTimestamp3
      }
    ]
  };

  const defaultNetworkFees = {
    'fees': [
      {
        'gas': 77,
        'transaction_type': 'ContractCall'
      },
      {
        'gas': 771,
        'transaction_type': 'ContractCreate'
      },
      {
        'gas': 57,
        'transaction_type': 'EthereumTransaction'
      }
    ],
    'timestamp': '1653644164.591111113'
  };

  this.afterEach(() => {
    mock.resetHandlers();
  });

  it('"eth_blockNumber" should return the latest block number', async function () {
    mock.onGet('blocks?limit=1&order=desc').reply(200, {
      blocks: [defaultBlock]
    });
    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found', async function () {
    mock.onGet('blocks?limit=1&order=desc').reply(404, {
      '_status': {
        'messages': [
          {
            'message': 'Block not found'
          }
        ]
      }
    });
    try {
      await ethImpl.blockNumber();
    } catch (error: any) {
      expect(error.message).to.equal('Error encountered retrieving latest block');
    }
  });

  it('eth_getBlockByNumber with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    mock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimitHex);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSecondsHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as string)).equal(contractHash1);
    expect((result.transactions[1] as string)).equal(contractHash1);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with zero transactions', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, { 'results': [] });
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal('0x0');
    expect(result.gasLimit).equal('0x0');
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal('0x0');
    expect(result.transactions.length).equal(0);
    expect(result.transactionsRoot).equal(EthImpl.ethEmptyTrie);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with match and details', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    mock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimitHex);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSecondsHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash1);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with no match', async function () {
    mock.onGet(`blocks/${blockNumber}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such block exists'
          }
        ]
      }
    });

    const result = await ethImpl.getBlockByNumber(blockNumber.toString(), false);
    expect(result).to.equal(null);
  });

  it('eth_getBlockByNumber with latest tag', async function () {
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    const result = await ethImpl.getBlockByNumber('latest', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with pending tag', async function () {
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);

    const result = await ethImpl.getBlockByNumber('pending', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with earliest tag', async function () {
    mock.onGet(`blocks/0`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);

    const result = await ethImpl.getBlockByNumber('earliest', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with hex number', async function () {
    mock.onGet(`blocks/3735929054`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);

    const result = await ethImpl.getBlockByNumber('0xdeadc0de', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByHash with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    mock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getBlockByHash(blockHash, false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimitHex);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSecondsHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as string)).equal(contractHash1);
    expect((result.transactions[1] as string)).equal(contractHash1);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByHash with match and details', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    mock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);

    const result = await ethImpl.getBlockByHash(blockHash, true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimitHex);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSecondsHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash1);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByHash with no match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such block exists'
          }
        ]
      }
    });

    const result = await ethImpl.getBlockByHash(blockHash, false);
    expect(result).to.equal(null);
  });

  it('eth_getBlockTransactionCountByNumber with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByNumber with no match', async function () {
    mock.onGet(`blocks/${blockNumber}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such block exists'
          }
        ]
      }
    });

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
    expect(result).to.equal(null);
  });

  it('eth_getBlockTransactionCountByNumber with latest tag', async function () {
    // mirror node request mocks
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('latest');
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByNumber with pending tag', async function () {
    // mirror node request mocks
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('pending');
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByNumber with earliest tag', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/0`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('earliest');
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByNumber with hex number', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/3735929054`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('0xdeadc0de');
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByHash with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
    expect(result).equal(blockTransactionCount);
  });

  it('eth_getBlockTransactionCountByHash with no match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such block exists'
          }
        ]
      }
    });

    const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex with match', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number.toString(), defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockNumberAndIndex with no contract result match', async function () {
    mock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such contract result exists'
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number.toString(), defaultBlock.count);
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex with latest tag', async function () {
    // mirror node request mocks
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('latest', defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockNumberAndIndex with match pending tag', async function () {
    // mirror node request mocks
    mock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    mock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('pending', defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockNumberAndIndex with earliest tag', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.number=0&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('earliest', defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockNumberAndIndex with hex number', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.number=3735929054&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('0xdeadc0de' +
      '', defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockHashAndIndex with match', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, defaultBlock.count);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockHashAndIndex with no contract result match', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such contract result exists'
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number.toString(), defaultBlock.count);
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex with no detailed contract result match', async function () {
    mock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such detailed contract result exists'
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number.toString(), defaultBlock.count);
    expect(result).to.equal(null);
  });

  describe('eth_getLogs', async function () {

    const expectLogData = (res, log, tx) => {
      expect(res.address).to.eq(log.address);
      expect(res.blockHash).to.eq(tx.block_hash);
      expect(res.blockNumber).to.eq(tx.block_number);
      expect(res.data).to.eq(log.data);
      expect(res.logIndex).to.eq(log.index);
      expect(res.removed).to.eq(false);
      expect(res.topics).to.exist;
      expect(res.topics).to.deep.eq(log.topics);
      expect(res.transactionHash).to.eq(tx.hash);
      expect(res.transactionIndex).to.eq(tx.transaction_index);
    };

    const expectLogData1 = (res) => {
      expectLogData(res, defaultLogs.logs[0], defaultDetailedContractResults);
    };

    const expectLogData2 = (res) => {
      expectLogData(res, defaultLogs.logs[1], defaultDetailedContractResults);
    };

    const expectLogData3 = (res) => {
      expectLogData(res, defaultLogs.logs[2], defaultDetailedContractResults2);
    };

    const expectLogData4 = (res) => {
      expectLogData(res, defaultLogs.logs[3], defaultDetailedContractResults3);
    };

    it('contract results details not found', async function () {
      mock.onGet(`contracts/results/logs`).reply(200, defaultLogs);
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(404, detailedContractResultNotFound);
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp2}`).reply(404, detailedContractResultNotFound);
      mock.onGet(`contracts/${contractId2}/results/${contractTimestamp2}`).reply(404, detailedContractResultNotFound);

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;
      expect(result.length).to.eq(0);
    });

    it('error when retrieving logs', async function () {
      mock.onGet(`contracts/results/logs`).reply(400, { "_status": { "messages": [{ "message": "Mocked error" }] } });
      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;
      expect(result.length).to.eq(0);
    });

    it('no filters', async function () {
      mock.onGet(`contracts/results/logs`).reply(200, defaultLogs);
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults2);
      mock.onGet(`contracts/${contractId2}/results/${contractTimestamp3}`).reply(200, defaultDetailedContractResults3);

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
      expectLogData4(result[3]);
    });

    it('address filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1], defaultLogs.logs[2]]
      };
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults2);
      mock.onGet(`contracts/${contractAddress1}/results/logs`).reply(200, filteredLogs);

      const result = await ethImpl.getLogs(null, null, null, contractAddress1, null);

      expect(result).to.exist;

      expect(result.length).to.eq(3);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
    });

    it('blockHash filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
      mock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, filteredLogs);
      mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
      const result = await ethImpl.getLogs(blockHash, null, null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('fromBlock && toBlock filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
      mock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, filteredLogs);
      mock.onGet('blocks?block.number=gte:0x5&block.number=lte:0x10').reply(200, {
        blocks: [defaultBlock]
      });
      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('topics filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };
      mock.onGet(`contracts/${contractId1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
      mock.onGet(
        `contracts/results/logs` +
        `?topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
        `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}`
      ).reply(200, filteredLogs);
      mock.onGet('blocks?block.number=gte:0x5&block.number=lte:0x10').reply(200, {
        blocks: [defaultBlock]
      });

      const result = await ethImpl.getLogs(null, null, null, null, defaultLogTopics);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });
  });

  it('eth_feeHistory', async function () {
    mock.onGet(`network/fees`).reply(200, defaultNetworkFees);
    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    expect(feeHistory).to.exist;
    if (feeHistory == null) return;
    expect(feeHistory['baseFeePerGasArray'][0]).to.equal('0x84b6a5c400');
    expect(feeHistory['gasUsedRatioArray'][0]).to.equal('0.5');
    expect(feeHistory['oldestBlockNumber']).to.equal('0x0');
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory verify cached value', async function () {
    mock.onGet(`network/fees`).reply(200, defaultNetworkFees);
    const firstFeeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    expect(firstFeeHistory).to.exist;
    if (firstFeeHistory == null) return;
    expect(firstFeeHistory['baseFeePerGasArray'][0]).to.equal('0x84b6a5c400');
    expect(firstFeeHistory['gasUsedRatioArray'][0]).to.equal('0.5');
    expect(firstFeeHistory['oldestBlockNumber']).to.equal('0x0');
    const rewards = firstFeeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');

    const secondFeeHistory = await ethImpl.feeHistory(2, 'latest', [25, 75]);

    expect(firstFeeHistory).to.equal(secondFeeHistory);
  });

  it('eth_feeHistory on mirror 404', async function () {
    mock.onGet(`network/fees`).reply(404, {
      _status: {
        messages: [{ message: 'Not found' }]
      }
    });

    const fauxGasTinyBars = 25_000;
    const fauxGasWeiBarHex = '0xe35fa931a000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    expect(feeHistory).to.exist;
    if (feeHistory == null) return;
    expect(feeHistory['baseFeePerGasArray'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatioArray'][0]).to.equal('0.5');
    expect(feeHistory['oldestBlockNumber']).to.equal('0x0');
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory on mirror 500', async function () {
    mock.onGet(`network/fees`).reply(500, {
      _status: {
        messages: [{ message: 'Internal error' }]
      }
    });

    const fauxGasTinyBars = 35_000;
    const fauxGasWeiBarHex = '0x13e52b9abe000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    if (feeHistory == null) return;
    expect(feeHistory['baseFeePerGasArray'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatioArray'][0]).to.equal('0.5');
    expect(feeHistory['oldestBlockNumber']).to.equal('0x0');
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_estimateGas contract call returns default', async function () {
    const gas = await ethImpl.estimateGas({ data: "0x01" }, null);
    expect(gas).to.equal(EthImpl.defaultGas);
  });

  it('eth_estimateGas empty call returns transfer cost', async function () {
    const gas = await ethImpl.estimateGas({}, null);
    expect(gas).to.equal(EthImpl.gasTxBaseCost);
  });

  it('eth_estimateGas empty input transfer cost', async function () {
    const gas = await ethImpl.estimateGas({ data: "" }, null);
    expect(gas).to.equal(EthImpl.gasTxBaseCost);
  });

  it('eth_estimateGas zero input returns transfer cost', async function () {
    const gas = await ethImpl.estimateGas({ data: "0x" }, null);
    expect(gas).to.equal(EthImpl.gasTxBaseCost);
  });

  it('eth_gasPrice', async function () {
    mock.onGet(`network/fees`).reply(200, defaultNetworkFees);

    const weiBars = await ethImpl.gasPrice();
    const expectedWeiBars = defaultNetworkFees.fees[2].gas * constants.TINYBAR_TO_WEIBAR_COEF;
    expect(weiBars).to.equal(EthImpl.numberTo0x(expectedWeiBars));
  });

  it('eth_gasPrice with cached value', async function () {
    mock.onGet(`network/fees`).reply(200, defaultNetworkFees);

    const firstGasResult = await ethImpl.gasPrice();

    const modifiedNetworkFees = Object.assign({}, defaultNetworkFees);
    modifiedNetworkFees.fees[2].gas = defaultNetworkFees.fees[2].gas * 100;

    mock.onGet(`network/fees`).reply(200, modifiedNetworkFees);

    const secondGasResult = await ethImpl.gasPrice();

    expect(firstGasResult).to.equal(secondGasResult);
  });

  it('eth_gasPrice with no EthereumTransaction gas returned', async function () {
    const partialNetworkFees = Object.assign({}, defaultNetworkFees);
    partialNetworkFees.fees.splice(2);

    mock.onGet(`network/fees`).reply(200, partialNetworkFees);

    try {
      await ethImpl.gasPrice();
    } catch (error: any) {
      expect(error.message).to.equal('Error encountered estimating the gas price');
    }
  });

  it('eth_gasPrice with mirror node return network fees found', async function () {
    mock.onGet(`network/fees`).reply(404, {
      "_status": {
        "messages": [
          {
            "message": "Not found"
          }
        ]
      }
    });

    const fauxGasTinyBars = 35_000;
    const fauxGasWeiBarHex = '0x13e52b9abe000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const gas = await ethImpl.gasPrice();
    expect(gas).to.equal(fauxGasWeiBarHex);
  });

  it('eth_gasPrice with no network fees records found', async function () {
    mock.onGet(`network/fees`).reply(404, {
      "_status": {
        "messages": [
          {
            "message": "Not found"
          }
        ]
      }
    });

    try {
      await ethImpl.gasPrice();
    } catch (error: any) {
      expect(error.message).to.equal('Error encountered estimating the gas price');
    }
  });
});

describe('Eth', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  this.beforeAll(() => {
    // @ts-ignore
    ethImpl = new EthImpl(null, null, mirrorNodeInstance, logger);
  });

  const defaultTxHash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const defaultTransaction = {
    "accessList": undefined,
    "blockHash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "blockNumber": 17,
    "chainId": "0x12a",
    "from": "0x0000000000000000000000000000000000001f41",
    "gas": 123,
    "gasPrice": "0x4a817c80",
    "hash": defaultTxHash,
    "input": "0x0707",
    "maxFeePerGas": undefined,
    "maxPriorityFeePerGas": undefined,
    "nonce": 1,
    "r": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "s": "0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
    "to": "0x0000000000000000000000000000000000001389",
    "transactionIndex": 1,
    "type": 2,
    "v": 1,
    "value": 2000000000
  };

  const defaultReceipt = {
    "blockHash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "blockNumber": "0x11",
    "cumulativeGasUsed": "0x2faf080",
    "effectiveGasPrice": "0xad78ebc5ac620000",
    "from": "0x0000000000000000000000000000000000001f41",
    "to": "0x0000000000000000000000000000000000001389",
    "gasUsed": "0x7b",
    "logs": [{
      "address": "0x0000000000000000000000000000000000001389",
      "bloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "contract_id": "0.0.5001",
      "data": "0x0123",
      "index": 0,
      "topics": ["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"],
      "transactionHash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392"
    }],
    "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "status": "0x1",
    "transactionHash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    "transactionIndex": "0x1",
    "contractAddress": "0x0000000000000000000000000000000000001b59",
    "root": undefined
  };

  const defaultDetailedContractResultByHash = {
    "amount": 2000000000,
    "bloom":
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "call_result": "0x0606",
    "contract_id": "0.0.5001",
    "created_contract_ids": ["0.0.7001"],
    "error_message": null,
    "from": "0x0000000000000000000000000000000000001f41",
    "function_parameters": "0x0707",
    "gas_limit": 1000000,
    "gas_used": 123,
    "timestamp": "167654.000123456",
    "to": "0x0000000000000000000000000000000000001389",
    "block_hash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042000102030405060708090a0b0c0d0e0f",
    "block_number": 17,
    "logs": [{
      "address": "0x0000000000000000000000000000000000001389",
      "bloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      "contract_id": "0.0.5001",
      "data": "0x0123",
      "index": 0,
      "topics": ["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"]
    }],
    "result": "SUCCESS",
    "transaction_index": 1,
    "hash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    "state_changes": [{
      "address": "0x0000000000000000000000000000000000001389",
      "contract_id": "0.0.5001",
      "slot": "0x0000000000000000000000000000000000000000000000000000000000000101",
      "value_read": "0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750",
      "value_written": "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
    }],
    "status": "0x1",
    "access_list": "0x",
    "block_gas_used": 50000000,
    "chain_id": "0x12a",
    "gas_price": "0x4a817c80",
    "max_fee_per_gas": "0x",
    "max_priority_fee_per_gas": "0x",
    "r": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "s": "0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
    "type": 2,
    "v": 1,
    "nonce": 1
  };

  this.afterEach(() => {
    mock.resetHandlers();
  });


  it('should execute "eth_chainId"', async function () {
    const chainId = await Relay.eth().chainId();

    expect(chainId).to.be.equal(`0x${process.env.CHAIN_ID}`);
  });

  it('should execute "eth_accounts"', async function () {
    const accounts = await Relay.eth().accounts();

    expect(accounts).to.be.an('Array');
    expect(accounts.length).to.be.equal(0);
  });

  it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
    const result = await Relay.eth().getUncleByBlockHashAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
    const result = await Relay.eth().getUncleByBlockNumberAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function () {
    const result = await Relay.eth().getUncleCountByBlockHash();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function () {
    const result = await Relay.eth().getUncleCountByBlockNumber();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_hashrate"', async function () {
    const result = await Relay.eth().hashrate();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_mining"', async function () {
    const result = await Relay.eth().mining();
    expect(result).to.eq(false);
  });

  it('should execute "eth_submitWork"', async function () {
    const result = await Relay.eth().submitWork();
    expect(result).to.eq(false);
  });

  it('should execute "eth_syncing"', async function () {
    const result = await Relay.eth().syncing();
    expect(result).to.eq(false);
  });

  it('should execute "eth_getWork"', async function () {
    const result = await Relay.eth().getWork();
    expect(result).to.have.property('code');
    expect(result.code).to.be.equal(-32601);
    expect(result).to.have.property('name');
    expect(result.name).to.be.equal('Method not found');
    expect(result).to.have.property('message');
    expect(result.message).to.be.equal('Unsupported JSON-RPC method');
  });

  const unsupportedMethods = [
    'submitHashrate',
    'signTransaction',
    'sign',
    'sendTransaction',
    'protocolVersion',
    'coinbase'
  ];

  unsupportedMethods.forEach(method => {
    it(`should execute "eth_${method}" and return unsupported message`, async function () {
      const result = await Relay.eth()[method]();
      expectUnsupportedMethod(result);
    });
  });

  describe('eth_getTransactionReceipt', async function () {
    it('returns `null` for non-existent hash', async function () {
      const txHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      mock.onGet(`contracts/results/${txHash}`).reply(404, {
        '_status': {
          'messages': [
            {
              'message': 'No correlating transaction'
            }
          ]
        }
      });
      const receipt = await ethImpl.getTransactionReceipt(txHash);
      expect(receipt).to.be.null;
    });

    it('valid receipt on match', async function () {
      // mirror node request mocks
      mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      // Assert the data format
      expect(receipt).to.exist;
      if (receipt == null) return;

      expect(validateHash(receipt.transactionHash, 64)).to.eq(true);
      expect(validateHash(receipt.blockHash, 64)).to.eq(true);
      expect(validateHash(receipt.from, 40)).to.eq(true);
      if (receipt.contractAddress) {
        expect(validateHash(receipt.contractAddress, 40)).to.eq(true);
      }
      if (receipt.to) {
        expect(validateHash(receipt.to, 40)).to.eq(true);
      }
      expect(validateHash(receipt.logsBloom, 512)).to.eq(true);
      if (receipt.root) {
        expect(validateHash(receipt.root, 64)).to.eq(true);
      }

      expect(receipt.transactionHash).to.exist;
      expect(receipt.transactionHash).to.eq(defaultReceipt.transactionHash);
      expect(receipt.transactionIndex).to.exist;
      expect(receipt.blockHash).to.eq(defaultReceipt.blockHash);
      expect(receipt.blockNumber).to.eq(defaultReceipt.blockNumber);
      expect(receipt.from).to.eq(defaultReceipt.from);
      expect(receipt.to).to.eq(defaultReceipt.to);
      expect(receipt.cumulativeGasUsed).to.eq(defaultReceipt.cumulativeGasUsed);
      expect(receipt.gasUsed).to.eq(defaultReceipt.gasUsed);
      expect(receipt.contractAddress).to.eq(defaultReceipt.contractAddress);
      expect(receipt.logs).to.deep.eq(defaultReceipt.logs);
      expect(receipt.logsBloom).to.eq(defaultReceipt.logsBloom);
      expect(receipt.root).to.eq(defaultReceipt.root);
      expect(receipt.status).to.eq(defaultReceipt.status);
      expect(receipt.effectiveGasPrice).to.eq(defaultReceipt.effectiveGasPrice);
    });
  });

  describe('eth_getTransactionByHash', async function () {
    it('returns `null` for non-existing hash', async function () {
      // mirror node request mocks
      mock.onGet(`contracts/results/${defaultTxHash}`).reply(404, {
        '_status': {
          'messages': [
            {
              'message': 'No correlating transaction'
            }
          ]
        }
      });

      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      expect(result).to.equal(null);
    });

    it('returns correct transaction for existing hash', async function () {
      // mirror node request mocks
      mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const result = await ethImpl.getTransactionByHash(defaultTxHash);

      expect(result).to.exist;
      if (result == null) return;

      expect(result.accessList).to.eq(defaultTransaction.accessList);
      expect(result.blockHash).to.eq(defaultTransaction.blockHash);
      expect(result.blockNumber).to.eq(`0x${defaultTransaction.blockNumber.toString(16)}`);
      expect(result.chainId).to.eq(defaultTransaction.chainId);
      expect(result.from).to.eq(defaultTransaction.from);
      expect(result.gas).to.eq(defaultTransaction.gas);
      expect(result.gasPrice).to.eq(defaultTransaction.gasPrice);
      expect(result.hash).to.eq(defaultTransaction.hash);
      expect(result.input).to.eq(defaultTransaction.input);
      expect(result.maxFeePerGas).to.eq(defaultTransaction.maxFeePerGas);
      expect(result.maxPriorityFeePerGas).to.eq(defaultTransaction.maxPriorityFeePerGas);
      expect(result.nonce).to.eq(defaultTransaction.nonce);
      expect(result.r).to.eq(defaultTransaction.r);
      expect(result.s).to.eq(defaultTransaction.s);
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(defaultTransaction.type);
      expect(result.v).to.eq(defaultTransaction.v);
      expect(result.value).to.eq(defaultTransaction.value);
    });

    it('returns correct transaction for existing hash w no sigs', async function () {
      // mirror node request mocks
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        r: null,
        s: null
      };

      mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      if (result == null) return;

      expect(result).to.exist;
      expect(result.accessList).to.eq(defaultTransaction.accessList);
      expect(result.blockHash).to.eq(defaultTransaction.blockHash);
      expect(result.blockNumber).to.eq(`0x${defaultTransaction.blockNumber.toString(16)}`);
      expect(result.chainId).to.eq(defaultTransaction.chainId);
      expect(result.from).to.eq(defaultTransaction.from);
      expect(result.gas).to.eq(defaultTransaction.gas);
      expect(result.gasPrice).to.eq(defaultTransaction.gasPrice);
      expect(result.hash).to.eq(defaultTransaction.hash);
      expect(result.input).to.eq(defaultTransaction.input);
      expect(result.maxFeePerGas).to.eq(defaultTransaction.maxFeePerGas);
      expect(result.maxPriorityFeePerGas).to.eq(defaultTransaction.maxPriorityFeePerGas);
      expect(result.nonce).to.eq(defaultTransaction.nonce);
      expect(result.r).to.be.null;
      expect(result.s).to.be.null;
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(defaultTransaction.type);
      expect(result.v).to.eq(defaultTransaction.v);
      expect(result.value).to.eq(defaultTransaction.value);
    });
  });
});
