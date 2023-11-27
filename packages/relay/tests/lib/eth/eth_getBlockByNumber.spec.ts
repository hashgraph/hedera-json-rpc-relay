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
import chai from 'chai';
import path from 'path';
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import sinon from 'sinon';
import * as _ from 'lodash';
import pino from 'pino';
import chaiAsPromised from 'chai-as-promised';

import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../src/lib/eth';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import { defaultContractResults } from '../../helpers';
import { Transaction } from '../../../src/lib/model';
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import RelayAssertions from '../../assertions';
import { hashNumber, numberTo0x } from '../../../dist/formatters';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BLOCKS_LIMIT_ORDER_URL,
  BLOCKS_RES,
  BLOCK_HASH,
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NOT_FOUND_RES,
  BLOCK_NUMBER,
  BLOCK_NUMBER_HEX,
  BLOCK_TIMESTAMP_HEX,
  CONTRACTS_RESULTS_NEXT_URL,
  CONTRACT_HASH_1,
  CONTRACT_HASH_2,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  CONTRACT_RESULTS_WITH_FILTER_URL,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_CONTRACT_RES_REVERT,
  DEFAULT_ETH_GET_BLOCK_BY_LOGS,
  DEFAULT_NETWORK_FEES,
  ETH_FEE_HISTORY_VALUE,
  GAS_USED_1,
  GAS_USED_2,
  LINKS_NEXT_RES,
  MOST_RECENT_BLOCK,
  NOT_FOUND_RES,
  NO_SUCK_BLOCK_EXISTS_RES,
} from './config';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
chai.use(chaiAsPromised);

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let sdkClientStub;
let getSdkClientStub;
let cacheService: CacheService;

