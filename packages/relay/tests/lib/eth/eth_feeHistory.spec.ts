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

import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import {
  BASE_FEE_PER_GAS_HEX,
  BLOCKS_LIMIT_ORDER_URL,
  BLOCK_NUMBER_2,
  BLOCK_NUMBER_3,
  DEFAULT_BLOCK,
  DEFAULT_NETWORK_FEES,
  ETH_FEE_HISTORY_VALUE,
  GAS_USED_RATIO,
  NOT_FOUND_RES,
} from './eth-config';
import { numberTo0x } from '../../../src/formatters';
import { generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;

describe('@ethFeeHistory using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

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

  describe('eth_feeHistory with ... param', function () {
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

    this.beforeEach(() => {
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${previousBlock.number}`).reply(200, previousBlock);
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
      restMock.onGet(`network/fees?timestamp=lte:${previousBlock.timestamp.to}`).reply(200, previousFees);
      restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(200, latestFees);
    });

    it('eth_feeHistory', async function () {
      previousFees.fees[2].gas += 1;
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
      const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
    });

    it('eth_feeHistory with pending param', async function () {
      const feeHistory = await ethImpl.feeHistory(1, 'pending', [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
    });

    it('eth_feeHistory with finalized param', async function () {
      const feeHistory = await ethImpl.feeHistory(1, 'finalized', [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
    });

    it('eth_feeHistory with safe param', async function () {
      const feeHistory = await ethImpl.feeHistory(1, 'safe', [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
    });

    it('eth_feeHistory with earliest param', async function () {
      const firstBlockIndex = 0;
      const feeHistory = await ethImpl.feeHistory(1, 'earliest', [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + firstBlockIndex);
    });

    it('eth_feeHistory with number param', async function () {
      const feeHistory = await ethImpl.feeHistory(1, '0x' + BLOCK_NUMBER_3, [25, 75]);
      expect(feeHistory).to.exist;
      expect(feeHistory['oldestBlock']).to.eq('0x' + BLOCK_NUMBER_3);
    });
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

  describe('eth_feeHistory -> Mirror node returns error', function () {
    const latestBlock = { ...DEFAULT_BLOCK, number: BLOCK_NUMBER_3 };
    const fauxGasTinyBars = 25_000;
    const fauxGasWeiBarHex = '0xe35fa931a000';

    function feeHistoryOnErrorExpect(feeHistory: any) {
      expect(feeHistory).to.exist;
      expect(feeHistory['baseFeePerGas'][0]).to.equal(fauxGasWeiBarHex);
      expect(feeHistory['gasUsedRatio'][0]).to.equal(GAS_USED_RATIO);
      expect(feeHistory['oldestBlock']).to.equal(`0x${latestBlock.number.toString(16)}`);
    }

    this.beforeEach(() => {
      sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
      restMock.onGet(`network/fees?timestamp=lte:${latestBlock.timestamp.to}`).reply(404, NOT_FOUND_RES);
      restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    });

    it('eth_feeHistory on mirror 404', async function () {
      const feeHistory = await ethImpl.feeHistory(1, 'latest', [25, 75]);
      feeHistoryOnErrorExpect(feeHistory);
      const rewards = feeHistory['reward'][0];
      expect(rewards[0]).to.equal('0x0');
      expect(rewards[1]).to.equal('0x0');
    });

    it('eth_feeHistory on mirror 500', async function () {
      const feeHistory = await ethImpl.feeHistory(1, 'latest', null);
      feeHistoryOnErrorExpect(feeHistory);
    });
  });

  describe('eth_feeHistory using fixed fees', function () {
    function checkCommonFeeHistoryFields(feeHistory: any) {
      expect(feeHistory).to.exist;
      expect(feeHistory['baseFeePerGas'][0]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][1]).to.eq(BASE_FEE_PER_GAS_HEX);
      expect(feeHistory['baseFeePerGas'][2]).to.eq(BASE_FEE_PER_GAS_HEX);
    }

    function defineLatestBlockRestMock(latestBlockNumber: number) {
      const latestBlock = { ...DEFAULT_BLOCK, number: latestBlockNumber };
      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, { blocks: [latestBlock] });

      return latestBlock;
    }

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
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', [25, 75]);

      checkCommonFeeHistoryFields(feeHistory);
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
    });

    it('eth_feeHistory 5 blocks with latest with fixed fees', async function () {
      const latestBlockNumber = 20;
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      checkCommonFeeHistoryFields(feeHistory);
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
    });

    it('eth_feeHistory 5 blocks with custom newest with fixed fees', async function () {
      const latestBlockNumber = 10;
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);

      const countBlocks = 5;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      checkCommonFeeHistoryFields(feeHistory);
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);
    });

    it('eth_feeHistory with pending param', async function () {
      const latestBlockNumber = 20;
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
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
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
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
      const latestBlock = defineLatestBlockRestMock(latestBlockNumber);
      restMock.onGet(`blocks/${latestBlock.number}`).reply(200, latestBlock);
      restMock.onGet(`network/fees`).reply(200, DEFAULT_NETWORK_FEES);

      const countBlocks = 2;

      const feeHistory = await ethImpl.feeHistory(countBlocks, 'latest', []);

      checkCommonFeeHistoryFields(feeHistory);
      expect(feeHistory['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistory['baseFeePerGas'].length).to.eq(countBlocks + 1);

      restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(404, {});
      restMock.onGet(`blocks/${latestBlock.number}`).reply(404, {});

      const feeHistoryUsingCache = await ethImpl.feeHistory(countBlocks, 'latest', []);
      checkCommonFeeHistoryFields(feeHistoryUsingCache);
      expect(feeHistoryUsingCache['oldestBlock']).to.eq(numberTo0x(latestBlockNumber - countBlocks + 1));
      expect(feeHistoryUsingCache['baseFeePerGas'].length).to.eq(countBlocks + 1);
    });
  });
});
