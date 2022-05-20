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
import dotenv from 'dotenv';
import { expect } from 'chai';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { RelayImpl } from '@hashgraph/json-rpc-relay';
import { EthImpl } from '../../src/lib/eth';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';

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
    "blockHash": "0x6ceecd8bb224da491",
    "blockNumber": 17,
    "chainId": "0x",
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

  const defaultDetailedContractResultByHash = {
    "amount":2000000000,
    "bloom":"0x0505",
    "call_result":"0x0606",
    "contract_id":"0.0.5001",
    "created_contract_ids":["0.0.7001"],
    "error_message":null,
    "from":"0x0000000000000000000000000000000000001f41",
    "function_parameters":"0x0707",
    "gas_limit":1000000,
    "gas_used":123,
    "timestamp":"167654.000123456",
    "to":"0x0000000000000000000000000000000000001389",
    "block_hash":"0x6ceecd8bb224da491",
    "block_number":17,
    "logs": [{
        "address":"0x0000000000000000000000000000000000001389",
        "bloom":"0x0123",
        "contract_id":"0.0.5001",
        "data":"0x0123",
        "index":0,
        "topics":["0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750"]
    }],
      "result":"SUCCESS",
      "transaction_index":1,
      "hash":"0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392",
      "state_changes":[{
        "address":"0x0000000000000000000000000000000000001389",
        "contract_id":"0.0.5001",
        "slot":"0x0000000000000000000000000000000000000000000000000000000000000101",
        "value_read":"0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750",
        "value_written":"0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
      }],
      "status":"0x1",
      "access_list":"0x",
      "block_gas_used":50000000,
      "chain_id":"0x",
      "gas_price":"0x4a817c80",
      "max_fee_per_gas":"0x",
      "max_priority_fee_per_gas":"0x",
      "r":"0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042",
      "s":"0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354",
      "type":2,
      "v":1,
      "nonce":1
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

  it('should execute "eth_blockNumber"', async function () {
    const blockNumber = await Relay.eth().blockNumber();
    expect(blockNumber).to.be.greaterThanOrEqual(0);
  });

  describe('eth_getTransactionReceipt', async function () {
    it('returns `null` for non-cached hash', async function () {
      const txHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const txId = cache.get(txHash);
      expect(txId).to.not.exist;
      const receipt = await Relay.eth().getTransactionReceipt(txHash);
      expect(receipt).to.be.null;
    });

    it('returns `null` for cached hash for non-existing `txId`', async function () {
      const txHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const txId = '0.0.00000000-0000000000-111111111';
      cache.set(txHash, txId);

      const cachedId = cache.get(txHash);
      expect(cachedId).to.eq(txId);

      const receipt = await Relay.eth().getTransactionReceipt('0x0000000000000000000000000000000000000000000000000000000000000002');
      expect(receipt).to.be.null;
    });

    it('executes correctly', async function () {

      const txHash = '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75';
      const cachedReceipt = {
        contractAddress: '0x00000000000000000000000000000000020a044a',
        from: '0x0000000000000000000000000000000001c3ab8a',
        gasUsed: '0x27100',
        logs: [
          {
            removed: false,
            logIndex: '0x0',
            address: '0x00000000000000000000000000000000020a044a',
            data: '0x',
            topics: [
              '0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0',
              '0x0000000000000000000000000000000000000000000000000000000000000000',
              '0x0000000000000000000000000000000000000000000000000000000001c3ab8a'
            ],
            transactionHash: '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75',
            transactionIndex: '0x0',
            blockHash: '0x583ac96f34c9a2fd26e96e8c9731eb7d8f5a93afd38c7cf48ddbc73c288ca734',
            blockNumber: '0x12e7588'
          },
          {
            removed: false,
            logIndex: '0x1',
            address: '0x00000000000000000000000000000000020a044a',
            data: '0x00000000000000000000000000000000000000000000000000000001e30512620000000000000000000000000000000000000000000000000000000003bd27b1',
            topics: [
              '0x1985b1d318899f59e44472a8c4758b3412be7f67e1876b128cda53aa36a8bc6b',
              '0x00000000000000000000000000000000000000000000000000000000020a0448'
            ],
            transactionHash: '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75',
            transactionIndex: '0x0',
            blockHash: '0x583ac96f34c9a2fd26e96e8c9731eb7d8f5a93afd38c7cf48ddbc73c288ca734',
            blockNumber: '0x12e7588'
          },
          {
            removed: false,
            logIndex: '0x2',
            address: '0x00000000000000000000000000000000020a044a',
            data: '0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000643ab17200000000000000000000000000000000000000000000000000000000643ab172',
            topics: [
              '0x132d3e7081289c093560a3fce5704471b66f6565f282688fead57b561d9db9c4'
            ],
            transactionHash: '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75',
            transactionIndex: '0x0',
            blockHash: '0x583ac96f34c9a2fd26e96e8c9731eb7d8f5a93afd38c7cf48ddbc73c288ca734',
            blockNumber: '0x12e7588'
          }
        ],
        logsBloom: '0x00002000000000001000000000000020000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000800004000000000000000000000000000001000000000000000008000000000000000000420000000020000000000800000000000000000000000000000000400000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000002100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000420000000008000000000000000000800000000000010000000000000000000000000',
        status: '0x1',
        to: '0x00000000000000000000000000000000020a044a',
        transactionHash: '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75',
        blockHash: '0x583ac96f34c9a2fd26e96e8c9731eb7d8f5a93afd38c7cf48ddbc73c288ca734',
        blockNumber: '0x12e7588',
        transactionIndex: '0x0',
        cumulativeGasUsed: '0x160000',
        effectiveGasPrice: '0x'
      };
      const txId = '0.0.29600650-1650032136-831895528';

      cache.set(txHash, cachedReceipt);

      const receipt = await Relay.eth().getTransactionReceipt(txHash);

      // Assert the data format
      expect(receipt.blockHash).to.exist;
      expect(validateHash(receipt.blockHash, 64)).to.eq(true);

      expect(receipt.blockNumber).to.exist;

      expect(receipt.contractAddress).to.exist;
      expect(validateHash(receipt.contractAddress, 40)).to.eq(true);

      expect(receipt.cumulativeGasUsed).to.exist;

      expect(receipt.from).to.exist;
      expect(validateHash(receipt.from, 40)).to.eq(true);

      expect(receipt.gasUsed).to.exist;

      expect(receipt.logs).to.exist;
      expect(receipt.logs.length).to.gt(0);

      receipt.logs.forEach(log => {
        expect(log.removed).to.eq(false);

        expect(log.logIndex).to.exist;
        expect(log.logIndex.length).to.gte(3);
        expect(validateHash(log.logIndex)).to.eq(true);

        expect(log.transactionIndex).to.exist;
        expect(log.transactionIndex.length).to.gte(3);
        expect(validateHash(log.transactionIndex)).to.eq(true);

        expect(log.transactionHash).to.exist;
        expect(validateHash(log.transactionHash, 64)).to.eq(true);

        expect(log.blockHash).to.exist;
        expect(validateHash(log.blockHash, 64)).to.eq(true);

        expect(log.blockNumber).to.exist;
        expect(log.blockNumber.length).to.gte(3);
        expect(validateHash(log.blockNumber)).to.eq(true);

        expect(log.address).to.exist;
        expect(validateHash(log.address, 40)).to.eq(true);

        expect(log.data).to.exist;
        expect(validateHash(log.data)).to.eq(true);

        expect(log.topics).to.exist;
        expect(Array.isArray(log.topics)).to.eq(true);

        log.topics.forEach(topic => {
          expect(validateHash(topic, 64)).to.eq(true);
        });
      });

      expect(receipt.logsBloom).to.exist;
      expect(validateHash(receipt.logsBloom, 512)).to.eq(true);

      expect(receipt.status).to.exist;
      expect(receipt.status).to.eq('0x1');

      expect(receipt.to).to.exist;
      expect(validateHash(receipt.to, 40)).to.eq(true);

      expect(receipt.transactionHash).to.exist;
      expect(validateHash(receipt.transactionHash, 64)).to.eq(true);
      expect(receipt.transactionHash).to.eq(txHash);

      expect(receipt.transactionIndex).to.exist;

      // Assert the exact values
      expect(receipt).to.deep.eq(cachedReceipt);
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
      expect(result.blockNumber).to.eq(defaultTransaction.blockNumber);
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