describe('@ethBlockByNumber Eth calls using MirrorNode', async function () {
  this.timeout(10000);
  let ethImpl: EthImpl;
  const results = defaultContractResults.results;
  const TOTAL_GAS_USED = numberTo0x(results[0].gas_used + results[1].gas_used);

  const veriftAggregatedInfo = (result) => {
    // verify aggregated info
    expect(result.hash).equal(BLOCK_HASH_TRIMMED);
    expect(result.number).equal(BLOCK_NUMBER_HEX);
    expect(result.parentHash).equal(BLOCK_HASH_PREV_TRIMMED);
    expect(result.timestamp).equal(BLOCK_TIMESTAMP_HEX);
  };

  this.beforeAll(() => {
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);
    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );

    // @ts-ignore
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });

    // @ts-ignore
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);

    hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter, cacheService);

    process.env.ETH_FEE_HISTORY_FIXED = 'false';

    // @ts-ignore
    ethImpl = new EthImpl(hapiServiceInstance, mirrorNodeInstance, logger, '0x12a', registry, cacheService);
  });

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
  });

  this.afterAll(() => {
    process.env.ETH_FEE_HISTORY_FIXED = ETH_FEE_HISTORY_VALUE;
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
  });

  it('"eth_blockNumber" should return the latest block number', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should return the latest block number using cache', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    const blockNumber = await ethImpl.blockNumber();
    expect(numberTo0x(DEFAULT_BLOCK.number)).to.be.eq(blockNumber);

    // Second call should return the same block number using cache
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(400, DEFAULT_BLOCKS_RES);

    const blockNumber2 = await ethImpl.blockNumber();
    expect(blockNumber2).to.be.eq(blockNumber);

    // expire cache, instead of waiting for ttl we clear it to simulate expiry faster.
    cacheService.clear();
    // Third call should return new number using mirror node
    const newBlockNumber = 7;
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, {
      blocks: [{ ...DEFAULT_BLOCK, number: newBlockNumber }],
    });
    const blockNumber3 = await ethImpl.blockNumber();
    expect(numberTo0x(newBlockNumber)).to.be.eq(blockNumber3);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(404, BLOCK_NOT_FOUND_RES);
    const error = predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
    await RelayAssertions.assertRejection(error, ethImpl.blockNumber, true, ethImpl);
  });

  it('"eth_blockNumber" return the latest block number on second try', async function () {
    restMock
      .onGet(BLOCKS_LIMIT_ORDER_URL)
      .replyOnce(404, BLOCK_NOT_FOUND_RES)
      .onGet(BLOCKS_LIMIT_ORDER_URL)
      .replyOnce(200, DEFAULT_BLOCKS_RES);

    const blockNumber = await ethImpl.blockNumber();
    expect(blockNumber).to.be.eq(blockNumber);
  });

  it('"eth_blockNumber" should throw an error if no blocks are found after third try', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(404, BLOCK_NOT_FOUND_RES);

    await RelayAssertions.assertRejection(
      predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK,
      ethImpl.blockNumber,
      true,
      ethImpl,
    );
  });

  describe('with match', async function () {
    beforeEach(function () {
      // mirror node request mocks
      restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
      restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    });

    it('eth_getBlockByNumber with match', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);

      RelayAssertions.assertBlock(result, {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      });
    });

    it('eth_getBlockByNumber with match paginated', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
      restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
      const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);

      RelayAssertions.assertBlock(result, {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      });
    });

    it('eth_getBlockByNumber should return cached result', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
      const resBeforeCache = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);

      restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(404);
      const resAfterCache = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);

      expect(resBeforeCache).to.eq(resAfterCache);
    });

    it('eth_getBlockByHash with match', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByHash(BLOCK_HASH, false);
      RelayAssertions.assertBlock(result, {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      });
    });

    it('eth_getBlockByHash with match paginated', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
      restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByHash(BLOCK_HASH, false);
      RelayAssertions.assertBlock(result, {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      });
    });
  });

  it('eth_getBlockByNumber with zero transactions', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, { ...DEFAULT_BLOCK, gas_used: 0 });
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, { results: [] });
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, { logs: [] });
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      // verify aggregated info
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal('0x0');
      expect(result.transactions.length).equal(0);
      expect(result.transactionsRoot).equal(EthImpl.ethEmptyTrie);

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with match and details', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      // verify aggregated info
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(TOTAL_GAS_USED);
      expect(result.transactions.length).equal(2);
      expect((result.transactions[0] as Transaction).hash).equal(CONTRACT_HASH_1);
      expect((result.transactions[1] as Transaction).hash).equal(CONTRACT_HASH_2);
      expect((result.transactions[1] as Transaction).gas).equal(hashNumber(GAS_USED_2));

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with match and details paginated', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
    restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      // verify aggregated info
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(TOTAL_GAS_USED);
      expect(result.transactions.length).equal(2);
      expect((result.transactions[0] as Transaction).hash).equal(CONTRACT_HASH_1);
      expect((result.transactions[1] as Transaction).hash).equal(CONTRACT_HASH_2);
      expect((result.transactions[1] as Transaction).gas).equal(hashNumber(GAS_USED_2));

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with block match and contract revert', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, { ...DEFAULT_BLOCK, gas_used: GAS_USED_1 });
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, DEFAULT_CONTRACT_RES_REVERT);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, { logs: [] });

    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(numberTo0x(GAS_USED_1));
      expect(result.transactions.length).equal(1);

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with no match', async function () {
    cacheService.clear();
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(404, NO_SUCK_BLOCK_EXISTS_RES);
    restMock.onGet(`blocks?limit=1&order=desc`).reply(200, MOST_RECENT_BLOCK);

    const result = await ethImpl.getBlockByNumber(BLOCK_NUMBER.toString(), false);
    expect(result).to.equal(null);
  });

  it('eth_getBlockByNumber with latest tag', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
    }

    const result = await ethImpl.getBlockByNumber('latest', false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    // check that we only made the expected number of requests with the expected urls
    expect(restMock.history.get.length).equal(4);
    expect(restMock.history.get[0].url).equal(BLOCKS_LIMIT_ORDER_URL);
    expect(restMock.history.get[1].url).equal(
      'contracts/results?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
    );
    expect(restMock.history.get[2].url).equal(
      'contracts/results/logs?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
    );
    expect(restMock.history.get[3].url).equal('network/fees');

    if (result) {
      expect(result.number).equal(BLOCK_NUMBER_HEX);
    }
  });

  it('eth_getBlockByNumber with latest tag paginated', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
    restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
    }

    const result = await ethImpl.getBlockByNumber('latest', false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      expect(result.number).equal(BLOCK_NUMBER_HEX);
    }
  });

  it('eth_getBlockByNumber with pending tag', async function () {
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
    }

    const result = await ethImpl.getBlockByNumber('pending', false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      expect(result.number).equal(BLOCK_NUMBER_HEX);
    }
  });

  it('eth_getBlockByNumber with earliest tag', async function () {
    restMock.onGet(`blocks/0`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
    }

    const result = await ethImpl.getBlockByNumber('earliest', false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      expect(result.number).equal(BLOCK_NUMBER_HEX);
    }
  });

  it('eth_getBlockByNumber with hex number', async function () {
    restMock.onGet(`blocks/3735929054`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(`blocks?limit=1&order=desc`).reply(200, BLOCKS_RES);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    for (const result of defaultContractResults.results) {
      restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
    }

    const result = await ethImpl.getBlockByNumber('0xdeadc0de', false);
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      expect(result.number).equal(BLOCK_NUMBER_HEX);
    }
  });
});
