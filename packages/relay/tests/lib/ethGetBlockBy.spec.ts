/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Registry } from 'prom-client';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { EthImpl } from '../../src/lib/eth';
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';

import pino from 'pino';
import constants from '../../src/lib/constants';
import HAPIService from '../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../src/lib/hbarlimiter';
import { Log, Transaction } from '../../src/lib/model';
import { nullableNumberTo0x, numberTo0x, nanOrNumberTo0x, toHash32 } from '../../../../packages/relay/src/formatters';
import { CacheService } from '../../src/lib/services/cacheService/cacheService';
import * as sinon from 'sinon';
import { RedisInMemoryServer } from '../redisInMemoryServer';
import { defaultDetailedContractResults } from '../helpers';

use(chaiAsPromised);

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let cacheService: CacheService;
let redisInMemoryServer: RedisInMemoryServer;
let mirrorNodeCache;

const blockHashTrimmed = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
const blockHash = `${blockHashTrimmed}999fc7e86699f60f2a3fb3ed9a646c6b`;
const blockNumber = 3;
const firstTransactionTimestampSeconds = '1653077541';
const contractTimestamp1 = `${firstTransactionTimestampSeconds}.983983199`;
const contractHash1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
const contractHash2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
const contractHash3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
const contractId1 = '0.0.1375';

const defaultLogTopics = [
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000000000000000000000000208fa13',
  '0x0000000000000000000000000000000000000000000000000000000000000005',
];

const logBloom1 = '0x1111';
const logBloom2 = '0x2222';
const defaultLogs1 = [
  {
    address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69',
    bloom: logBloom1,
    contract_id: contractId1,
    data: '0x',
    index: 0,
    topics: defaultLogTopics,
    root_contract_id: '0.0.34806097',
    timestamp: contractTimestamp1,
    block_hash: blockHash,
    block_number: blockNumber,
    transaction_hash: contractHash1,
    transaction_index: 1,
  },
  {
    address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69',
    bloom: logBloom2,
    contract_id: contractId1,
    data: '0x',
    index: 1,
    topics: defaultLogTopics,
    root_contract_id: '0.0.34806097',
    timestamp: contractTimestamp1,
    block_hash: blockHash,
    block_number: blockNumber,
    transaction_hash: contractHash2,
    transaction_index: 1,
  },
  {
    address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69',
    bloom: logBloom2,
    contract_id: contractId1,
    data: '0x',
    index: 2,
    topics: defaultLogTopics,
    root_contract_id: '0.0.34806097',
    timestamp: contractTimestamp1,
    block_hash: blockHash,
    block_number: blockNumber,
    transaction_hash: contractHash3,
    transaction_index: 1,
  },
];

