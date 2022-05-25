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
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { RelayImpl } from '@hashgraph/json-rpc-relay';
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';
import {expectUnsupportedMethod} from '../helpers';

const cache = require('js-cache');

import pino from 'pino';
const logger = pino();

const Relay = new RelayImpl(logger);

const validateHash = (hash: string, len?: number) => {
  let regex;
  if (len && len > 0) {
    regex = new RegExp(`^0x[a-f0-9]{${len}}$`);
  } else {
    regex = new RegExp(`^0x[a-f0-9]*$`);
  }

  return !!hash.match(regex);
};

describe('Eth calls using MirrorNode', async function () {
  this.timeout(10000);

  // mock axios
  const instance = axios.create({
    baseURL: 'https://localhost:5551/api/v1',
    responseType: 'json' as const,
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10 * 1000
  });

  const mock = new MockAdapter(instance, { onNoMatch: "throwException" });
  const mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), instance);
  const ethImpl = new EthImpl(null, null, mirrorNodeInstance, logger, '0x12a');

  const blockHashTrimmed = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
  const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;  
  const blockHashPreviousTrimmed = '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298';
  const blockHashPrevious = `${blockHashPreviousTrimmed}dc2dfa10f51bcbaab8ae23bc6d662a0b`;
  const blockNumber = 3;
  const blockNumberHex = `0x${blockNumber.toString(16)}`;
  const blockTransactionCount = 77;
  const maxGasLimit = 250000;
  const firstTransactionTimestampSeconds = '1653077547';
  const contractAddress1 = '0x000000000000000000000000000000000000055f';
  const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
  const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const contractAddress2 = '0x000000000000000000000000000000000000055e';
  const contractTimestamp2 = '1653077542.701408897';
  
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
    'contract_id': '0.0.5001',
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
        'contract_id': '0.0.5001',
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
        'contract_id': '0.0.5001',
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

  const results = defaultContractResults.results;
  const totalGasUsed = results[0].gas_used + results[1].gas_used;

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
    } catch (error) {
      expect(error.message).to.equal('Error encountered retrieving latest block');
    }
  });

  it('eth_getBlockByNumber with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);
    const result = await ethImpl.getBlockByNumber(blockNumber, false);
    expect(result).to.exist;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimit);
    expect(result.number).equal(blockNumber);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSeconds);

    // verify expected constants
    expect(result.baseFeePerGas).equal(0);
    expect(result.difficulty).equal(EthImpl.zeroHex);
    expect(result.extraData).equal(EthImpl.emptyHex);
    expect(result.miner).equal(EthImpl.emptyHex);
    expect(result.mixHash).equal(EthImpl.emptyHex);
    expect(result.nonce).equal(EthImpl.emptyHex);
    expect(result.receiptsRoot).equal(EthImpl.emptyHex);
    expect(result.sha3Uncles).equal(EthImpl.emptyArrayHex);
    expect(result.stateRoot).equal(EthImpl.emptyHex);
    expect(result.totalDifficulty).equal(EthImpl.zeroHex);
    expect(result.uncles).to.deep.equal([]);
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

    const result = await ethImpl.getBlockByNumber(blockNumber, false);
    expect(result).to.equal(null);
  });

  it('eth_getBlockByHash with match', async function () {
    // mirror node request mocks
    mock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    mock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultContractResults);

    const result = await ethImpl.getBlockByHash(blockHash, false);
    expect(result).to.exist;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.gasLimit).equal(maxGasLimit);
    expect(result.number).equal(blockNumber);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(firstTransactionTimestampSeconds);

    // verify expected constants
    expect(result.baseFeePerGas).equal(0);
    expect(result.difficulty).equal(EthImpl.zeroHex);
    expect(result.extraData).equal(EthImpl.emptyHex);
    expect(result.miner).equal(EthImpl.emptyHex);
    expect(result.mixHash).equal(EthImpl.emptyHex);
    expect(result.nonce).equal(EthImpl.emptyHex);
    expect(result.receiptsRoot).equal(EthImpl.emptyHex);
    expect(result.sha3Uncles).equal(EthImpl.emptyArrayHex);
    expect(result.stateRoot).equal(EthImpl.emptyHex);
    expect(result.totalDifficulty).equal(EthImpl.zeroHex);
    expect(result.uncles).to.deep.equal([]);
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

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber);
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

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber);
    expect(result).to.equal(null);
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
    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number, defaultBlock.count);
    expect(result).to.exist;

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

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number, defaultBlock.count);
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex with match', async function () {
    // mirror node request mocks
    mock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}`).reply(200, defaultContractResults);
    mock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, defaultBlock.count);
    expect(result).to.exist;

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

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number, defaultBlock.count);
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

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(defaultBlock.number, defaultBlock.count);
    expect(result).to.equal(null);
  });
});

describe('Eth', async function () {
  this.timeout(10000);

  const instance = axios.create({
    baseURL: 'https://localhost:5551/api/v1',
    responseType: 'json' as const,
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 10 * 1000
  });

  const mock = new MockAdapter(instance, { onNoMatch: "throwException" });
  const mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), instance);
  const ethImpl = new EthImpl(null, null, mirrorNodeInstance, logger);

  const defaultTxHash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const defaultTransaction = {
    "accessList": "0x",
    "blockHash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "blockNumber": 17,
    "chainId": "0x12a",
    "from": "0x0000000000000000000000000000000000001f41",
    "gas": 123,
    "gasPrice": "0x4a817c80",
    "hash": defaultTxHash,
    "input": "0x0707",
    "maxFeePerGas": "0x",
    "maxPriorityFeePerGas": "0x",
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
      "topics": ["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"]
    }],
    "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "status": "0x1",
    "transactionHash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    "transactionIndex": "0x1"
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
    expect(result.code).to.be.equal(-32000);
    expect(result).to.have.property('name');
    expect(result.name).to.be.equal('No mining work');
    expect(result).to.have.property('message');
    expect(result.message).to.be.equal('No mining work available yet');
  });

  const unsupportedMethods = [
      'submitHashrate',
      'signTypedData',
      'signTransaction',
      'sign',
      'sendTransaction',
      'protocolVersion',
      'getProof',
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
      const txId = cache.get(txHash);
      expect(txId).to.not.exist;
      const receipt = await Relay.eth().getTransactionReceipt(txHash);
      expect(receipt).to.be.null;
    });

    it('executes correctly', async function () {
      // mirror node request mocks
      mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      // Assert the data format
      expect(receipt).to.exist;
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

      const result = await ethImpl.getTransactionByHash('0x4444444444444444444444444444444444444444444444444444444444444444');
      expect(result).to.equal(null);
    });

    it('returns correct transaction for existing hash', async function () {
      // mirror node request mocks
      mock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      const result = await ethImpl.getTransactionByHash(defaultTxHash);

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
      expect(result.r).to.eq(defaultTransaction.r);
      expect(result.s).to.eq(defaultTransaction.s);
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(defaultTransaction.type);
      expect(result.v).to.eq(defaultTransaction.v);
      expect(result.value).to.eq(defaultTransaction.value);
    });
  });
});
