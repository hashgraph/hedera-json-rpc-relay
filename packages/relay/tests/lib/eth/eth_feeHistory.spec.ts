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

import { EthImpl } from '../../../src/lib/eth';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import {
  defaultDetailedContractResults,
  defaultDetailedContractResults2,
  defaultDetailedContractResults3,
  defaultEvmAddress,
  ethGetLogsFailing,
  expectLogData,
  expectLogData1,
  expectLogData2,
  expectLogData3,
  expectLogData4,
} from '../../helpers';
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BASE_FEE_PER_GAS_HEX,
  BLOCKS_LIMIT_ORDER_URL,
  BLOCK_HASH,
  BLOCK_NUMBER_2,
  BLOCK_NUMBER_3,
  CONTRACTS_LOGS_WITH_FILTER,
  CONTRACT_ADDRESS_1,
  CONTRACT_ADDRESS_2,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_CONTRACT,
  DEFAULT_CONTRACT_2,
  DEFAULT_LOGS,
  DEFAULT_LOGS_3,
  DEFAULT_LOGS_4,
  DEFAULT_LOG_TOPICS,
  DEFAULT_LOG_TOPICS_1,
  DEFAULT_NETWORK_FEES,
  DEFAULT_NULL_LOG_TOPICS,
  ETH_FEE_HISTORY_VALUE,
  GAS_USED_RATIO,
  NOT_FOUND_RES,
} from './eth-config';
import { numberTo0x } from '../../../src/formatters';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
chai.use(chaiAsPromised);

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let hapiServiceInstance: HAPIService;
let sdkClientStub;
let getSdkClientStub;
let cacheService: CacheService;
let currentMaxBlockRange: number;
let ethImpl: EthImpl;

