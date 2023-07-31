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

import path from 'path';
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Registry } from 'prom-client';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { JsonRpcError, predefined } from '../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';

import pino from 'pino';
import constants from '../../src/lib/constants';
import HAPIService from '../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../src/lib/hbarlimiter';
import { ClientCache } from '../../src/lib/clients';
import { Log, Transaction } from '../../src/lib/model';

const LRU = require('lru-cache');

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let clientCache: ClientCache;
let mirrorNodeCache;


const blockHashTrimmed = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;
const blockNumber = 3;
const blockTransactionCount = 77;
const gasUsed1 = 200000;
const gasUsed2 = 800000;
const maxGasLimit = 250000;
const blockTimestamp = '1651560386';
const firstTransactionTimestampSeconds = '1653077541';
const contractAddress1 = '0x000000000000000000000000000000000000055f';
const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
const contractHash2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
const contractHash3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
const contractAddress2 = '0x000000000000000000000000000000000000055e';
const contractTimestamp2 = '1653077542.701408897';
const contractId1 = '0.0.1375';

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

const mostRecentBlock = {
    "blocks": [
    {
        "count": 8,
        "gas_used": 0,
        "hapi_version": "0.35.0",
        "hash": "0xd9f84ed7415f33ae171a34c5daa4030a3a3028536d737bacf28b08c68309c629d6b2d9e01cb4ad7eb5e4fc21749b8c33",
        "logs_bloom": "0x",
        "name": "2023-03-22T19_21_10.216373003Z.rcd.gz",
        "number": 6,
        "previous_hash": "0xe5ec054c17063d3912eb13760f9f62779f12c60f4d13f882d3fe0aba15db617b9f2b62d9f51d2aac05f7499147c6aa28",
        "size": 3085,
        "timestamp": {
        "from": "1679512870.216373003", "to": "1679512871.851262003" 
        }
    }
    ]
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
      'next': null
    }
  };


  const defaultLogTopics = [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000000000000000000000000208fa13",
    "0x0000000000000000000000000000000000000000000000000000000000000005"
  ];
  
  const logBloom1 = '0x1111';
  const logBloom2 = '0x2222';
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
      "transaction_hash": contractHash2,
      "transaction_index": 1
    },
    {
      "address": "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
      "bloom": logBloom2,
      "contract_id": contractId1,
      "data": "0x",
      "index": 2,
      "topics": defaultLogTopics,
      "root_contract_id": "0.0.34806097",
      "timestamp": contractTimestamp1,
      "block_hash": blockHash,
      "block_number": blockNumber,
      "transaction_hash": contractHash3,
      "transaction_index": 1
    }
  ];

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



