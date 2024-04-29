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
import { expect, use } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../src/lib/eth';
import { defaultContractResults, defaultDetailedContractResults } from '../../helpers';
import { Block, Transaction } from '../../../src/lib/model';
import { SDKClient } from '../../../src/lib/clients';
import RelayAssertions from '../../assertions';
import { hashNumber, numberTo0x } from '../../../dist/formatters';
import {
  BLOCKS_LIMIT_ORDER_URL,
  BLOCKS_RES,
  BLOCK_HASH,
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NOT_FOUND_RES,
  BLOCK_NUMBER,
  BLOCK_NUMBER_HEX,
  BLOCK_NUMBER_WITH_SYN_TXN,
  BLOCK_TIMESTAMP_HEX,
  BLOCK_WITH_SYN_TXN,
  CONTRACTS_RESULTS_NEXT_URL,
  CONTRACT_ADDRESS_1,
  CONTRACT_ADDRESS_2,
  CONTRACT_HASH_1,
  CONTRACT_HASH_2,
  CONTRACT_QUERY,
  CONTRACT_RESPONSE_MOCK,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  CONTRACT_RESULTS_WITH_FILTER_URL,
  CONTRACT_TIMESTAMP_1,
  CONTRACT_TIMESTAMP_2,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_CONTRACT_RES_REVERT,
  DEFAULT_ETH_GET_BLOCK_BY_LOGS,
  DEFAULT_NETWORK_FEES,
  GAS_USED_1,
  GAS_USED_2,
  LATEST_BLOCK_QUERY,
  LATEST_BLOCK_RESPONSE,
  LINKS_NEXT_RES,
  LOGS_RESPONSE_MOCK,
  LOG_QUERY,
  MOST_RECENT_BLOCK,
  NOT_FOUND_RES,
  NO_SUCH_BLOCK_EXISTS_RES,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';
import { fail } from 'assert';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;
let ethImplLowTransactionCount: EthImpl;

describe('@ethGetBlockByNumber using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService, mirrorNodeInstance, logger, registry } =
    generateEthTestEnv(true);
  const results = defaultContractResults.results;
  const TOTAL_GAS_USED = numberTo0x(results[0].gas_used + results[1].gas_used);

  const veriftAggregatedInfo = (result) => {
    // verify aggregated info
    expect(result).to.exist;
    expect(result).to.not.be.null;
    expect(result.hash).equal(BLOCK_HASH_TRIMMED);
    expect(result.number).equal(BLOCK_NUMBER_HEX);
    expect(result.parentHash).equal(BLOCK_HASH_PREV_TRIMMED);
    expect(result.timestamp).equal(BLOCK_TIMESTAMP_HEX);
  };

  function verifyTransactions(transactions: Array<Transaction>) {
    expect(transactions.length).equal(2);
    expect(transactions[0].hash).equal(CONTRACT_HASH_1);
    expect(transactions[1].hash).equal(CONTRACT_HASH_2);
    expect(transactions[1].gas).equal(hashNumber(GAS_USED_2));
  }

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();
    restMock.resetHandlers();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    currentMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE);
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = '1';
    ethImplLowTransactionCount = new EthImpl(
      hapiServiceInstance,
      mirrorNodeInstance,
      logger,
      '0x12a',
      registry,
      cacheService,
    );
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(`accounts/${defaultContractResults.results[0].from}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultContractResults.results[1].from}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultContractResults.results[0].to}?transactions=false`).reply(200);
    restMock.onGet(`accounts/${defaultContractResults.results[1].to}?transactions=false`).reply(200);
    restMock.onGet(`contracts/${defaultContractResults.results[0].from}`).reply(404, NOT_FOUND_RES);
    restMock.onGet(`contracts/${defaultContractResults.results[1].from}`).reply(404, NOT_FOUND_RES);
    restMock.onGet(`contracts/${defaultContractResults.results[0].to}`).reply(200);
    restMock.onGet(`contracts/${defaultContractResults.results[1].to}`).reply(200);
    restMock.onGet(`tokens/${defaultContractResults.results[0].contract_id}`).reply(200);
    restMock.onGet(`tokens/${defaultContractResults.results[1].contract_id}`).reply(200);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();

    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
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

    try {
      await ethImpl.blockNumber();
    } catch (error) {}
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
      const toMatch = {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      };
      RelayAssertions.assertBlock(result, toMatch);
    });
  });

  it('eth_getBlockByNumber with zero transactions', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, { ...DEFAULT_BLOCK, gas_used: 0 });
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, { results: [] });
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, { logs: [] });
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), false);
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
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    if (result) {
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(TOTAL_GAS_USED);
      verifyTransactions(result.transactions as Array<Transaction>);

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with match and details and sythetic transactions', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER_WITH_SYN_TXN}`).reply(200, BLOCK_WITH_SYN_TXN);

    restMock.onGet(LATEST_BLOCK_QUERY).reply(200, LATEST_BLOCK_RESPONSE);
    restMock.onGet(CONTRACT_QUERY).reply(200, CONTRACT_RESPONSE_MOCK);
    restMock.onGet(LOG_QUERY).reply(200, LOGS_RESPONSE_MOCK);

    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER_WITH_SYN_TXN), true);
    if (result) {
      result.transactions.forEach((txn) => {
        expect(txn.maxFeePerGas).to.exist;
        expect(txn.maxPriorityFeePerGas).to.exist;
      });
    } else {
      fail('Result is null');
    }
  });

  it('eth_getBlockByNumber with match and details paginated', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
    restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    if (result) {
      // verify aggregated info
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(TOTAL_GAS_USED);
      verifyTransactions(result.transactions as Array<Transaction>);

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with block match and contract revert', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, { ...DEFAULT_BLOCK, gas_used: GAS_USED_1 });
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, DEFAULT_CONTRACT_RES_REVERT);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, { logs: [] });
    const result = await ethImpl.getBlockByNumber(numberTo0x(BLOCK_NUMBER), true);
    if (result) {
      veriftAggregatedInfo(result);
      expect(result.gasUsed).equal(numberTo0x(GAS_USED_1));
      expect(result.transactions.length).equal(1);

      // verify expected constants
      RelayAssertions.verifyBlockConstants(result);
    }
  });

  it('eth_getBlockByNumber with no match', async function () {
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);

    const result = await ethImpl.getBlockByNumber(BLOCK_NUMBER.toString(), false);
    expect(result).to.equal(null);
  });

  describe('eth_getBlockByNumber with tag', async function () {
    const TOTAL_GET_CALLS_EXECUTED = 12;
    function confirmResult(result: Block | null) {
      expect(result).to.exist;
      expect(result).to.not.be.null;

      if (result) {
        expect(result.number).equal(BLOCK_NUMBER_HEX);
      }
    }

    this.beforeEach(() => {
      restMock.resetHistory();
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);
      for (const result of defaultContractResults.results) {
        restMock.onGet(`contracts/${result.to}/results/${result.timestamp}`).reply(404, NOT_FOUND_RES);
      }
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    });

    it('eth_getBlockByNumber with latest tag', async function () {
      const result = await ethImpl.getBlockByNumber('latest', false);
      // check that we only made the expected number of requests with the expected urls
      expect(restMock.history.get.length).equal(TOTAL_GET_CALLS_EXECUTED);
      expect(restMock.history.get[0].url).equal(BLOCKS_LIMIT_ORDER_URL);
      expect(restMock.history.get[1].url).equal(
        'contracts/results?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[2].url).equal(
        'contracts/results/logs?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[TOTAL_GET_CALLS_EXECUTED - 1].url).equal('network/fees');
      confirmResult(result);
    });

    it('eth_getBlockByNumber with latest tag paginated', async function () {
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
      restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);

      const result = await ethImpl.getBlockByNumber('latest', false);
      confirmResult(result);
    });

    it('eth_getBlockByNumber with pending tag', async function () {
      const result = await ethImpl.getBlockByNumber('pending', false);
      confirmResult(result);
    });

    it('eth_getBlockByNumber with earliest tag', async function () {
      restMock.onGet(`blocks/0`).reply(200, DEFAULT_BLOCK);

      const result = await ethImpl.getBlockByNumber('earliest', false);
      confirmResult(result);
    });

    it('eth_getBlockByNumber with finalized tag', async function () {
      const result = await ethImpl.getBlockByNumber('finalized', false);
      // check that we only made the expected number of requests with the expected urls
      expect(restMock.history.get.length).equal(TOTAL_GET_CALLS_EXECUTED);
      expect(restMock.history.get[0].url).equal(BLOCKS_LIMIT_ORDER_URL);
      expect(restMock.history.get[1].url).equal(
        'contracts/results?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[2].url).equal(
        'contracts/results/logs?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[TOTAL_GET_CALLS_EXECUTED - 1].url).equal('network/fees');
      confirmResult(result);
    });

    it('eth_getBlockByNumber with safe tag', async function () {
      const result = await ethImpl.getBlockByNumber('safe', false);
      // check that we only made the expected number of requests with the expected urls
      expect(restMock.history.get.length).equal(TOTAL_GET_CALLS_EXECUTED);
      expect(restMock.history.get[0].url).equal(BLOCKS_LIMIT_ORDER_URL);
      expect(restMock.history.get[1].url).equal(
        'contracts/results?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[2].url).equal(
        'contracts/results/logs?timestamp=gte:1651560386.060890949&timestamp=lte:1651560389.060890949&limit=100&order=asc',
      );
      expect(restMock.history.get[TOTAL_GET_CALLS_EXECUTED - 1].url).equal('network/fees');
      confirmResult(result);
    });

    it('eth_getBlockByNumber with hex number tag', async function () {
      restMock.onGet(`blocks/3735929054`).reply(200, DEFAULT_BLOCK);
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, BLOCKS_RES);

      const result = await ethImpl.getBlockByNumber('0xdeadc0de', false);
      confirmResult(result);
    });
  });

  it('eth_getBlockByNumber with greater number of transactions than the ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_1}/results/${CONTRACT_TIMESTAMP_1}`)
      .reply(200, defaultDetailedContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_2}/results/${CONTRACT_TIMESTAMP_2}`)
      .reply(200, defaultDetailedContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const args = [numberTo0x(BLOCK_NUMBER), true];

    await RelayAssertions.assertRejection(
      predefined.MAX_BLOCK_SIZE(77),
      ethImplLowTransactionCount.getBlockByNumber,
      true,
      ethImplLowTransactionCount,
      args,
    );
  });
});
