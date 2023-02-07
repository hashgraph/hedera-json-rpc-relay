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
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { RelayImpl } from '@hashgraph/json-rpc-relay';
import { predefined } from '../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';
import {
  defaultEvmAddress,
  defaultFromLongZeroAddress,
  expectUnsupportedMethod,
  defaultErrorMessage,
  buildCryptoTransferTransaction
 } from '../helpers';

import pino from 'pino';
import { Block, Transaction } from '../../src/lib/model';
import constants from '../../src/lib/constants';
import { SDKClient } from '../../src/lib/clients';
import { SDKClientError } from '../../src/lib/errors/SDKClientError';

const LRU = require('lru-cache');

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
  expect(block.gasLimit).equal(EthImpl.numberTo0x(15000000));
  expect(block.baseFeePerGas).equal('0x84b6a5c400');
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

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let sdkClientStub;
let cache;

describe('Eth calls using MirrorNode', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;

  this.beforeAll(() => {
    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry);

    // @ts-ignore
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: "throwException" });

    // @ts-ignore
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: "throwException" });

    sdkClientStub = sinon.createStubInstance(SDKClient);
    cache = new LRU({
      max: constants.CACHE_MAX,
      ttl: constants.CACHE_TTL.ONE_HOUR
    });
    // @ts-ignore
    ethImpl = new EthImpl(sdkClientStub, mirrorNodeInstance, logger, '0x12a', cache);
  });

  this.beforeEach(() => {
    // reset cache and restMock
    cache.clear();
    restMock.reset();
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
  const gasUsed1 = 200000;
  const gasUsed2 = 800000;
  const maxGasLimit = 250000;
  const maxGasLimitHex = EthImpl.numberTo0x(maxGasLimit);
  const contractCallData = "0xef641f44";
  const blockTimestamp = '1651560386';
  const blockTimestampHex = EthImpl.numberTo0x(Number(blockTimestamp));
  const firstTransactionTimestampSeconds = '1653077541';
  const contractAddress1 = '0x000000000000000000000000000000000000055f';
  const htsTokenAddress = '0x0000000000000000000000000000000002dca431';
  const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
  const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const contractHash2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
  const contractHash3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
  const contractAddress2 = '0x000000000000000000000000000000000000055e';
  const wrongContractAddress = '0x00000000000000000000000000000000055e';
  const contractTimestamp2 = '1653077542.701408897';
  const contractTimestamp3 = '1653088542.123456789';
  const contractId1 = '0.0.5001';
  const contractId2 = '0.0.5002';
  const gasUsedRatio = 0.5;
  const deployedBytecode = '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100329190';
  const mirrorNodeDeployedBytecode = '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100321234';

  const defaultBlock = {
    'count': blockTransactionCount,
    'hapi_version': '0.28.1',
    'hash': blockHash,
    'name': '2022-05-03T06_46_26.060890949Z.rcd',
    'number': blockNumber,
    'previous_hash': '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
    'size': null,
    'timestamp': {
      'from': `${blockTimestamp}.060890949`,
      'to': '1651560389.060890949'
    },
    'gas_used': gasUsed1 + gasUsed2,
    'logs_bloom': '0x'
  };

  const blockZero = {
    "count": 5,
    "hapi_version": "0.28.1",
    "hash": "0x4a7eed88145253eca01a6b5995865b68b041923772d0e504d2ae5fbbf559b68b397adfce5c52f4fa8acec860e6fbc395",
    "name": "2020-08-27T23_40_52.347251002Z.rcd",
    "number": 0,
    "previous_hash": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "size": null,
    "timestamp": {
      "from": "1598571652.347251002",
      "to": "1598571654.548395000"
    },
    "gas_used": 0,
    "logs_bloom": "0x"
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
        'gas_used': gasUsed1,
        'hash': contractHash1,
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
        'gas_used': gasUsed2,
        'hash': contractHash2,
        'timestamp': `${contractTimestamp2}`,
        'to': `${contractAddress2}`
      }
    ],
    'links': {
      'next': '/api/v1/contracts/results?limit=2&timestamp=lt:1653077542.701408897'
    }
  };

  const defaultContractResultsRevert = {
    'results': [
      {
        'amount': 0,
        'bloom': '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        'call_result': '0x',
        'contract_id': null,
        'created_contract_ids': [],
        'error_message': '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000',
        'from': '0x0000000000000000000000000000000000000557',
        'function_parameters': '0x',
        'gas_limit': maxGasLimit,
        'gas_used': gasUsed1,
        'hash': contractHash1,
        'timestamp': `${contractTimestamp1}`,
        'to': null
      }
    ],
    'links': {
      'next': null
    }
  };

  const defaultLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    "0x0000000000000000000000000000000000000000000000000000000000000005"
  ];

  const defaultLogTopics1 = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
  ];

  const defaultNullLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    null,
    null
  ];

  const logBloom1 = '0x1111';
  const logBloom2 = '0x2222';
  const logBloom3 = '0x3333';
  const logBloom4 = '0x4444';

  const defaultLogs1 = [
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom1,
      "contract_id": contractId1,
      "data": "0x",
      "index": 0,
      "topics": defaultLogTopics,
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp1,
      "block_hash": blockHash,
      "block_number": blockNumber,
      "transaction_hash": contractHash1,
      "transaction_index": 1
    },
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom2,
      "contract_id": contractId1,
      "data": "0x",
      "index": 1,
      "topics": defaultLogTopics,
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp1,
      "block_hash": blockHash,
      "block_number": blockNumber,
      "transaction_hash": contractHash1,
      "transaction_index": 1
    }
  ];

  const defaultLogs2 = [
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom3,
      "contract_id": contractId1,
      "data": "0x",
      "index": 0,
      "topics": [],
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp2,
      "block_hash": blockHash2,
      "block_number": blockNumber2,
      "transaction_hash": contractHash2,
      "transaction_index": 1
    }
  ];

  const defaultLogs3 = [
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom4,
      "contract_id": contractId2,
      "data": "0x",
      "index": 0,
      "topics": [],
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp3,
      "block_hash": blockHash3 ,
      "block_number": blockNumber3,
      "transaction_hash": contractHash3,
      "transaction_index": 1
    }
  ];

  const defaultLogs4 = [
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom4,
      "contract_id": contractId2,
      "data": "0x",
      "index": 0,
      "topics": defaultLogTopics1,
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp3,
      "block_hash": blockHash3 ,
      "block_number": blockNumber3,
      "transaction_hash": contractHash3,
      "transaction_index": 1
    }
  ];

  const defaultLogsList = defaultLogs1.concat(defaultLogs2).concat(defaultLogs3);
  const defaultLogs = {
    "logs": defaultLogsList
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
    'logs': defaultLogs1,
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

  const defaultCurrentContractState = {
    "state": [
      {
        'address': contractAddress1,
        'contract_id': contractId1,
        'timestamp': contractTimestamp1,
        'slot': '0x0000000000000000000000000000000000000000000000000000000000000101',
        'value': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      }
    ]
  }

  const defaultDetailedContractResults2 = {
    ...defaultDetailedContractResults, ...{
      'timestamp': contractTimestamp2,
      'block_hash': blockHash2,
      'block_number': blockNumber2,
      'hash': contractHash2,
      'logs': defaultLogs2
    }
  };

  const defaultDetailedContractResults3 = {
    ...defaultDetailedContractResults, ...{
      'timestamp': contractTimestamp3,
      'block_hash': blockHash3,
      'block_number': blockNumber3,
      'hash': contractHash3,
      'contract_id': contractId2,
      'logs': defaultLogs3
    }
  };

  const defaultDetailedContractResultsNullStateChange = {
    ...defaultDetailedContractResults, ...{
      'state_changes' : null
    }
  };

  const defaultDetailedContractResultsEmptyArrayStateChange = {
    ...defaultDetailedContractResults, ...{
      'state_changes' : []
    }
  };

  const detailedContractResultNotFound = { "_status": { "messages": [{ "message": "No correlating transaction" }] } };
  const timeoutError = { "type": "Error", "message": "timeout of 10000ms exceeded" };

  const defaultDetailedContractResultsWithNullNullableValues = {
    ...defaultDetailedContractResults,
    r: null,
    s: null
  };

  const results = defaultContractResults.results;
  const totalGasUsed = EthImpl.numberTo0x(results[0].gas_used + results[1].gas_used);

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

  const defaultContract = {
    "admin_key": null,
    "auto_renew_account": null,
    "auto_renew_period": 7776000,
    "contract_id": "0.0.1052",
    "created_timestamp": "1659622477.294172233",
    "deleted": false,
    "evm_address": null,
    "expiration_timestamp": null,
    "file_id": "0.0.1051",
    "max_automatic_token_associations": 0,
    "memo": "",
    "obtainer_id": null,
    "permanent_removal": null,
    "proxy_account_id": null,
    "timestamp": {
      "from": "1659622477.294172233",
      "to": null
    },
    "bytecode": "0x123456",
    "runtime_bytecode": mirrorNodeDeployedBytecode
  };

  const defaultContract2 = {
    ...defaultContract,
    "address": contractAddress2,
    "contract_id": contractId2,
  }

  const defaultHTSToken =
    {
      "admin_key": null,
      "auto_renew_account": "0.1.2",
      "auto_renew_period": null,
      "created_timestamp": "1234567890.000000001",
      "deleted": false,
      "decimals": 0,
      "expiry_timestamp": null,
      "freeze_default": false,
      "freeze_key": {
        "_type": "ProtobufEncoded",
        "key": 10101
      },
      "initial_supply": 0,
      "kyc_key": {
        "_type": "ProtobufEncoded",
        "key": 10101
      },
      "max_supply": 9223372036854776000,
      "memo": "token memo",
      "modified_timestamp": "1234567890.000000001",
      "name": "Token name",
      "pause_key": {
        "_type": "ProtobufEncoded",
        "key": 10101
      },
      "pause_status": "UNPAUSED",
      "supply_key": {
        "_type": "ProtobufEncoded",
        "key": 10101
      },
      "supply_type": "INFINITE",
      "symbol": "ORIGINALRDKSE",
      "token_id": "0.0.48014385",
      "total_supply": 1000000,
      "treasury_account_id": "0.1.2",
      "type": "NON_FUNGIBLE_UNIQUE",
      "wipe_key": {
        "_type": "ProtobufEncoded",
        "key": 10101
      },
      "custom_fees": {
        "created_timestamp": "1234567890.000000001",
        "fixed_fees": [
          {
            "amount": 100,
            "collector_account_id": "0.1.5",
            "denominating_token_id": "0.10.6"
          }
        ],
        "royalty_fees": [
          {
            "amount": {
              "numerator": 15,
              "denominator": 37
            },
            "collector_account_id": "0.1.6",
            "fallback_fee": {
              "amount": 100,
              "denominating_token_id": "0.10.7"
            }
          }
        ]
      }
    }


  this.afterEach(() => {
    restMock.resetHandlers();
  });

  it('"eth_blockNumber" should return the latest block number', async function () {
    restMock.onGet('blocks?limit=1&order=desc').reply(200, {
      blocks: [defaultBlock]
    });
    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found', async function () {
    restMock.onGet('blocks?limit=1&order=desc').reply(404, {
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

  it('"eth_blockNumber" return the latest block number on second try', async function () {
    restMock.onGet('blocks?limit=1&order=desc').replyOnce(404, {
      '_status': {
        'messages': [
          {
            'message': 'Block not found'
          }
        ]
      }
    }).onGet('blocks?limit=1&order=desc').replyOnce(200, {
      blocks: [defaultBlock]
    });

    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found after third try', async function () {
    restMock.onGet('blocks?limit=1&order=desc').replyOnce(404, {
      '_status': {
        'messages': [
          {
            'message': 'Block not found'
          }
        ]
      }
    }).onGet('blocks?limit=1&order=desc').replyOnce(404, {
      '_status': {
        'messages': [
          {
            'message': 'Block not found'
          }
        ]
      }
    }).onGet('blocks?limit=1&order=desc').replyOnce(404, {
      '_status': {
        'messages': [
          {
            'message': 'Block not found'
          }
        ]
      }
    }).onGet('blocks?limit=1&order=desc').replyOnce(404, {
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
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as string)).equal(contractHash1);
    expect((result.transactions[1] as string)).equal(contractHash2);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with zero transactions', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, {...defaultBlock, gas_used: 0});
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, { 'results': [] });
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal('0x0');
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(0);
    expect(result.transactionsRoot).equal(EthImpl.ethEmptyTrie);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with match and details', async function () {
    const resultWithNullGasUsed = {
      ...defaultDetailedContractResults,
      gas_used: null
    };
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, resultWithNullGasUsed);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).gas).equal("0x0");

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with block match and contract revert', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, {...defaultBlock, gas_used: gasUsed1});
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResultsRevert);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);

    const result = await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(EthImpl.numberTo0x(gasUsed1));
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(0);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByNumber with no match', async function () {
    restMock.onGet(`blocks/${blockNumber}`).reply(400, {
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
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, {"_status":{"messages":[{"message":"Not found"}]}});
    }

    const result = await ethImpl.getBlockByNumber('latest', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with pending tag', async function () {
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, {"_status":{"messages":[{"message":"Not found"}]}});
    }

    const result = await ethImpl.getBlockByNumber('pending', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with earliest tag', async function () {
    restMock.onGet(`blocks/0`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, {"_status":{"messages":[{"message":"Not found"}]}});
    }

    const result = await ethImpl.getBlockByNumber('earliest', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByNumber with hex number', async function () {
    restMock.onGet(`blocks/3735929054`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, {"_status":{"messages":[{"message":"Not found"}]}});
    }

    const result = await ethImpl.getBlockByNumber('0xdeadc0de', false);
    expect(result).to.exist;
    if (result == null) return;

    expect(result.number).equal(blockNumberHex);
  });

  it('eth_getBlockByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResults);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);

    const result = await ethImpl.getBlockByHash(blockHash, false);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as string)).equal(contractHash1);
    expect((result.transactions[1] as string)).equal(contractHash2);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByHash with match and details', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, defaultDetailedContractResultsWithNullNullableValues);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);

    const result = await ethImpl.getBlockByHash(blockHash, true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(totalGasUsed);
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(2);
    expect((result.transactions[0] as Transaction).hash).equal(contractHash1);
    expect((result.transactions[1] as Transaction).hash).equal(contractHash1);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByHash with block match and contract revert', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, {...defaultBlock, gas_used: gasUsed1});
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResultsRevert);
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);

    const result = await ethImpl.getBlockByHash(blockHash, true);
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.hash).equal(blockHashTrimmed);
    expect(result.gasUsed).equal(EthImpl.numberTo0x(gasUsed1));
    expect(result.number).equal(blockNumberHex);
    expect(result.parentHash).equal(blockHashPreviousTrimmed);
    expect(result.timestamp).equal(blockTimestampHex);
    expect(result.transactions.length).equal(0);

    // verify expected constants
    verifyBlockConstants(result);
  });

  it('eth_getBlockByHash with no match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(400, {
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

  it('eth_getBlockByHash should throw if unexpected error', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
    restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).reply(200, {...defaultDetailedContractResults, block_hash: null});
    restMock.onGet('network/fees').reply(200, defaultNetworkFees);

    try {
      await ethImpl.getBlockByHash(blockHash, false);
    } catch (e) {

      expect(e.code).to.equal(-32603);
      expect(e.name).to.equal('Internal error');
    }
  });

  it('eth_getBlockTransactionCountByNumber with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber(blockNumber.toString());
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByNumber with no match', async function () {
    restMock.onGet(`blocks/${blockNumber}`).reply(400, {
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
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('latest');
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByNumber with pending tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('pending');
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByNumber with earliest tag', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/0`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('earliest');
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByNumber with hex number', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/3735929054`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByNumber('0xdeadc0de');
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);

    const result = await ethImpl.getBlockTransactionCountByHash(blockHash);
    expect(result).equal(EthImpl.numberTo0x(blockTransactionCount));
  });

  it('eth_getBlockTransactionCountByHash with no match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${blockHash}`).reply(400, {
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
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockNumberAndIndex with null amount', async function () {
    // mirror node request mocks
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, {...defaultDetailedContractResults, amount: null});

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.value).equal("0x0");
  });

  it('eth_getTransactionByBlockNumberAndIndex with no contract result match', async function () {
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such contract result exists'
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex should throw for internal error', async function () {
    // mirror node request mocks
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, {...defaultDetailedContractResults, block_hash: null });

    try {
      await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));
    } catch (e) {
      expect(e.code).to.equal(-32603);
      expect(e.name).to.equal('Internal error');
    }
  });

  it('eth_getTransactionByBlockNumberAndIndex with no contract results', async function () {
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, {
      'results': []
    });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(EthImpl.numberTo0x(defaultBlock.number), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex with latest tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('latest', EthImpl.numberTo0x(defaultBlock.count));
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
    restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
    restMock.onGet(`contracts/results?block.number=${defaultBlock.number}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('pending', EthImpl.numberTo0x(defaultBlock.count));
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
    restMock.onGet(`contracts/results?block.number=0&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('earliest', EthImpl.numberTo0x(defaultBlock.count));
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
    restMock.onGet(`contracts/results?block.number=3735929054&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('0xdeadc0de' +
      '', EthImpl.numberTo0x(defaultBlock.count));
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
    restMock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.exist;
    if (result == null) return;

    // verify aggregated info
    expect(result.blockHash).equal(blockHashTrimmed);
    expect(result.blockNumber).equal(blockNumberHex);
    expect(result.hash).equal(contractHash1);
    expect(result.to).equal(contractAddress1);
  });

  it('eth_getTransactionByBlockHashAndIndex should throw for internal error', async function () {
    // mirror node request mocks
    restMock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, {...defaultDetailedContractResults, block_hash: null });

    try {
      await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash, EthImpl.numberTo0x(defaultBlock.count));
    } catch (e) {
      expect(e.code).to.equal(-32603);
      expect(e.name).to.equal('Internal error');
    }
  });

  it('eth_getTransactionByBlockHashAndIndex with no contract result match', async function () {
    // mirror node request mocks
    restMock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(404, {
      "_status": {
        "messages": [
          {
            "message": "Not found"
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash.toString(), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex with no contract results', async function () {
    restMock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, {
      'results': []
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash.toString(), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex with no detailed contract result match', async function () {
    restMock.onGet(`contracts/results?block.hash=${defaultBlock.hash}&transaction.index=${defaultBlock.count}&limit=100&order=asc`).reply(200, defaultContractResults);
    restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(400, {
      '_status': {
        'messages': [
          {
            'message': 'No such detailed contract result exists'
          }
        ]
      }
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(defaultBlock.hash.toString(), EthImpl.numberTo0x(defaultBlock.count));
    expect(result).to.equal(null);
  });

  describe('eth_getBalance', async function() {
    const defBalance = 99960581137;
    const defHexBalance = EthImpl.numberTo0x(defBalance * constants.TINYBAR_TO_WEIBAR_COEF);
    it('should return balance from mirror node', async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [{
          number: 10000
        }]
      });
      restMock.onGet(`accounts/${contractAddress1}`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance
        }
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, null);
      expect(resBalance).to.equal(defHexBalance);
    });

    it('should return balance from mirror node with block number passed as param the same as latest', async () => {
      const blockNumber = "0x2710"
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [{
          number: 10000
        }]
      });
      restMock.onGet(`accounts/${contractAddress1}`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance
        }
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockNumber);
      expect(resBalance).to.equal(defHexBalance);
    });

    it('should return balance from mirror node with block number passed as param, one behind latest', async () => {
      const blockNumber = "0x270F"
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [{
          number: 10000
        }]
      });
      restMock.onGet(`accounts/${contractAddress1}`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance
        }
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, blockNumber);
      expect(resBalance).to.equal(defHexBalance);
    });

    it('should return balance from consensus node', async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [{
          number: 10000
        }]
      });
      restMock.onGet(`contracts/${contractAddress1}`).reply(200, null);
      restMock.onGet(`accounts/${contractAddress1}`).reply(404, {
        _status: {
          messages: [{ message: 'Not found' }]
        }
      });

      const resBalance = await ethImpl.getBalance(contractAddress1, null);
      expect(resBalance).to.equal(EthImpl.zeroHex);
    });

    it('should return cached value for mirror nodes', async () => {
      restMock.onGet(`blocks?limit=1&order=desc`).reply(200, {
        blocks: [{
          number: 10000
        }]
      });
      restMock.onGet(`accounts/${contractAddress1}`).reply(200, {
        account: contractAddress1,
        balance: {
          balance: defBalance
        }
      });

      const resNoCache = await ethImpl.getBalance(contractAddress1, null);

      restMock.onGet(`accounts/${contractAddress1}`).reply(404, {
        _status: {
          messages: [{ message: 'Not found' }]
        }
      });

      const resCached = await ethImpl.getBalance(contractAddress1, null);
      expect(resNoCache).to.equal(defHexBalance);
      expect(resCached).to.equal(EthImpl.zeroHex);
    });

    describe('with blockNumberOrTag filter', async function() {
      const balance1 = 99960581131;
      const balance2 = 99960581132;
      const balance3 = 99960581133;
      const timestamp1 = 1651550386;
      const timestamp2 = 1651560286;
      const timestamp3 = 1651560386;
      const timestamp4 = 1651561386;

      const hexBalance1 = EthImpl.numberTo0x(balance1 * constants.TINYBAR_TO_WEIBAR_COEF);
      const hexBalance2 = EthImpl.numberTo0x(balance2 * constants.TINYBAR_TO_WEIBAR_COEF);
      const hexBalance3 = EthImpl.numberTo0x(balance3 * constants.TINYBAR_TO_WEIBAR_COEF);

      const latestBlock = Object.assign({}, defaultBlock, {
        number: 4,
        'timestamp': {
          'from': `${timestamp3}.060890949`,
          'to': `${timestamp4}.060890949`
        },
      });
      const recentBlock = Object.assign({}, defaultBlock, {
        number: 2,
        'timestamp': {
          'from': `${timestamp2}.060890949`,
          'to': `${timestamp3}.060890949`
        },
      });
      const earlierBlock = Object.assign({}, defaultBlock, {
        number: 1,
        'timestamp': {
          'from': `${timestamp1}.060890949`,
          'to': `${timestamp2}.060890949`
        },
      });

      beforeEach(async () => {
        restMock.onGet(`blocks?limit=1&order=desc`).reply(200, { blocks: [latestBlock] });
        restMock.onGet(`blocks/3`).reply(200, defaultBlock);
        restMock.onGet(`blocks/0`).reply(200, blockZero);
        restMock.onGet(`blocks/2`).reply(200, recentBlock);
        restMock.onGet(`blocks/1`).reply(200, earlierBlock);

        restMock.onGet(`accounts/${contractId1}`).reply(200, {
          account: contractId1,
          balance: {
            balance: balance3,
            timestamp: `${timestamp4}.060890949`
          }
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${earlierBlock.timestamp.from}`).reply(200, {
          "timestamp": `${timestamp1}.060890949`,
          "balances": [
            {
              "account": contractId1,
              "balance": balance1,
              "tokens": []
            }
          ],
          "links": {
            "next": null
          }
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${recentBlock.timestamp.from}`).reply(200, {
          "timestamp": `${timestamp2}.060890949`,
          "balances": [
            {
              "account": contractId1,
              "balance": balance2,
              "tokens": []
            }
          ],
          "links": {
            "next": null
          }
        });

        restMock.onGet(`balances?account.id=${contractId1}`).reply(200, {
          "timestamp": `${timestamp4}.060890949`,
          "balances": [
            {
              "account": contractId1,
              "balance": balance3,
              "tokens": []
            }
          ],
          "links": {
            "next": null
          }
        });

        restMock.onGet(`balances?account.id=${contractId1}&timestamp=${blockZero.timestamp.from}`).reply(200, {
          "timestamp": null,
          "balances": [],
          "links": {
            "next": null
          }
        });
      });

      it('latest', async () => {
        const resBalance = await ethImpl.getBalance(contractId1, 'latest');
        expect(resBalance).to.equal(hexBalance3);
      });

      it('earliest', async () => {
        const resBalance = await ethImpl.getBalance(contractId1, 'earliest');
        expect(resBalance).to.equal('0x0');
      });

      it('pending', async () => {
        const resBalance = await ethImpl.getBalance(contractId1, 'pending');
        expect(resBalance).to.equal(hexBalance3);
      });

      it('blockNumber is in the latest 15 minutes', async () => {
        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}`).reply(200, {
          transactions: []
        });

        const resBalance = await ethImpl.getBalance(contractId1, '2');
        const historicalBalance = EthImpl.numberTo0x((balance3) * constants.TINYBAR_TO_WEIBAR_COEF)
        expect(resBalance).to.equal(historicalBalance);
      });

      it('blockNumber is not in the latest 15 minutes', async () => {
        const resBalance = await ethImpl.getBalance(contractId1, '1');
        expect(resBalance).to.equal(hexBalance1);
      });

      it('blockNumber is in the latest 15 minutes and there have been several debit transactions', async () => {
        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}`).reply(200, {
          transactions: [
            buildCryptoTransferTransaction("0.0.98", contractId1, 100),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50),
            buildCryptoTransferTransaction("0.0.98", contractId1, 25),
          ]
        });

        const resBalance = await ethImpl.getBalance(contractId1, '2');
        const historicalBalance = EthImpl.numberTo0x((balance3 - 175) * constants.TINYBAR_TO_WEIBAR_COEF)
        expect(resBalance).to.equal(historicalBalance);
      });

      it('blockNumber is in the latest 15 minutes and there have been several credit transactions', async () => {
        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}`).reply(200, {
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 50),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 25),
          ]
        });

        const resBalance = await ethImpl.getBalance(contractId1, '2');
        const historicalBalance = EthImpl.numberTo0x((balance3 + 175) * constants.TINYBAR_TO_WEIBAR_COEF)
        expect(resBalance).to.equal(historicalBalance);
      });

      it('blockNumber is in the latest 15 minutes and there have been mixed credit and debit transactions', async () => {
        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}`).reply(200, {
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50),
            buildCryptoTransferTransaction(contractId1, "0.0.98", 25),
            buildCryptoTransferTransaction("0.0.98", contractId1, 10),
          ]
        });

        const resBalance = await ethImpl.getBalance(contractId1, '2');
        const historicalBalance = EthImpl.numberTo0x((balance3 + 65) * constants.TINYBAR_TO_WEIBAR_COEF)
        expect(resBalance).to.equal(historicalBalance);
      });

      it('blockNumber is in the latest 15 minutes and there have been mixed credit and debit transactions and transactions are paginated', async () => {
        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}`).reply(200, {
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 100),
            buildCryptoTransferTransaction("0.0.98", contractId1, 50)
          ],
          links: {
            next: `transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}&page=2`
          }
        });

        restMock.onGet(`transactions?account.id=${contractId1}&timestamp=gte:${recentBlock.timestamp.to}&timestamp=lt:${latestBlock.timestamp.to}&page=2`).reply(200, {
          transactions: [
            buildCryptoTransferTransaction(contractId1, "0.0.98", 25),
            buildCryptoTransferTransaction("0.0.98", contractId1, 10),
          ],
          links: {
            next: null
          }
        });

        const resBalance = await ethImpl.getBalance(contractId1, '2');
        const historicalBalance = EthImpl.numberTo0x((balance3 + 65) * constants.TINYBAR_TO_WEIBAR_COEF)
        expect(resBalance).to.equal(historicalBalance);
      });

      it('blockNumber is the same as the latest block', async () => {
        const resBalance = await ethImpl.getBalance(contractId1, '3');
        expect(resBalance).to.equal(hexBalance3);
      });
    });
  });

  describe('eth_getCode', async function() {
    it('should return cached value', async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(404, defaultContract);
      restMock.onGet(`accounts/${contractAddress1}`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.throws(new SDKClientError({status: {
        _code: 16
      }}));

      const resNoCache = await ethImpl.getCode(contractAddress1, null);
      const resCached = await ethImpl.getCode(contractAddress1, null);
      sinon.assert.calledOnce(sdkClientStub.getContractByteCode);
      expect(resNoCache).to.equal(EthImpl.emptyHex);
      expect(resCached).to.equal(EthImpl.emptyHex);
    });

    it('should return the runtime_bytecode from the mirror node', async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(200, defaultContract);
      restMock.onGet(`accounts/${contractAddress1}`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace('0x', ''), 'hex'));

      const res = await ethImpl.getCode(contractAddress1, null);
      expect(res).to.equal(mirrorNodeDeployedBytecode);
    });

    it('should return the bytecode from SDK if Mirror Node returns 404', async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(404, defaultContract);
      restMock.onGet(`accounts/${contractAddress1}`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace('0x', ''), 'hex'));
      const res = await ethImpl.getCode(contractAddress1, null);
      expect(res).to.equal(deployedBytecode);
    });

    it('should return the bytecode from SDK if Mirror Node returns empty runtime_bytecode', async () => {
      restMock.onGet(`contracts/${contractAddress1}`).reply(404, {
        ...defaultContract,
        runtime_bytecode: EthImpl.emptyHex
      });
      restMock.onGet(`accounts/${contractAddress1}`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(contractAddress1, 16)}`).reply(404, null);
      sdkClientStub.getContractByteCode.returns(Buffer.from(deployedBytecode.replace('0x', ''), 'hex'));
      const res = await ethImpl.getCode(contractAddress1, null);
      expect(res).to.equal(deployedBytecode);
    });

    it('should return redirect bytecode for HTS token', async () => {
      restMock.onGet(`contracts/${htsTokenAddress}`).reply(404, null);
      restMock.onGet(`accounts/${htsTokenAddress}`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(htsTokenAddress, 16)}`).reply(200, defaultHTSToken);
      const redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${htsTokenAddress.slice(2)}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;
      const res = await ethImpl.getCode(htsTokenAddress, null);
      expect(res).to.equal(redirectBytecode);
    });

    it('should return the static bytecode for address(0x167) call', async () => {
      restMock.onGet(`contracts/${EthImpl.iHTSAddress}`).reply(200, defaultContract);
      restMock.onGet(`accounts/${EthImpl.iHTSAddress}`).reply(404, null);

      const res = await ethImpl.getCode(EthImpl.iHTSAddress, null);
      expect(res).to.equal(EthImpl.invalidEVMInstruction);
    });
  });

  describe('eth_getLogs', async function () {
    const latestBlock = {
      ...defaultBlock,
      number: 17,
      'timestamp': {
        'from': `1651560393.060890949`,
        'to': '1651560395.060890949'
      },
    };

    const expectLogData = (res, log, tx) => {
      expect(res.address).to.eq(log.address);
      expect(res.blockHash).to.eq(EthImpl.toHash32(tx.block_hash));
      expect(res.blockHash.length).to.eq(66);
      expect(res.blockNumber).to.eq(EthImpl.numberTo0x(tx.block_number));
      expect(res.data).to.eq(log.data);
      expect(res.logIndex).to.eq(EthImpl.numberTo0x(log.index));
      expect(res.removed).to.eq(false);
      expect(res.topics).to.exist;
      expect(res.topics).to.deep.eq(log.topics);
      expect(res.transactionHash).to.eq(tx.hash);
      expect(res.transactionHash.length).to.eq(66);
      expect(res.transactionIndex).to.eq(EthImpl.numberTo0x(tx.transaction_index));
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

    it('blockHash filter timeouts and throws the expected error', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };

      restMock.onGet(`blocks/${blockHash}`).timeout();
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);

      try {
        await ethImpl.getLogs(blockHash, null, null, null, null);
        expect(true).to.eq(false);
      } catch (error: any) {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq("timeout of 10000ms exceeded");
      }
    });

    it('address filter timeouts and throws the expected error', async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).timeout();

      try {
        await ethImpl.getLogs(null, null, null, contractAddress1, null);
        expect(true).to.eq(false);
      } catch (error: any) {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq("timeout of 10000ms exceeded");
      }
    });

    it('error when retrieving logs', async function () {
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(400, { "_status": { "messages": [{ "message": "Mocked error" }] } });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;
      expect(result.length).to.eq(0);
    });

    it('no filters', async function () {
      const filteredLogs = {
        logs: [
          defaultLogs.logs[0],
          {...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952"},
          {...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953"},
          {...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954"}
        ]
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      filteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, {...defaultContract, contract_id: `0.0.105${index}`});
      });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData(result[0], filteredLogs.logs[0], defaultDetailedContractResults);
      expectLogData(result[1], filteredLogs.logs[1], defaultDetailedContractResults);
      expectLogData(result[2], filteredLogs.logs[2], defaultDetailedContractResults2);
      expectLogData(result[3], filteredLogs.logs[3], defaultDetailedContractResults3);
    });

    it('should be able to return more than two logs with limit of two per request', async function () {
      const unfilteredLogs = {
        logs: [
          {...defaultLogs.logs[0], address: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69"},
          {...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952"},
          {...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953"},
          {...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954"}
        ]
      }
      const filteredLogs = {
        logs: [
          {...defaultLogs.logs[0], address: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69"},
          {...defaultLogs.logs[1], address: "0x0000000000000000000000000000000002131952"}
        ],
        links: {next: 'contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0'}
      };
      const filteredLogsNext = {
        logs: [
          {...defaultLogs.logs[2], address: "0x0000000000000000000000000000000002131953"},
          {...defaultLogs.logs[3], address: "0x0000000000000000000000000000000002131954"}
        ],
        links: {next: null}
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });

      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=2&order=asc`).replyOnce(200, filteredLogs)
      .onGet('contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0').replyOnce(200, filteredLogsNext);

      unfilteredLogs.logs.forEach((log , index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, {...defaultContract, contract_id: `0.0.105${index}`});
      });
      //setting mirror node limit to 2 for this test only
      process.env['MIRROR_NODE_LIMIT_PARAM'] = '2';
      const result = await ethImpl.getLogs(null, null, null, null, null, undefined);
      //resetting mirror node limit to 100
      process.env['MIRROR_NODE_LIMIT_PARAM'] = '100';
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData(result[0], filteredLogs.logs[0], defaultDetailedContractResults);
      expectLogData(result[1], filteredLogs.logs[1], defaultDetailedContractResults);
      expectLogData(result[2], filteredLogsNext.logs[0], defaultDetailedContractResults2);
      expectLogData(result[3], filteredLogsNext.logs[1], defaultDetailedContractResults3);

    });

    it('Should return evm address if contract has one', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0]]
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      restMock.onGet(`contracts/${filteredLogs.logs[0].address}`).reply(200, {...defaultContract, evm_address: defaultEvmAddress});

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(1);
      expect(result[0].address).to.eq(defaultEvmAddress);
    });

    it('address filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1], defaultLogs.logs[2]]
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, null, null, contractAddress1, null);

      expect(result).to.exist;

      expect(result.length).to.eq(3);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
    });

    it('multiple addresses filter', async function () {
      const filteredLogsAddress1 = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1], defaultLogs.logs[2]]
      };
      const filteredLogsAddress2 = {
        logs: defaultLogs3
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/${contractAddress1}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogsAddress1);
      restMock.onGet(`contracts/${contractAddress2}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogsAddress2);
      for (const log of filteredLogsAddress1.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }
      restMock.onGet(`contracts/${contractAddress2}`).reply(200, defaultContract2);

      const result = await ethImpl.getLogs(null, null, null, [contractAddress1, contractAddress2], null);

      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
      expectLogData4(result[3]);
    });

    it('blockHash filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };

      restMock.onGet(`blocks/${blockHash}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(blockHash, null, null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with valid fromBlock && toBlock filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };
      const toBlock = {
        ...defaultBlock,
        number: 16,
        'timestamp': {
          'from': `1651560391.060890949`,
          'to': '1651560393.060890949'
        },
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/5').reply(200, defaultBlock);
      restMock.onGet('blocks/16').reply(200, toBlock);
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${toBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with non-existing fromBlock filter', async function () {
      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});

      restMock.onGet('blocks/5').reply(200, defaultBlock);
      restMock.onGet('blocks/16').reply(404, {"_status": { "messages": [{"message": "Not found"}]}});

      const result = await ethImpl.getLogs(null, '0x10', '0x5', null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it('with non-existing toBlock filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0]]
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/5').reply(200, defaultBlock);
      restMock.onGet('blocks/16').reply(404, {"_status": { "messages": [{"message": "Not found"}]}});
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&limit=100&order=asc`).reply(200, filteredLogs);
      restMock.onGet(`contracts/${filteredLogs.logs[0].address}`).reply(200, defaultContract);

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it('when fromBlock > toBlock', async function () {
      const fromBlock = {
        ...defaultBlock,
        number: 16,
        'timestamp': {
          'from': `1651560391.060890949`,
          'to': '1651560393.060890949'
        },
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/16').reply(200, fromBlock);
      restMock.onGet('blocks/5').reply(200, defaultBlock);
      const result = await ethImpl.getLogs(null, '0x10', '0x5', null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it('with only toBlock', async function () {
      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/5').reply(200, {blocks: [defaultBlock]});

      let hasError = false;
      try {
        await ethImpl.getLogs(null, null, '0x5', null, null);
      } catch (e: any) {
        hasError = true;
        expect(e.code).to.equal(-32011);
        expect(e.name).to.equal('Missing fromBlock parameter');
        expect(e.message).to.equal('Provided toBlock parameter without specifying fromBlock');
      }
      expect(hasError).to.be.true;
    });

    it('with block tag', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0]]
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, 'latest', null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it('when block range is too large', async function () {
      const fromBlock = {
        ...defaultBlock,
        number: 1
      };
      const toBlock = {
        ...defaultBlock,
        number: 1003
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/1').reply(200, fromBlock);
      restMock.onGet('blocks/1003').reply(200, toBlock);

      try {
        await ethImpl.getLogs(null, '0x1', '0x3eb', null, null);
      } catch (error: any) {
        expect(error.message).to.equal('Exceeded maximum block range: 1000');
      }
    });

    it('with topics filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };

      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(
        `contracts/results/logs` +
        `?timestamp=gte:${defaultBlock.timestamp.from}` +
        `&timestamp=lte:${defaultBlock.timestamp.to}` +
        `&topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
        `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}&limit=100&order=asc`
      ).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, null, null, null, defaultLogTopics);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with null topics filter', async function() {
      const filteredLogs = {
        logs: [defaultLogs4[0]]
      };
      restMock.onGet("blocks?limit=1&order=desc").reply(200, { blocks: [defaultBlock] });
      restMock.onGet(
        `contracts/results/logs` +
        `?timestamp=gte:${defaultBlock.timestamp.from}` +
        `&timestamp=lte:${defaultBlock.timestamp.to}` +
        `&topic0=${defaultLogTopics1[0]}` +
        `&topic1=${defaultLogTopics1[1]}&limit=100&order=asc`
      ).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }
      const result = await ethImpl.getLogs(null, null, null, null, defaultNullLogTopics);

      expect(result).to.exist;
      expect(result[0].topics.length).to.eq(defaultLogs4[0].topics.length)
      for (let index = 0; index < result[0].topics.length; index++) {
        expect(result[0].topics[index]).to.eq(defaultLogs4[0].topics[index]);
      }
    });

    it('with topics and blocks filter', async function () {
      const filteredLogs = {
        logs: [defaultLogs.logs[0], defaultLogs.logs[1]]
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
      restMock.onGet('blocks/5').reply(200, defaultBlock);
      restMock.onGet('blocks/16').reply(200, defaultBlock);
      restMock.onGet(
        `contracts/results/logs` +
        `?timestamp=gte:${defaultBlock.timestamp.from}` +
        `&timestamp=lte:${defaultBlock.timestamp.to}` +
        `&topic0=${defaultLogTopics[0]}&topic1=${defaultLogTopics[1]}` +
        `&topic2=${defaultLogTopics[2]}&topic3=${defaultLogTopics[3]}&limit=100&order=asc`
      ).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, defaultContract);
      }

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, defaultLogTopics);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });
  });

  it('eth_feeHistory', async function () {
    const previousBlock = {...defaultBlock, number: blockNumber2, timestamp: {
      from: '1651560386.060890948',
      to: '1651560389.060890948'
    }};
    const latestBlock = {...defaultBlock, number: blockNumber3};
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    previousFees.fees[2].gas += 1;

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(2, 'latest', [25, 75]);

    expect(feeHistory).to.exist;
    expect(feeHistory['baseFeePerGas'].length).to.equal(3);
    expect(feeHistory['gasUsedRatio'].length).to.equal(2);
    expect(feeHistory['baseFeePerGas'][0]).to.equal('0x870ab1a800');
    expect(feeHistory['baseFeePerGas'][1]).to.equal('0x84b6a5c400');
    expect(feeHistory['baseFeePerGas'][2]).to.equal('0x84b6a5c400');
    expect(feeHistory['gasUsedRatio'][0]).to.equal(gasUsedRatio);
    expect(feeHistory['oldestBlock']).to.equal(`0x${previousBlock.number.toString(16)}`);
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory with latest param', async function () {
    const previousBlock = {...defaultBlock, number: blockNumber2, timestamp: {
      from: '1651560386.060890948',
      to: '1651560389.060890948'
    }};
    const latestBlock = {...defaultBlock, number: blockNumber3};
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + blockNumber3);
  });

  it('eth_feeHistory with pending param', async function () {
    const previousBlock = {...defaultBlock, number: blockNumber2, timestamp: {
      from: '1651560386.060890948',
      to: '1651560389.060890948'
    }};
    const latestBlock = {...defaultBlock, number: blockNumber3};
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'pending', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + blockNumber3);
  });

  it('eth_feeHistory with earliest param', async function () {
    const firstBlockIndex = 0;
    const secondBlockIndex = 1;
    const previousBlock = {...defaultBlock, number: firstBlockIndex, timestamp: {
      from: '1651560386.060890948',
      to: '1651560389.060890948'
    }};
    const latestBlock = {...defaultBlock, number: secondBlockIndex};
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'earliest', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + firstBlockIndex);
  });

  it('eth_feeHistory with number param', async function () {
    const previousBlock = {...defaultBlock, number: blockNumber2, timestamp: {
      from: '1651560386.060890948',
      to: '1651560389.060890948'
    }};
    const latestBlock = {...defaultBlock, number: blockNumber3};
    const previousFees = JSON.parse(JSON.stringify(defaultNetworkFees));
    const latestFees = JSON.parse(JSON.stringify(defaultNetworkFees));

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, '0x'+blockNumber3, [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + blockNumber3);
  });

  it('eth_feeHistory with max results', async function () {
    const maxResultsCap = Number(constants.DEFAULT_FEE_HISTORY_MAX_RESULTS);

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [{...defaultBlock, number: 10}]});
    restMock.onGet(`network/fees?timestamp=lte:${defaultBlock.timestamp.to}`).reply(200, defaultNetworkFees);
    Array.from(Array(11).keys()).map(blockNumber => restMock.onGet(`blocks/${blockNumber}`).reply(200, {...defaultBlock, number: blockNumber}))

    const feeHistory = await ethImpl.feeHistory(200, '0x9', [0]);

    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.equal(`0x0`);
    expect(feeHistory['reward'].length).to.equal(maxResultsCap);
    expect(feeHistory['baseFeePerGas'].length).to.equal(maxResultsCap + 1);
    expect(feeHistory['gasUsedRatio'].length).to.equal(maxResultsCap);
  });

  it('eth_feeHistory verify cached value', async function () {
    const latestBlock = {...defaultBlock, number: blockNumber3};
    const latestFees = defaultNetworkFees;

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const firstFeeHistory = await ethImpl.feeHistory(1, 'latest', null);
    const secondFeeHistory = await ethImpl.feeHistory(3, 'latest', null);

    expect(firstFeeHistory).to.exist;
    expect(firstFeeHistory['baseFeePerGas'][0]).to.equal('0x84b6a5c400');
    expect(firstFeeHistory['gasUsedRatio'][0]).to.equal(gasUsedRatio);
    expect(firstFeeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);

    expect(firstFeeHistory).to.equal(secondFeeHistory);
  });

  it('eth_feeHistory on mirror 404', async function () {
    const latestBlock = {...defaultBlock, number: blockNumber3};

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: 'Not found' }]
      }
    });
    const fauxGasTinyBars = 25_000;
    const fauxGasWeiBarHex = '0xe35fa931a000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);

    expect(feeHistory).to.exist;

    expect(feeHistory['baseFeePerGas'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatio'][0]).to.equal(gasUsedRatio);
    expect(feeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory on mirror 500', async function () {
    const latestBlock = {...defaultBlock, number: blockNumber3};

    restMock.onGet('blocks?limit=1&order=desc').reply(200, {blocks: [latestBlock]});
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: 'Not found' }]
      }
    });

    const fauxGasTinyBars = 35_000;
    const fauxGasWeiBarHex = '0x13e52b9abe000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', null);

    expect(feeHistory['baseFeePerGas'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatio'][0]).to.equal(gasUsedRatio);
    expect(feeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);
  });

  it('eth_estimateGas contract call returns default', async function () {
    const gas = await ethImpl.estimateGas({ data: "0x01" }, null);
    expect(gas).to.equal(EthImpl.defaultGas);
  });

  it('eth_estimateGas transfer to existing account', async function() {
    const receiverAddress = '0x5b98Ce3a4D1e1AC55F15Da174D5CeFcc5b8FB994';
    restMock.onGet(`accounts/${receiverAddress}`).reply(200, { address: receiverAddress });

    const gas = await ethImpl.estimateGas({
      to: receiverAddress,
      value: 100_000_000_000
    }, null);
    expect(gas).to.equal(EthImpl.gasTxBaseCost);
  });

  it('eth_estimateGas empty call returns transfer cost', async function () {
    restMock.onGet(`accounts/undefined`).reply(404);
    const gas = await ethImpl.estimateGas({}, null);
    expect(gas).to.equal(EthImpl.gasTxHollowAccountCreation);
  });

  it('eth_estimateGas empty input transfer cost', async function () {
    restMock.onGet(`accounts/undefined`).reply(404);
    const gas = await ethImpl.estimateGas({ data: "" }, null);
    expect(gas).to.equal(EthImpl.gasTxHollowAccountCreation);
  });

  it('eth_estimateGas zero input returns transfer cost', async function () {
    restMock.onGet(`accounts/undefined`).reply(404);
    const gas = await ethImpl.estimateGas({ data: "0x" }, null);
    expect(gas).to.equal(EthImpl.gasTxHollowAccountCreation);
  });

  it('eth_gasPrice', async function () {
    restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);

    const weiBars = await ethImpl.gasPrice();
    const expectedWeiBars = defaultNetworkFees.fees[2].gas * constants.TINYBAR_TO_WEIBAR_COEF;
    expect(weiBars).to.equal(EthImpl.numberTo0x(expectedWeiBars));
  });

  it('eth_gasPrice with cached value', async function () {
    restMock.onGet(`network/fees`).reply(200, defaultNetworkFees);

    const firstGasResult = await ethImpl.gasPrice();

    const modifiedNetworkFees = Object.assign({}, defaultNetworkFees);
    modifiedNetworkFees.fees[2].gas = defaultNetworkFees.fees[2].gas * 100;

    restMock.onGet(`network/fees`).reply(200, modifiedNetworkFees);

    const secondGasResult = await ethImpl.gasPrice();

    expect(firstGasResult).to.equal(secondGasResult);
  });

  it('eth_gasPrice with no EthereumTransaction gas returned', async function () {
    const partialNetworkFees = Object.assign({}, defaultNetworkFees);
    partialNetworkFees.fees.splice(2);

    restMock.onGet(`network/fees`).reply(200, partialNetworkFees);

    try {
      await ethImpl.gasPrice();
    } catch (error: any) {
      expect(error.message).to.equal('Error encountered estimating the gas price');
    }
  });

  it('eth_gasPrice with mirror node return network fees found', async function () {
    restMock.onGet(`network/fees`).reply(404, {
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
    restMock.onGet(`network/fees`).reply(404, {
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

  describe('eth_call using consensus node', async function () {
    let initialEthCallConesneusFF;

    before(() => {
      initialEthCallConesneusFF = process.env.ETH_CALL_CONSENSUS;
      process.env.ETH_CALL_CONSENSUS = 'true';
    });

    after(() => {
      process.env.ETH_CALL_CONSENSUS = initialEthCallConesneusFF;
    })

    it('eth_call with no gas', async function () {
      sdkClientStub.submitContractCallQuery.returns({
            asBytes: function () {
              return Uint8Array.of(0);
            }
          }
      );

      const result = await ethImpl.call({
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
      }, 'latest');

      sinon.assert.calledWith(sdkClientStub.submitContractCallQuery, contractAddress2, contractCallData, 400_000, contractAddress1, 'eth_call');
      expect(result).to.equal("0x00");
    });

    it('eth_call with no data', async function () {
      sdkClientStub.submitContractCallQuery.returns({
            asBytes: function () {
              return Uint8Array.of(0);
            }
          }
      );

      const result = await ethImpl.call({
        "from": contractAddress1,
        "to": contractAddress2,
        "gas": maxGasLimitHex
      }, 'latest');

      sinon.assert.calledWith(sdkClientStub.submitContractCallQuery, contractAddress2, undefined, maxGasLimit, contractAddress1, 'eth_call');
      expect(result).to.equal("0x00");
    });

    it('eth_call with no from address', async function () {
      sdkClientStub.submitContractCallQuery.returns({
            asBytes: function () {
              return Uint8Array.of(0);
            }
          }
      );

      const result = await ethImpl.call({
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimitHex
      }, 'latest');

      sinon.assert.calledWith(sdkClientStub.submitContractCallQuery, contractAddress2, contractCallData, maxGasLimit, undefined, 'eth_call');
      expect(result).to.equal("0x00");
    });

    it('eth_call with all fields', async function () {
      sdkClientStub.submitContractCallQuery.returns({
            asBytes: function () {
              return Uint8Array.of(0);
            }
          }
      );

      const result = await ethImpl.call({
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimitHex
      }, 'latest');

      sinon.assert.calledWith(sdkClientStub.submitContractCallQuery, contractAddress2, contractCallData, maxGasLimit, contractAddress1, 'eth_call');
      expect(result).to.equal("0x00");
    });

    //Return once the value, then it's being fetched from cache. After the loop we reset the sdkClientStub, so that it returns nothing, if we get an error in the next request that means that the cache was cleared.
    it('eth_call should cache the response for 200ms', async function () {
      sdkClientStub.submitContractCallQuery.returns({
        asBytes: function () {
          return Uint8Array.of(0);
            }
          }
      );

      for (let index = 0; index < 3; index++) {
        const result = await ethImpl.call({
          "from": contractAddress1,
          "to": contractAddress2,
          "data": contractCallData,
          "gas": maxGasLimitHex
        }, 'latest');
        expect(result).to.equal("0x00");
        await new Promise(r => setTimeout(r, 50));
      }

      sinon.resetBehavior();
      await new Promise(r => setTimeout(r, 200));
      try {
        await ethImpl.call({
          "from": contractAddress1,
          "to": contractAddress2,
          "data": contractCallData,
          "gas": maxGasLimitHex
        }, 'latest');
      } catch (error) {
        expect(error.code).to.equal(predefined.INTERNAL_ERROR().code);
        expect(error.name).to.equal(predefined.INTERNAL_ERROR().name);
      }

    });

    describe('with gas > 15_000_000', async function() {
      it('caps gas at 15_000_000', async function () {
        sdkClientStub.submitContractCallQuery.returns({
              asBytes: function () {
                return Uint8Array.of(0);
              }
            }
        );

        const result = await ethImpl.call({
          "from": contractAddress1,
          "to": contractAddress2,
          "data": contractCallData,
          "gas": 50_000_000
        }, 'latest');

        sinon.assert.calledWith(sdkClientStub.submitContractCallQuery, contractAddress2, contractCallData, 15_000_000, contractAddress1, 'eth_call');
        expect(result).to.equal("0x00");
      });
    });

    it('SDK returns a precheck error', async function () {
      sdkClientStub.submitContractCallQuery.throws(predefined.CONTRACT_REVERT(defaultErrorMessage));

      const result = await ethImpl.call({
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimitHex
      }, 'latest');

      expect(result).to.exist;
      expect(result.code).to.equal(-32008);
      expect(result.name).to.equal('Contract revert executed');
      expect(result.message).to.equal('execution reverted: Set to revert');
      expect(result.data).to.equal(defaultErrorMessage);
    });

    it('eth_call with missing `to` field', async function() {
      try {
        await ethImpl.call({
          "from": contractAddress1,
          "data": contractCallData,
          "gas": maxGasLimitHex
        }, 'latest');
      } catch (error: any) {
        expect(error.message).to.equal(`Invalid Contract Address: ${undefined}.`);
      }
    });

    it('eth_call with wrong `to` field', async function() {
      try {
        await ethImpl.call({
          "from": contractAddress1,
          "to": wrongContractAddress,
          "data": contractCallData,
          "gas": maxGasLimitHex
        }, 'latest');
      } catch (error: any) {
        expect(error.message).to.equal(`Invalid Contract Address: ${wrongContractAddress}. Expected length of 42 chars but was ${wrongContractAddress.length}.`);
      }
    });
  });

  describe('eth_call using mirror node', async function () {
    const defaultCallData = {
      "gas": 400000,
      "value": null
    }
    let initialEthCallConesneusFF;

    before(() => {
      initialEthCallConesneusFF = process.env.ETH_CALL_CONSENSUS;
      process.env.ETH_CALL_CONSENSUS = 'false';
    });

    after(() => {
      process.env.ETH_CALL_CONSENSUS = initialEthCallConesneusFF;
    })

    //temporary workaround until precompiles are implemented in Mirror node evm module
    beforeEach(() => {
      restMock.onGet(`tokens/${defaultContractResults.results[1].contract_id}`).reply(404, null);
    })

    it('eth_call with no gas', async function () {
      const callData = {
        ...defaultCallData,
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData
      };

      web3Mock.onPost('contracts/call', {...callData, estimate: false}).reply(200, {result: `0x00`});
      const result = await ethImpl.call(callData, 'latest');
      expect(result).to.equal("0x00");
    });

    it('eth_call with no data', async function () {
      const callData = {
        ...defaultCallData,
        "from": contractAddress1,
        "to": contractAddress2,
        "gas": maxGasLimit
      };
      web3Mock.onPost('contracts/call', {...callData, estimate: false}).reply(200, {result: `0x00`});

      const result = await ethImpl.call(callData, 'latest');
      expect(result).to.equal("0x00");
    });

    it('eth_call with no from address', async function () {
      const callData = {
        ...defaultCallData,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimit
      };
      web3Mock.onPost('contracts/call', {...callData, estimate: false}).reply(200, {result: `0x00`});
      const result = await ethImpl.call(callData, 'latest');
      expect(result).to.equal("0x00");
    });

    it('eth_call with all fields', async function () {
      const callData = {
        ...defaultCallData,
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimit
      };
      web3Mock.onPost('contracts/call', {...callData, estimate: false}).reply(200, {result: `0x00`});
      const result = await ethImpl.call(callData, 'latest');
      expect(result).to.equal("0x00");
    });

    it('caps gas at 15_000_000', async function () {
      const callData = {
        ...defaultCallData,
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": 50_000_000
      };
      web3Mock.onPost('contracts/call', {...callData, estimate: false, gas: 15_000_000}).reply(200, {result: `0x00`});
      const result = await ethImpl.call(callData, 'latest');
      expect(result).to.equal("0x00");
    });

    it('SDK returns a precheck error', async function () {
      const callData = {
        ...defaultCallData,
        "from": contractAddress1,
        "to": contractAddress2,
        "data": contractCallData,
        "gas": maxGasLimit
      };

      // FIXME this probably is not the real behaviour
      web3Mock.onPost('contracts/call', {...callData, estimate: false}).reply(200, {
        result: predefined.CONTRACT_REVERT(defaultErrorMessage).data
      });

      const result = await ethImpl.call(callData, 'latest');

      expect(result).to.exist;
      expect(result).to.equal(predefined.CONTRACT_REVERT(defaultErrorMessage).data);
    });

    it('eth_call with missing `to` field', async function() {
      try {
        await ethImpl.call({
          ...defaultCallData,
          "from": contractAddress1,
          "data": contractCallData,
          "gas": maxGasLimit
        }, 'latest');
      } catch (error: any) {
        expect(error.message).to.equal(`Invalid Contract Address: ${undefined}.`);
      }
    });

    it('eth_call with wrong `to` field', async function() {
      try {
        await ethImpl.call({
          ...defaultCallData,
          "from": contractAddress1,
          "to": wrongContractAddress,
          "data": contractCallData,
          "gas": maxGasLimit
        }, 'latest');
      } catch (error: any) {
        expect(error.message).to.equal(`Invalid Contract Address: ${wrongContractAddress}. Expected length of 42 chars but was ${wrongContractAddress.length}.`);
      }
    });
  });

  describe('eth_sendRawTransaction', async function() {
    it('should return a predefined INTERNAL_ERROR instead of NUMERIC_FAULT as precheck exception', async function() {
      // tx with 'gasLimit: BigNumber { value: "30678687678687676876786786876876876000" }'
      const txHash = '0x02f881820128048459682f0086014fa0186f00901714801554cbe52dd95512bedddf68e09405fba803be258049a27b820088bab1cad205887185174876e80080c080a0cab3f53602000c9989be5787d0db637512acdd2ad187ce15ba83d10d9eae2571a07802515717a5a1c7d6fa7616183eb78307b4657d7462dbb9e9deca820dd28f62';

      let hasError = false;
      restMock.onGet('network/fees').reply(200, defaultNetworkFees);
      try {
        await ethImpl.sendRawTransaction(txHash);
      } catch (e) {
        hasError = true;
        expect(e.code).to.equal(-32603);
        expect(e.name).to.equal('Internal error');
      }
      expect(hasError).to.be.true;
    });
  });

  describe('eth_getStorageAt', async function() {
    it('eth_getStorageAt with match with block and slot less than 32 bytes and without leading zeroes', async function() {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

      const result = await ethImpl.getStorageAt(contractAddress1, '0x101', EthImpl.numberTo0x(blockNumber));
      expect(result).to.exist;
      if (result == null) return;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with block and slot less than 32 bytes and leading zeroes', async function() {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

      const result = await ethImpl.getStorageAt(contractAddress1, '0x0000101', EthImpl.numberTo0x(blockNumber));
      expect(result).to.exist;
      if (result == null) return;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with block', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot, EthImpl.numberTo0x(blockNumber));
      expect(result).to.exist;
      if (result == null) return;

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with latest block', async function () {
      // mirror node request mocks
      restMock.onGet(`contracts/${contractAddress1}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`).reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultCurrentContractState.state[0].slot, "latest");
      expect(result).to.exist;
      if (result == null) return;

      // verify slot value
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    // Block number is a required param, this should not work and should be removed when/if validations are added.
    // Instead the relay should return `missing value for required argument <argumentIndex> error`.
    it('eth_getStorageAt with match null block', async function () {
      // mirror node request mocks
      restMock.onGet(`contracts/${contractAddress1}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`).reply(200, defaultCurrentContractState);

      const result = await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot);
      expect(result).to.exist;
      if (result == null) return;

      // verify slot value
      expect(result).equal(defaultCurrentContractState.state[0].value);
    });

    it('eth_getStorageAt should throw a predefined RESOURCE_NOT_FOUND when block not found', async function () {

      let hasError = false;
      try {
        restMock.onGet(`blocks/${blockNumber}`).reply(200, null);
        await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot, EthImpl.numberTo0x(blockNumber));
      } catch (e: any) {
        hasError = true;
        expect(e.code).to.equal(predefined.RESOURCE_NOT_FOUND().code);
        expect(e.name).to.equal(predefined.RESOURCE_NOT_FOUND().name);
      }
      expect(hasError).to.be.true;
    });

    it('eth_getStorageAt should return EthImpl.zeroHex32Byte when state_changes is null', async function () {
      defaultDetailedContractResultsNullStateChange
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsNullStateChange);
      const result = await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot, EthImpl.numberTo0x(blockNumber));
      expect(result).to.equal(EthImpl.zeroHex32Byte);
    });

    it('eth_getStorageAt should return EthImpl.zeroHex32Byte when state_changes is an empty array', async function () {
      defaultDetailedContractResultsNullStateChange
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResultsEmptyArrayStateChange);
      const result = await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot, EthImpl.numberTo0x(blockNumber));
      expect(result).to.equal(EthImpl.zeroHex32Byte);
    });

    it('eth_getStorageAt should throw error when contract not found', async function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${contractAddress1}/results?timestamp=lte:${defaultBlock.timestamp.to}&limit=1&order=desc`).reply(200, defaultContractResults);
      restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(404, detailedContractResultNotFound);

      let hasError = false;
      try {
        await ethImpl.getStorageAt(contractAddress1, defaultDetailedContractResults.state_changes[0].slot, EthImpl.numberTo0x(blockNumber));
      } catch (e: any) {
        hasError = true;
        expect(e.code).to.equal(predefined.RESOURCE_NOT_FOUND().code);
        expect(e.name).to.equal(predefined.RESOURCE_NOT_FOUND().name);
      }
      expect(hasError).to.be.true;
    });
  });
});

describe('Eth', async function () {
  this.timeout(10000);

  let ethImpl: EthImpl;
  this.beforeAll(() => {
    // @ts-ignore
    ethImpl = new EthImpl(null, mirrorNodeInstance, logger);
  });

  const contractEvmAddress = '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9';
  const defaultTxHash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
  const defaultTransaction = {
    "accessList": undefined,
    "blockHash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "blockNumber": "0x11",
    "chainId": "0x12a",
    "from": `${defaultEvmAddress}`,
    "gas": "0x7b",
    "gasPrice": "0x4a817c80",
    "hash": defaultTxHash,
    "input": "0x0707",
    "maxFeePerGas": undefined,
    "maxPriorityFeePerGas": undefined,
    "nonce": 1,
    "r": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
    "s": "0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
    "to": "0x0000000000000000000000000000000000001389",
    "transactionIndex": "0x1",
    "type": 2,
    "v": 1,
    "value": "0x77359400"
  };

  const defaultDetailedContractResultByHash = {
    "address": "0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9",
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


  const defaultDetailedContractResultByHashReverted = {
    ...defaultDetailedContractResultByHash, ...{
      "result": "CONTRACT_REVERT_EXECUTED",
      "status": "0x0",
      "error_message": "0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000"
    }
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
      "blockHash": "0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
      "blockNumber": "0x11",
      "data": "0x0123",
      "logIndex": "0x0",
      "removed": false,
      "topics": [
        "0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"
      ],
      "transactionHash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
      "transactionIndex": "0x1"
    }],
    "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "status": "0x1",
    "transactionHash": "0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
    "transactionIndex": "0x1",
    "contractAddress": "0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9",
    "root": undefined
  };

  this.afterEach(() => {
    restMock.resetHandlers();
  });


  it('should execute "eth_chainId"', async function () {
    const chainId = await Relay.eth().chainId();

    expect(chainId).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
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

  it('should execute "eth_maxPriorityFeePerGas"', async function () {
    const result = await Relay.eth().maxPriorityFeePerGas();
    expect(result).to.eq('0x0');
  });

  const unsupportedMethods = [
    'submitHashrate',
    'signTransaction',
    'sign',
    'sendTransaction',
    'protocolVersion',
    'coinbase',
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
      restMock.onGet(`contracts/results/${txHash}`).reply(404, {
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
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
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

    it('valid receipt with evm address on match', async function() {
      // mirror node request mocks
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(200, {
        evm_address: contractEvmAddress
      });
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;

      expect(validateHash(receipt.from, 40)).to.eq(true);
      if (receipt.contractAddress) {
        expect(validateHash(receipt.contractAddress, 40)).to.eq(true);
      }
      expect(receipt.contractAddress).to.eq(contractEvmAddress);
    });

    it("Handles null effectiveGasPrice", async function() {
      const contractResult = {
        ...defaultDetailedContractResultByHash,
        gas_price: null,
        max_fee_per_gas: null
      };

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, contractResult);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;

      expect(receipt.effectiveGasPrice).to.eq('0x0');
    });

    it('handles empty bloom', async function () {
      const receiptWith0xBloom = {
        ...defaultDetailedContractResultByHash,
        bloom: '0x'
      };
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, receiptWith0xBloom);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;
      expect(receipt.logsBloom).to.eq(EthImpl.emptyBloom);
    });

    it('Adds a revertReason field for receipts with errorMessage', async function() {
      const receiptWithErrorMessage = {
        ...defaultDetailedContractResultByHash,
        error_message: defaultErrorMessage
      };

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, receiptWithErrorMessage);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      expect(receipt.revertReason).to.eq(defaultErrorMessage);
    });

    it('handles empty gas_used', async function () {
      const receiptWithNullGasUsed = {
        ...defaultDetailedContractResultByHash,
        gas_used: null
      };
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, receiptWithNullGasUsed);
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(404);
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;
      if (receipt == null) return;
      expect(receipt.gasUsed).to.eq("0x0");
    });

    it('handles missing transaction index', async function() {
      // mirror node request mocks
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, {
        ...defaultDetailedContractResultByHash, ...{
          transaction_index: undefined
        }
      });
      restMock.onGet(`contracts/${defaultDetailedContractResultByHash.created_contract_ids[0]}`).reply(200, {
        evm_address: contractEvmAddress
      });
      const receipt = await ethImpl.getTransactionReceipt(defaultTxHash);

      expect(receipt).to.exist;

      expect(receipt.logs[0].transactionIndex).to.eq(null);
      expect(receipt.transactionIndex).to.eq(null);
    });
  });

  describe('eth_getTransactionByHash', async function () {
    it('returns `null` for non-existing hash', async function () {
      // mirror node request mocks
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(404, {
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
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHash);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });

      const result = await ethImpl.getTransactionByHash(defaultTxHash);

      expect(result).to.exist;
      if (result == null) return;

      expect(result.accessList).to.eq(defaultTransaction.accessList);
      expect(result.blockHash).to.eq(defaultTransaction.blockHash);
      expect(result.blockNumber).to.eq(defaultTransaction.blockNumber);
      expect(result.chainId).to.eq(defaultTransaction.chainId);
      expect(result.from).to.eq(defaultTransaction.from);
      expect(result.gas).to.eq(defaultTransaction.gas);
      expect(result.gasPrice).to.eq(defaultTransaction.gasPrice);
      expect(result.hash).to.eq(defaultTransaction.hash);
      expect(result.input).to.eq(defaultTransaction.input);
      expect(result.maxFeePerGas).to.eq(defaultTransaction.maxFeePerGas);
      expect(result.maxPriorityFeePerGas).to.eq(defaultTransaction.maxPriorityFeePerGas);
      expect(result.nonce).to.eq(EthImpl.numberTo0x(defaultTransaction.nonce));
      expect(result.r).to.eq(defaultTransaction.r);
      expect(result.s).to.eq(defaultTransaction.s);
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(EthImpl.numberTo0x(defaultTransaction.type));
      expect(result.v).to.eq(EthImpl.numberTo0x(defaultTransaction.v));
      expect(result.value).to.eq(defaultTransaction.value);
    });

    it('returns correct transaction for existing hash w no sigs', async function () {
      // mirror node request mocks
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        r: null,
        s: null
      };

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      if (result == null) return;

      expect(result).to.exist;
      expect(result.accessList).to.eq(defaultTransaction.accessList);
      expect(result.blockHash).to.eq(defaultTransaction.blockHash);
      expect(result.blockNumber).to.eq(defaultTransaction.blockNumber);
      expect(result.chainId).to.eq(defaultTransaction.chainId);
      expect(result.from).to.eq(defaultTransaction.from);
      expect(result.gas).to.eq(defaultTransaction.gas);
      expect(result.gasPrice).to.eq(defaultTransaction.gasPrice);
      expect(result.hash).to.eq(defaultTransaction.hash);
      expect(result.input).to.eq(defaultTransaction.input);
      expect(result.maxFeePerGas).to.eq(defaultTransaction.maxFeePerGas);
      expect(result.maxPriorityFeePerGas).to.eq(defaultTransaction.maxPriorityFeePerGas);
      expect(result.nonce).to.eq(EthImpl.numberTo0x(defaultTransaction.nonce));
      expect(result.r).to.be.null;
      expect(result.s).to.be.null;
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(EthImpl.numberTo0x(defaultTransaction.type));
      expect(result.v).to.eq(EthImpl.numberTo0x(defaultTransaction.v));
      expect(result.value).to.eq(defaultTransaction.value);
    });

    it('handles transactions with null gas_used', async function () {
      // mirror node request mocks
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        gas_used: null
      };

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      if (result == null) return;

      expect(result).to.exist;
      expect(result.gas).to.eq('0x0');
    });

    it('handles transactions with null amount', async function () {
      // mirror node request mocks
      const detailedResultsWithNullNullableValues = {
        ...defaultDetailedContractResultByHash,
        amount: null
      };

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, detailedResultsWithNullNullableValues);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });
      const result = await ethImpl.getTransactionByHash(defaultTxHash);
      if (result == null) return;

      expect(result).to.exist;
      expect(result.value).to.eq('0x0');
    });

    it('returns reverted transactions', async function () {
      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHashReverted);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });

      const result = await ethImpl.getTransactionByHash(defaultTxHash);

      expect(result).to.exist;
      if (result == null) return;

      expect(result.accessList).to.eq(defaultTransaction.accessList);
      expect(result.blockHash).to.eq(defaultTransaction.blockHash);
      expect(result.blockNumber).to.eq(defaultTransaction.blockNumber);
      expect(result.chainId).to.eq(defaultTransaction.chainId);
      expect(result.from).to.eq(defaultTransaction.from);
      expect(result.gas).to.eq(defaultTransaction.gas);
      expect(result.gasPrice).to.eq(defaultTransaction.gasPrice);
      expect(result.hash).to.eq(defaultTransaction.hash);
      expect(result.input).to.eq(defaultTransaction.input);
      expect(result.maxFeePerGas).to.eq(defaultTransaction.maxFeePerGas);
      expect(result.maxPriorityFeePerGas).to.eq(defaultTransaction.maxPriorityFeePerGas);
      expect(result.nonce).to.eq(EthImpl.numberTo0x(defaultTransaction.nonce));
      expect(result.r).to.eq(defaultTransaction.r);
      expect(result.s).to.eq(defaultTransaction.s);
      expect(result.to).to.eq(defaultTransaction.to);
      expect(result.transactionIndex).to.eq(defaultTransaction.transactionIndex);
      expect(result.type).to.eq(EthImpl.numberTo0x(defaultTransaction.type));
      expect(result.v).to.eq(EthImpl.numberTo0x(defaultTransaction.v));
      expect(result.value).to.eq(defaultTransaction.value);
    });

    it('throws error for reverted transactions when DEV_MODE=true', async function () {
      const initialDevModeValue = process.env.DEV_MODE;
      process.env.DEV_MODE = 'true';

      restMock.onGet(`contracts/results/${defaultTxHash}`).reply(200, defaultDetailedContractResultByHashReverted);
      restMock.onGet(`accounts/${defaultFromLongZeroAddress}`).reply(200, {
        evm_address: `${defaultTransaction.from}`
      });

      try {
        const result = await ethImpl.getTransactionByHash(defaultTxHash);
        expect(true).to.eq(false);
      }
      catch(error) {
        expect(error).to.deep.equal(predefined.CONTRACT_REVERT(defaultDetailedContractResultByHashReverted.error_message));
      }

      process.env.DEV_MODE = initialDevModeValue;
    });
  });
});