describe('eth_getBlockBy', async function () {
  this.timeout(10000);
  let ethImpl: EthImpl;
  const sandbox = sinon.createSandbox();

  this.beforeAll(async () => {
    //done in order to be able to use cache
    process.env.TEST = 'false';
    process.env.REDIS_ENABLED = 'true';
    redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 5031);
    await redisInMemoryServer.start();
    process.env.REDIS_URL = 'redis://127.0.0.1:5031';
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);

    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL,
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );

    // @ts-ignore
    mirrorNodeCache = mirrorNodeInstance.cache;

    // @ts-ignore
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);

    hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, cacheService);

    process.env.ETH_FEE_HISTORY_FIXED = 'false';

    // @ts-ignore
    ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, cacheService);
  });

  this.beforeEach(() => {
    cacheService.clear();
    restMock.reset();
  });

  afterEach(function () {
    sandbox.restore();
  });

  this.afterAll(async () => {
    process.env.REDIS_ENABLED = 'false';
    await cacheService.disconnectRedisClient();
    await redisInMemoryServer.stop();
  });

  const mirrorLogToModelLog = (mirrorLog) => {
    return new Log({
      address: mirrorLog.address,
      blockHash: mirrorLog.block_hash,
      blockNumber: mirrorLog.block_number,
      data: mirrorLog.data,
      logIndex: mirrorLog.index,
      topics: mirrorLog.topics,
      transactionHash: mirrorLog.transaction_hash,
      transactionIndex: mirrorLog.transaction_index,
    });
  };

  const modelLog1 = mirrorLogToModelLog(defaultLogs1[0]);
  const modelLog2 = mirrorLogToModelLog(defaultLogs1[1]);
  const modelLog3 = mirrorLogToModelLog(defaultLogs1[2]);
  const referenceLogs = [modelLog1, modelLog2, modelLog3];
  describe('populateSyntheticTransactions w showDetails=false', () => {
    const showDetails = false;

    it('populateSyntheticTransactions with no dupes in empty transactionHashes', async function () {
      const initHashes = [];
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, initHashes, '1');
      expect(initHashes.length).to.equal(defaultLogs1.length);
      expect(initHashes[0]).to.equal(modelLog1.transactionHash);
      expect(initHashes[1]).to.equal(modelLog2.transactionHash);
      expect(initHashes[2]).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with no dupes in non empty transactionHashes', async function () {
      const initHashes = ['txHash1', 'txHash2'];
      const txHashes = initHashes.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txHashes, '1');
      expect(txHashes.length).to.equal(initHashes.length + defaultLogs1.length);
      expect(txHashes[initHashes.length + 0]).to.equal(modelLog1.transactionHash);
      expect(txHashes[initHashes.length + 1]).to.equal(modelLog2.transactionHash);
      expect(txHashes[initHashes.length + 2]).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with 1 transaction dupes in transactionHashes', async function () {
      const initHashes = [modelLog2.transactionHash];
      const txHashes = initHashes.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txHashes, '1');
      expect(txHashes.length).to.equal(referenceLogs.length);
      expect(txHashes[0]).to.equal(contractHash2);
      expect(txHashes[1]).to.equal(modelLog1.transactionHash);
      expect(txHashes[2]).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with all dupes in transactionHashes', async function () {
      const initHashes = [modelLog1.transactionHash, modelLog2.transactionHash, modelLog3.transactionHash];
      const txHashes = initHashes.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txHashes, '1');
      expect(txHashes.length).to.equal(referenceLogs.length);
      expect(txHashes[0]).to.equal(modelLog1.transactionHash);
      expect(txHashes[1]).to.equal(modelLog2.transactionHash);
      expect(txHashes[2]).to.equal(modelLog3.transactionHash);
    });
  });

  describe('populateSyntheticTransactions w showDetails=true', () => {
    const getTransactionModel = (transactionHash) => {
      return new Transaction({
        accessList: undefined, // we don't support access lists for now, so punt
        blockHash: toHash32(defaultDetailedContractResults.block_hash),
        blockNumber: numberTo0x(defaultDetailedContractResults.block_number),
        chainId: defaultDetailedContractResults.chain_id,
        from: defaultDetailedContractResults.from.substring(0, 42),
        gas: nanOrNumberTo0x(defaultDetailedContractResults.gas_used),
        gasPrice: null,
        hash: transactionHash,
        input: defaultDetailedContractResults.function_parameters,
        maxPriorityFeePerGas: null,
        maxFeePerGas: null,
        nonce: nanOrNumberTo0x(defaultDetailedContractResults.nonce),
        r: EthImpl.zeroHex,
        s: EthImpl.zeroHex,
        to: defaultDetailedContractResults.to.substring(0, 42),
        transactionIndex: nullableNumberTo0x(defaultDetailedContractResults.transaction_index),
        type: nullableNumberTo0x(defaultDetailedContractResults.type),
        v: nanOrNumberTo0x(defaultDetailedContractResults.v),
        value: nanOrNumberTo0x(defaultDetailedContractResults.amount),
      });
    };

    const showDetails = true;
    it('populateSyntheticTransactions with no dupes in empty txObjects', async function () {
      const initTxObjects: Transaction[] = [];
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, initTxObjects, '1');
      expect(initTxObjects.length).to.equal(defaultLogs1.length);
      expect(initTxObjects[0].hash).to.equal(modelLog1.transactionHash);
      expect(initTxObjects[1].hash).to.equal(modelLog2.transactionHash);
      expect(initTxObjects[2].hash).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with no dupes in non empty txObjects', async function () {
      const initTxObjects = [getTransactionModel('txHash1'), getTransactionModel('txHash2')];
      const txObjects = initTxObjects.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txObjects, '1');
      expect(txObjects.length).to.equal(initTxObjects.length + defaultLogs1.length);
      expect(txObjects[initTxObjects.length + 0].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[initTxObjects.length + 1].hash).to.equal(modelLog2.transactionHash);
      expect(txObjects[initTxObjects.length + 2].hash).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with 1 transaction dupes in txObjects', async function () {
      const initTxObjects = [getTransactionModel(modelLog2.transactionHash)];
      const txObjects = initTxObjects.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txObjects, '1');
      expect(txObjects.length).to.equal(referenceLogs.length);
      expect(txObjects[0].hash).to.equal(contractHash2);
      expect(txObjects[1].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[2].hash).to.equal(modelLog3.transactionHash);
    });

    it('populateSyntheticTransactions with all dupes in txObjects', async function () {
      const initTxObjects = [
        getTransactionModel(modelLog1.transactionHash),
        getTransactionModel(modelLog2.transactionHash),
        getTransactionModel(modelLog3.transactionHash),
      ];
      const txObjects = initTxObjects.slice();
      ethImpl.populateSyntheticTransactions(showDetails, referenceLogs, txObjects, '1');
      expect(txObjects.length).to.equal(referenceLogs.length);
      expect(txObjects[0].hash).to.equal(modelLog1.transactionHash);
      expect(txObjects[1].hash).to.equal(modelLog2.transactionHash);
      expect(txObjects[2].hash).to.equal(modelLog3.transactionHash);
    });
  });
});