describe('eth_getBlockBy', async function () {
    this.timeout(10000);  
    let ethImpl: EthImpl;

    this.beforeAll(() => {
      clientCache = new ClientCache(logger.child({ name: `cache` }), registry);

      // @ts-ignore
      mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, clientCache);

      // @ts-ignore
      mirrorNodeCache = mirrorNodeInstance.cache;

      // @ts-ignore
      restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: "throwException" });

      const duration = constants.HBAR_RATE_LIMIT_DURATION;
      const total = constants.HBAR_RATE_LIMIT_TINYBAR;
      const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);

      hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, clientCache);

      process.env.ETH_FEE_HISTORY_FIXED = 'false';

      // @ts-ignore
      ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, clientCache);
    });


    this.beforeEach(() => {
      // reset cache and restMock
      mirrorNodeCache.clear();
      clientCache.clear();
      restMock.reset();
    });
      
    describe('getBlockByNumber', () => {

      const defaultEthGetBlockByLogs = { logs: defaultLogs1 };
      it('eth_getBlockByNumber with eror during batch call', async function () {
          // mirror node request mocks
          restMock.onGet(`blocks/${blockNumber}`).reply(200, defaultBlock);
          restMock.onGet('blocks?limit=1&order=desc').reply(200, mostRecentBlock);
          restMock.onGet(`contracts/results?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultContractResults);
          restMock.onGet(`contracts/${contractAddress1}/results/${contractTimestamp1}`).reply(200, defaultDetailedContractResults);
          restMock.onGet(`contracts/${contractAddress2}/results/${contractTimestamp2}`).timeout();
          restMock.onGet('network/fees').reply(200, defaultNetworkFees);
          restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, defaultEthGetBlockByLogs);

          try{
              await ethImpl.getBlockByNumber(EthImpl.numberTo0x(blockNumber), true);
              expect(false, 'Internal error should have been thrown').to.be.true;
          } catch(e) {
              expect(e).to.be.an.instanceof(JsonRpcError);
              const errorRef = predefined.INTERNAL_ERROR('Error encountered on contract results retrieval from Mirror Node');
              expect(e.code).to.equal(errorRef.code);
              expect(e.message).to.equal(errorRef.message);
              expect(e.name).to.equal(errorRef.name);
          }
      });
    });

    const mirrorLogToModelLog = (mirrorLog) => {
      const log = new Log({
        address: mirrorLog.address,
        blockHash: mirrorLog.block_hash,
        blockNumber: mirrorLog.block_number,
        data: mirrorLog.data,
        logIndex: mirrorLog.index,
        topics: mirrorLog.topics,
        transactionHash: mirrorLog.transaction_hash,
        transactionIndex: mirrorLog.transaction_index,
      });
      return log;
    };

    const modelLog1 = mirrorLogToModelLog(defaultLogs1[0]);
    const modelLog2 = mirrorLogToModelLog(defaultLogs1[1]);
    const modelLog3 = mirrorLogToModelLog(defaultLogs1[2]);
    const referenceLogs = [modelLog1, modelLog2, modelLog3];
    describe('filterAndPopulateSyntheticContractResults w showDetails=false', () => {
      const showDetails = false;

      it('filterAndPopulateSyntheticContractResults with no dupes in empty transactionHashes', async function () {
        const initHashes = [];
        ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, [], initHashes, '1');
        expect(initHashes.length).to.equal(defaultLogs1.length);
        expect(initHashes[0]).to.equal(modelLog1.transactionHash);
        expect(initHashes[1]).to.equal(modelLog2.transactionHash);
        expect(initHashes[2]).to.equal(modelLog3.transactionHash);
      });

      it('filterAndPopulateSyntheticContractResults with no dupes in non empty transactionHashes', async function () {
        const initHashes = ['txHash1', 'txHash2'];
        const txHashes = initHashes.slice();
        ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, [], txHashes, '1');
        expect(txHashes.length).to.equal(initHashes.length + defaultLogs1.length);
        expect(txHashes[initHashes.length + 0]).to.equal(modelLog1.transactionHash);
        expect(txHashes[initHashes.length + 1]).to.equal(modelLog2.transactionHash);
        expect(txHashes[initHashes.length + 2]).to.equal(modelLog3.transactionHash);
      });

      it('filterAndPopulateSyntheticContractResults with 1 transaction dupes in transactionHashes', async function () {
        const initHashes = [modelLog2.transactionHash];
        const txHashes = initHashes.slice();
        ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, [], txHashes, '1');
        expect(txHashes.length).to.equal(referenceLogs.length);
        expect(txHashes[0]).to.equal(contractHash2);
        expect(txHashes[1]).to.equal(modelLog1.transactionHash);
        expect(txHashes[2]).to.equal(modelLog3.transactionHash);
      });

      it('filterAndPopulateSyntheticContractResults with all dupes in transactionHashes', async function () {
        const initHashes = [modelLog1.transactionHash, modelLog2.transactionHash, modelLog3.transactionHash];
        const txHashes = initHashes.slice();
        ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, [], txHashes, '1');
        expect(txHashes.length).to.equal(referenceLogs.length);
        expect(txHashes[0]).to.equal(modelLog1.transactionHash);
        expect(txHashes[1]).to.equal(modelLog2.transactionHash);
        expect(txHashes[2]).to.equal(modelLog3.transactionHash);
      });
  });

  describe('filterAndPopulateSyntheticContractResults w showDetails=true', () => {
    const getTranactionModel = (transactionHash) => {
      return new Transaction({
        accessList: undefined, // we don't support access lists for now, so punt
        blockHash: EthImpl.toHash32(defaultDetailedContractResults.block_hash),
        blockNumber: EthImpl.numberTo0x(defaultDetailedContractResults.block_number),
        chainId: defaultDetailedContractResults.chain_id,
        from: defaultDetailedContractResults.from.substring(0, 42),
        gas: EthImpl.nanOrNumberTo0x(defaultDetailedContractResults.gas_used),
        gasPrice: null,
        hash: transactionHash,
        input: defaultDetailedContractResults.function_parameters,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
        nonce: EthImpl.nanOrNumberTo0x(defaultDetailedContractResults.nonce),
        r: EthImpl.zeroHex,
        s: EthImpl.zeroHex,
        to: defaultDetailedContractResults.to.substring(0, 42),
        transactionIndex: EthImpl.nullableNumberTo0x(defaultDetailedContractResults.transaction_index),
        type: EthImpl.nullableNumberTo0x(defaultDetailedContractResults.type),
        v: EthImpl.nanOrNumberTo0x(defaultDetailedContractResults.v),
        value: EthImpl.nanOrNumberTo0x(defaultDetailedContractResults.amount),
      });
    };

    const showDetails = true;
    it('filterAndPopulateSyntheticContractResults with no dupes in empty txObjects', async function () {
      const initTxObjects: Transaction[] = [];
      ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, initTxObjects, [], '1');
      expect(initTxObjects.length).to.equal(defaultLogs1.length);
      expect(initTxObjects[0].hash).to.equal(modelLog1.transactionHash);
      expect(initTxObjects[1].hash).to.equal(modelLog2.transactionHash);
      expect(initTxObjects[2].hash).to.equal(modelLog3.transactionHash);
    });

    it('filterAndPopulateSyntheticContractResults with no dupes in non empty txObjects', async function () {
      const initTxObjects = [getTranactionModel('txHash1'), getTranactionModel('txHash2')];
      const txObjects = initTxObjects.slice();
      ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, txObjects, [], '1');
      expect(txObjects.length).to.equal(initTxObjects.length + defaultLogs1.length);
      expect(txObjects[initTxObjects.length + 0].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[initTxObjects.length + 1].hash).to.equal(modelLog2.transactionHash);
      expect(txObjects[initTxObjects.length + 2].hash).to.equal(modelLog3.transactionHash);
    });

    it('filterAndPopulateSyntheticContractResults with 1 transaction dupes in txObjects', async function () {
      const initTxObjects = [getTranactionModel(modelLog2.transactionHash)];
      const txObjects = initTxObjects.slice();
      ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, txObjects, [], '1');
      expect(txObjects.length).to.equal(referenceLogs.length);
      expect(txObjects[0].hash).to.equal(contractHash2);
      expect(txObjects[1].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[2].hash).to.equal(modelLog3.transactionHash);
    });

    it('filterAndPopulateSyntheticContractResults with all dupes in txObjects', async function () {
      const initTxObjects = [getTranactionModel(modelLog1.transactionHash), getTranactionModel(modelLog2.transactionHash), getTranactionModel(modelLog3.transactionHash)];
      const txObjects = initTxObjects.slice();
      ethImpl.filterAndPopulateSyntheticContractResults(showDetails, referenceLogs, txObjects, [], '1');
      expect(txObjects.length).to.equal(referenceLogs.length);
      expect(txObjects[0].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[1].hash).to.equal(modelLog2.transactionHash);
      expect(txObjects[2].hash).to.equal(modelLog3.transactionHash);
    });
  });


  describe('filterAndPopulateSyntheticContractResults sets cache', () => {
    const cacheKeySyntheticLog1 = `${constants.CACHE_KEY.SYNTHETIC_LOG_TRANSACTION_HASH}${modelLog1.transactionHash}`;
    const cacheKeySyntheticLog2 = `${constants.CACHE_KEY.SYNTHETIC_LOG_TRANSACTION_HASH}${modelLog2.transactionHash}`;
    const cacheKeySyntheticLog3 = `${constants.CACHE_KEY.SYNTHETIC_LOG_TRANSACTION_HASH}${modelLog3.transactionHash}`;

    it('filterAndPopulateSyntheticContractResults showDetails=false sets cache', async function () {
      expect(clientCache.get(cacheKeySyntheticLog1, '', '')).to.be.null;
      expect(clientCache.get(cacheKeySyntheticLog2, '', '')).to.be.null;
      expect(clientCache.get(cacheKeySyntheticLog3, '', '')).to.be.null;

      ethImpl.filterAndPopulateSyntheticContractResults(false, referenceLogs, [], [], '1');

      expect(clientCache.get(cacheKeySyntheticLog1, '', '')).to.be.equal(modelLog1);
      expect(clientCache.get(cacheKeySyntheticLog2, '', '')).to.be.equal(modelLog2);
      expect(clientCache.get(cacheKeySyntheticLog3, '', '')).to.be.equal(modelLog3);
    });

    it('filterAndPopulateSyntheticContractResults showDetails=true sets cache', async function () {
      expect(clientCache.get(cacheKeySyntheticLog1, '', '')).to.be.null;
      expect(clientCache.get(cacheKeySyntheticLog2, '', '')).to.be.null;
      expect(clientCache.get(cacheKeySyntheticLog3, '', '')).to.be.null;

      ethImpl.filterAndPopulateSyntheticContractResults(true, referenceLogs, [], [], '1');

      expect(clientCache.get(cacheKeySyntheticLog1, '', '')).to.be.equal(modelLog1);
      expect(clientCache.get(cacheKeySyntheticLog2, '', '')).to.be.equal(modelLog2);
      expect(clientCache.get(cacheKeySyntheticLog3, '', '')).to.be.equal(modelLog3);
    });
  });
});