describe('@ethFeeHistory using MirrorNode', async function () {
  this.timeout(10000);

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
    currentMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE);
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = '1';
  });

  this.afterAll(() => {
    process.env.ETH_FEE_HISTORY_FIXED = ETH_FEE_HISTORY_VALUE;
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
  });

  describe('eth_getLogs', async function () {
    const latestBlock = {
      ...DEFAULT_BLOCK,
      number: 17,
      timestamp: {
        from: `1651560393.060890949`,
        to: '1651560395.060890949',
      },
    };

    it('BLOCK_HASH filter timeouts and throws the expected error', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
      };

      restMock.onGet(`blocks/${BLOCK_HASH}`).timeout();
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);

      await ethGetLogsFailing(ethImpl, [BLOCK_HASH, null, null, null, null], (error) => {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq('timeout of 10000ms exceeded');
      });
    });

    it('address filter timeouts and throws the expected error', async function () {
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACTS_LOGS_WITH_FILTER).timeout();

      await ethGetLogsFailing(ethImpl, [null, null, null, CONTRACT_ADDRESS_1, null], (error) => {
        expect(error.statusCode).to.equal(504);
        expect(error.message).to.eq('timeout of 10000ms exceeded');
      });
    });

    it('error when retrieving logs', async function () {
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock
        .onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL)
        .reply(400, { _status: { messages: [{ message: 'Mocked error' }] } });

      let errorReceived = false;
      try {
        await ethImpl.getLogs(null, null, null, null, null);
      } catch (error) {
        errorReceived = true;
        expect(error.statusCode).to.equal(400);
        expect(error.message).to.eq('Mocked error');
      }

      expect(errorReceived, 'Error should be thrown').to.be.true;
    });

    it('no filters', async function () {
      const filteredLogs = {
        logs: [
          DEFAULT_LOGS.logs[0],
          { ...DEFAULT_LOGS.logs[1], address: '0x0000000000000000000000000000000002131952' },
          { ...DEFAULT_LOGS.logs[2], address: '0x0000000000000000000000000000000002131953' },
          { ...DEFAULT_LOGS.logs[3], address: '0x0000000000000000000000000000000002131954' },
        ],
      };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);
      filteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...DEFAULT_CONTRACT, contract_id: `0.0.105${index}` });
      });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData(result[0], filteredLogs.logs[0], defaultDetailedContractResults);
      expectLogData(result[1], filteredLogs.logs[1], defaultDetailedContractResults);
      expectLogData(result[2], filteredLogs.logs[2], defaultDetailedContractResults2);
      expectLogData(result[3], filteredLogs.logs[3], defaultDetailedContractResults3);
    });

    it('no filters but undefined transaction_index', async function () {
      const filteredLogs = {
        logs: [
          { ...DEFAULT_LOGS.logs[0], transaction_index: undefined },
          { ...DEFAULT_LOGS.logs[1], transaction_index: undefined },
          { ...DEFAULT_LOGS.logs[2], transaction_index: undefined },
          { ...DEFAULT_LOGS.logs[3], transaction_index: undefined },
        ],
      };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);
      filteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...DEFAULT_CONTRACT, contract_id: `0.0.105${index}` });
      });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(4);
      result.forEach((log, index) => {
        expect(log.transactionIndex).to.be.null;
      });
    });

    it('should be able to return more than two logs with limit of two per request', async function () {
      const unfilteredLogs = {
        logs: [
          { ...DEFAULT_LOGS.logs[0], address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69' },
          { ...DEFAULT_LOGS.logs[1], address: '0x0000000000000000000000000000000002131952' },
          { ...DEFAULT_LOGS.logs[2], address: '0x0000000000000000000000000000000002131953' },
          { ...DEFAULT_LOGS.logs[3], address: '0x0000000000000000000000000000000002131954' },
        ],
      };
      const filteredLogs = {
        logs: [
          { ...DEFAULT_LOGS.logs[0], address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69' },
          { ...DEFAULT_LOGS.logs[1], address: '0x0000000000000000000000000000000002131952' },
        ],
        links: { next: 'contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0' },
      };
      const filteredLogsNext = {
        logs: [
          { ...DEFAULT_LOGS.logs[2], address: '0x0000000000000000000000000000000002131953' },
          { ...DEFAULT_LOGS.logs[3], address: '0x0000000000000000000000000000000002131954' },
        ],
        links: { next: null },
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);

      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=2&order=asc`,
        )
        .replyOnce(200, filteredLogs)
        .onGet('contracts/results/logs?limit=2&order=desc&timestamp=lte:1668432962.375200975&index=lt:0')
        .replyOnce(200, filteredLogsNext);

      unfilteredLogs.logs.forEach((log, index) => {
        restMock.onGet(`contracts/${log.address}`).reply(200, { ...DEFAULT_CONTRACT, contract_id: `0.0.105${index}` });
      });
      //setting mirror node limit to 2 for this test only
      process.env['MIRROR_NODE_LIMIT_PARAM'] = '2';
      const result = await ethImpl.getLogs(null, null, null, null, null);
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
        logs: [
          {
            ...DEFAULT_LOGS.logs[0],
            address: defaultEvmAddress,
          },
        ],
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);
      restMock
        .onGet(`contracts/${filteredLogs.logs[0].address}`)
        .reply(200, { ...DEFAULT_CONTRACT, evm_address: defaultEvmAddress });

      const result = await ethImpl.getLogs(null, null, null, null, null);
      expect(result).to.exist;

      expect(result.length).to.eq(1);
      expect(result[0].address).to.eq(defaultEvmAddress);
    });

    it('address filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1], DEFAULT_LOGS.logs[2]],
      };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACTS_LOGS_WITH_FILTER).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(null, null, null, CONTRACT_ADDRESS_1, null);

      expect(result).to.exist;

      expect(result.length).to.eq(3);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
    });

    it('multiple addresses filter', async function () {
      const filteredLogsAddress1 = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1], DEFAULT_LOGS.logs[2]],
      };
      const filteredLogsAddress2 = {
        logs: DEFAULT_LOGS_3,
      };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACTS_LOGS_WITH_FILTER).reply(200, filteredLogsAddress1);
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_2}/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogsAddress2);
      for (const log of filteredLogsAddress1.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }
      restMock.onGet(`contracts/${CONTRACT_ADDRESS_2}`).reply(200, DEFAULT_CONTRACT_2);

      const result = await ethImpl.getLogs(null, null, null, [CONTRACT_ADDRESS_1, CONTRACT_ADDRESS_2], null);

      expect(result).to.exist;

      expect(result.length).to.eq(4);
      expectLogData1(result[0]);
      expectLogData2(result[1]);
      expectLogData3(result[2]);
      expectLogData4(result[3]);
    });

    it('BLOCK_HASH filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
      };

      restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(BLOCK_HASH, null, null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with valid fromBlock && toBlock filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
      };
      const toBlock = {
        ...DEFAULT_BLOCK,
        number: 16,
        timestamp: {
          from: `1651560391.060890949`,
          to: '1651560393.060890949',
        },
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCK);
      restMock.onGet('blocks/16').reply(200, toBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${toBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with non-existing fromBlock filter', async function () {
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });

      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCK);
      restMock.onGet('blocks/16').reply(404, NOT_FOUND_RES);

      const result = await ethImpl.getLogs(null, '0x10', '0x5', null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it('with non-existing toBlock filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0]],
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCK);
      restMock.onGet('blocks/16').reply(404, NOT_FOUND_RES);
      restMock
        .onGet(`contracts/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&limit=100&order=asc`)
        .reply(200, filteredLogs);
      restMock.onGet(`contracts/${filteredLogs.logs[0].address}`).reply(200, DEFAULT_CONTRACT);

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it('when fromBlock > toBlock', async function () {
      const fromBlock = {
        ...DEFAULT_BLOCK,
        number: 16,
        timestamp: {
          from: `1651560391.060890949`,
          to: '1651560393.060890949',
        },
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet('blocks/16').reply(200, fromBlock);
      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCK);
      const result = await ethImpl.getLogs(null, '0x10', '0x5', null, null);

      expect(result).to.exist;
      expect(result).to.be.empty;
    });

    it('with only toBlock', async function () {
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCKS_RES);

      await ethGetLogsFailing(ethImpl, [null, null, '0x5', null, null], (error) => {
        expect(error.code).to.equal(-32011);
        expect(error.name).to.equal('Missing fromBlock parameter');
        expect(error.message).to.equal('Provided toBlock parameter without specifying fromBlock');
      });
    });

    it('with block tag', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0]],
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(null, 'latest', null, null, null);

      expect(result).to.exist;
      expectLogData1(result[0]);
    });

    it('when block range is too large', async function () {
      const fromBlock = {
        ...DEFAULT_BLOCK,
        number: 1,
      };
      const toBlock = {
        ...DEFAULT_BLOCK,
        number: 1003,
      };

      const blockBeyondMaximumRange = {
        ...DEFAULT_BLOCK,
        number: 1007,
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [blockBeyondMaximumRange] });
      restMock.onGet('blocks/1').reply(200, fromBlock);
      restMock.onGet('blocks/1003').reply(200, toBlock);

      await ethGetLogsFailing(ethImpl, [null, '0x1', '0x3eb', null, null], (error) => {
        expect(error.message).to.equal('Exceeded maximum block range: 1000');
      });
    });

    it('with topics filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}` +
            `&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}` +
            `&topic0=${DEFAULT_LOG_TOPICS[0]}&topic1=${DEFAULT_LOG_TOPICS[1]}` +
            `&topic2=${DEFAULT_LOG_TOPICS[2]}&topic3=${DEFAULT_LOG_TOPICS[3]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(null, null, null, null, DEFAULT_LOG_TOPICS);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });

    it('with null topics filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS_4[0]],
      };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}` +
            `&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}` +
            `&topic0=${DEFAULT_LOG_TOPICS_1[0]}` +
            `&topic1=${DEFAULT_LOG_TOPICS_1[1]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }
      const result = await ethImpl.getLogs(null, null, null, null, DEFAULT_NULL_LOG_TOPICS);

      expect(result).to.exist;
      expect(result[0].topics.length).to.eq(DEFAULT_LOGS_4[0].topics.length);
      for (let index = 0; index < result[0].topics.length; index++) {
        expect(result[0].topics[index]).to.eq(DEFAULT_LOGS_4[0].topics[index]);
      }
    });

    it('with topics and blocks filter', async function () {
      const filteredLogs = {
        logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
      };

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet('blocks/5').reply(200, DEFAULT_BLOCK);
      restMock.onGet('blocks/16').reply(200, DEFAULT_BLOCK);
      restMock
        .onGet(
          `contracts/results/logs` +
            `?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}` +
            `&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}` +
            `&topic0=${DEFAULT_LOG_TOPICS[0]}&topic1=${DEFAULT_LOG_TOPICS[1]}` +
            `&topic2=${DEFAULT_LOG_TOPICS[2]}&topic3=${DEFAULT_LOG_TOPICS[3]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      for (const log of filteredLogs.logs) {
        restMock.onGet(`contracts/${log.address}`).reply(200, DEFAULT_CONTRACT);
      }

      const result = await ethImpl.getLogs(null, '0x5', '0x10', null, DEFAULT_LOG_TOPICS);

      expect(result).to.exist;
      expectLogData1(result[0]);
      expectLogData2(result[1]);
    });
  });

  it('eth_feeHistory', async function () {
    const previousBlock = {
      ...DEFAULT_BLOCK,
      number: BLOCK_NUMBER_2,
      timestamp: {
        from: '1651560386.060890948',
        to: '1651560389.060890948',
      },
    };
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const previousFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
    const latestFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));

    previousFees.fees[2].gas += 1;

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
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
    expect(feeHistory['gasUsedRatio'][0]).to.equal(GAS_USED_RATIO);
    expect(feeHistory['oldestBlock']).to.equal(`0x${previousBlock.number.toString(16)}`);
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory with latest param', async function () {
    const previousBlock = {
      ...DEFAULT_BLOCK,
      number: BLOCK_NUMBER_2,
      timestamp: {
        from: '1651560386.060890948',
        to: '1651560389.060890948',
      },
    };
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const previousFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
    const latestFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
  });

  it('eth_feeHistory with pending param', async function () {
    const previousBlock = {
      ...DEFAULT_BLOCK,
      number: BLOCK_NUMBER_2,
      timestamp: {
        from: '1651560386.060890948',
        to: '1651560389.060890948',
      },
    };
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const previousFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
    const latestFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'pending', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
  });

  it('eth_feeHistory with earliest param', async function () {
    const firstBlockIndex = 0;
    const secondBlockIndex = 1;
    const previousBlock = {
      ...DEFAULT_BLOCK,
      number: firstBlockIndex,
      timestamp: {
        from: '1651560386.060890948',
        to: '1651560389.060890948',
      },
    };
    const latestBlock = { ...DEFAULT_BLOCK, number: secondBlockIndex };
    const previousFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
    const latestFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, 'earliest', [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + firstBlockIndex);
  });

  it('eth_feeHistory with number param', async function () {
    const previousBlock = {
      ...DEFAULT_BLOCK,
      number: BLOCK_NUMBER_2,
      timestamp: {
        from: '1651560386.060890948',
        to: '1651560389.060890948',
      },
    };
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const previousFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
    const latestFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const feeHistory = await ethImpl.feeHistory(1, '0x' + BLOCK_NUMBER_3, [25, 75]);
    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
  });

  it('eth_feeHistory with max results', async function () {
    const maxResultsCap = Number(constants.DEFAULT_FEE_HISTORY_MAX_RESULTS);

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [{ ...DEFAULT_BLOCK, number: 10 }] });
    restMock.onGet(`network/fees?timestamp=lte:${DEFAULT_BLOCK.timestamp.to}`).reply(200, DEFAULT_NETWORK_FEES);
    Array.from(Array(11).keys()).map((blockNumber) =>
      restMock.onGet(`blocks/${blockNumber}`).reply(200, { ...DEFAULT_BLOCK, number: blockNumber }),
    );

    const feeHistory = await ethImpl.feeHistory(200, '0x9', [0]);

    expect(feeHistory).to.exist;
    expect(feeHistory['oldestBlock']).to.equal(`0x0`);
    expect(feeHistory['reward'].length).to.equal(maxResultsCap);
    expect(feeHistory['baseFeePerGas'].length).to.equal(maxResultsCap + 1);
    expect(feeHistory['gasUsedRatio'].length).to.equal(maxResultsCap);
  });

  it('eth_feeHistory verify cached value', async function () {
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const latestFees = DEFAULT_NETWORK_FEES;
    const hexBlockNumber = `0x${latestBlock.number.toString(16)}`;

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);

    const firstFeeHistory = await ethImpl.feeHistory(1, hexBlockNumber, null);
    const secondFeeHistory = await ethImpl.feeHistory(1, hexBlockNumber, null);

    expect(firstFeeHistory).to.exist;
    expect(firstFeeHistory['baseFeePerGas'][0]).to.equal(BASE_FEE_PER_GAS_HEX);
    expect(firstFeeHistory['gasUsedRatio'][0]).to.equal(GAS_USED_RATIO);
    expect(firstFeeHistory['oldestBlock']).to.equal(hexBlockNumber);

    expect(firstFeeHistory).to.equal(secondFeeHistory);
  });

  it('eth_feeHistory on mirror 404', async function () {
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: 'Not found' }],
      },
    });
    const fauxGasTinyBars = 25_000;
    const fauxGasWeiBarHex = '0xe35fa931a000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);

    expect(feeHistory).to.exist;

    expect(feeHistory['baseFeePerGas'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatio'][0]).to.equal(GAS_USED_RATIO);
    expect(feeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);
    const rewards = feeHistory['reward'][0];
    expect(rewards[0]).to.equal('0x0');
    expect(rewards[1]).to.equal('0x0');
  });

  it('eth_feeHistory on mirror 500', async function () {
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };

    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
    restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
    restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, {
      _status: {
        messages: [{ message: 'Not found' }],
      },
    });

    const fauxGasTinyBars = 35_000;
    const fauxGasWeiBarHex = '0x13e52b9abe000';
    sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

    const feeHistory = await ethImpl.feeHistory(1, 'latest', null);

    expect(feeHistory['baseFeePerGas'][0]).to.equal(fauxGasWeiBarHex);
    expect(feeHistory['gasUsedRatio'][0]).to.equal(GAS_USED_RATIO);
    expect(feeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);
  });

  describe('eth_feeHistory using fixed fees', function () {
    this.beforeAll(function () {
      process.env.ETH_FEE_HISTORY_FIXED = 'true';
    });

    this.beforeEach(function () {
      cacheService.clear();
      restMock.reset();
      restMock.onGet(`network/fees`).reply(200, DEFAULT_NETWORK_FEES);
    });

    this.afterAll(function () {
      process.env.ETH_FEE_HISTORY_FIXED = 'false';
    });

    it('eth_feeHistory with fixed fees', async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', [25, 75]);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);
    });

    it('eth_feeHistory 5 blocks with latest with fixed fees', async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);
    });

    it('eth_feeHistory 5 blocks with custom newest with fixed fees', async function () {
      const latestBlockNumber = 10;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);
    });

    it('eth_feeHistory with pending param', async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'pending', []);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
    });

    it('eth_feeHistory with earliest param', async function () {
      const latestBlockNumber = 10;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/1`).reply(200, latestBlock);
      const countBlocks = 1;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'earliest', []);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(2);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
    });

    it('eth_feeHistory with fixed fees using cache', async function () {
      const latestBlockNumber = 20;
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
      restMock.onGet(`network/fees`).reply(200, DEFAULT_NETWORK_FEES);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(404, {});
      restMock.onGet(`blocks/${latestBlock.number}`).reply(404, {});

      const feeHistoryUsingCache = await ethImpl.feeHistory(countBlocks, 'latest', []);
      expect(feeHistoryUsingCache).to.exist;
      expect(feeHistoryUsingCache['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistoryUsingCache['baseFeePerGas'].length).to.eq(countBlocks + 1);
      expect(feeHistoryUsingCache['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistoryUsingCache['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistoryUsingCache['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);
    });
  });
});
