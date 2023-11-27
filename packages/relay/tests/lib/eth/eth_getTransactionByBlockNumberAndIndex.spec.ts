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
import { defaultContractResults, defaultDetailedContractResults } from '../../helpers';
import { Transaction } from '../../../src/lib/model';
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import RelayAssertions from '../../assertions';
import { numberTo0x } from '../../../dist/formatters';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  BLOCK_TIMESTAMP_HEX,
  CONTRACT_ADDRESS_1,
  CONTRACT_HASH_1,
  CONTRACT_TIMESTAMP_1,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_NETWORK_FEES,
  ETH_FEE_HISTORY_VALUE,
  NO_SUCH_CONTRACT_RESULT,
} from './config';
import { contractResultsByNumberByIndex } from './helpers';

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

function verifyAggregatedInfo(result: Transaction | null) {
  // verify aggregated info
  if (result) {
    expect(result.blockHash).equal(BLOCK_HASH_TRIMMED);
    expect(result.blockNumber).equal(BLOCK_NUMBER_HEX);
    expect(result.hash).equal(CONTRACT_HASH_1);
    expect(result.to).equal(CONTRACT_ADDRESS_1);
  }
}

describe('@ethGetTransactionByBlockNumberAndIndex using MirrorNode', async function () {
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

  it('eth_getTransactionByBlockNumberAndIndex with match', async function () {
    // mirror node request mocks
    restMock
      .onGet(contractResultsByNumberByIndex(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_1}/results/${CONTRACT_TIMESTAMP_1}`)
      .reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(DEFAULT_BLOCK.number),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      // verify aggregated info
      expect(result.blockHash).equal(BLOCK_HASH_TRIMMED);
      expect(result.blockNumber).equal(BLOCK_NUMBER_HEX);
      expect(result.hash).equal(CONTRACT_HASH_1);
      expect(result.to).equal(CONTRACT_ADDRESS_1);
    }
  });

  it('eth_getTransactionByBlockNumberAndIndex with null amount', async function () {
    const randomBlock = {
      number: 1009,
      count: 37,
    };
    const nullableDefaultContractResults = _.cloneDeep(defaultContractResults);
    // @ts-ignore
    nullableDefaultContractResults.results[0].amount = null;
    restMock
      .onGet(contractResultsByNumberByIndex(randomBlock.number, randomBlock.count))
      .reply(200, nullableDefaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(randomBlock.number),
      numberTo0x(randomBlock.count),
    );
    expect(result).to.exist;
    expect(result).to.not.be.null;

    if (result) {
      // verify aggregated info
      expect(result.value).equal('0x0');
    }
  });

  it('eth_getTransactionByBlockNumberAndIndex with no contract result match', async function () {
    restMock
      .onGet(contractResultsByNumberByIndex(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(404, NO_SUCH_CONTRACT_RESULT);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(DEFAULT_BLOCK.number),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex should throw for internal error', async function () {
    const defaultContractResultsWithNullableFrom = _.cloneDeep(defaultContractResults);
    defaultContractResultsWithNullableFrom.results[0].from = null;
    const randomBlock = {
      number: 5644,
      count: 33,
    };
    restMock
      .onGet(contractResultsByNumberByIndex(randomBlock.number, randomBlock.count))
      .reply(200, defaultContractResultsWithNullableFrom);

    const args = [numberTo0x(randomBlock.number), numberTo0x(randomBlock.count)];
    const errMessage = "Cannot read properties of null (reading 'substring')";

    await RelayAssertions.assertRejection(
      predefined.INTERNAL_ERROR(errMessage),
      ethImpl.getTransactionByBlockNumberAndIndex,
      true,
      ethImpl,
      args,
    );
  });

  it('eth_getTransactionByBlockNumberAndIndex with no contract results', async function () {
    restMock
      .onGet(contractResultsByNumberByIndex(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, { results: [] });

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(DEFAULT_BLOCK.number),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockNumberAndIndex with latest tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, DEFAULT_BLOCKS_RES);
    restMock
      .onGet(contractResultsByNumberByIndex(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('latest', numberTo0x(DEFAULT_BLOCK.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with match pending tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, DEFAULT_BLOCKS_RES);
    restMock
      .onGet(contractResultsByNumberByIndex(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('pending', numberTo0x(DEFAULT_BLOCK.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with earliest tag', async function () {
    // mirror node request mocks
    restMock.onGet(contractResultsByNumberByIndex(0, DEFAULT_BLOCK.count)).reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('earliest', numberTo0x(DEFAULT_BLOCK.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with hex number', async function () {
    restMock.onGet(contractResultsByNumberByIndex(3735929054, DEFAULT_BLOCK.count)).reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      '0xdeadc0de' + '',
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.exist;
    expect(result).to.not.be.null;

    verifyAggregatedInfo(result);
  });
});
