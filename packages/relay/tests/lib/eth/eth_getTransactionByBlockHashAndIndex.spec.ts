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
import { expect, use } from 'chai';
import { Registry } from 'prom-client';
import sinon from 'sinon';
import * as _ from 'lodash';
import pino from 'pino';
import chaiAsPromised from 'chai-as-promised';

import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../src/lib/eth';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import { defaultContractResults, defaultDetailedContractResults } from '../../helpers';
import { Transaction, Transaction1559, Transaction2930 } from '../../../src/lib/model';
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import RelayAssertions from '../../assertions';
import { numberTo0x } from '../../../dist/formatters';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  CONTRACT_ADDRESS_1,
  CONTRACT_HASH_1,
  CONTRACT_RESULT_MOCK,
  CONTRACT_TIMESTAMP_1,
  DEFAULT_BLOCK,
  DEFAULT_NETWORK_FEES,
  EMPTY_RES,
  ETH_FEE_HISTORY_VALUE,
  NOT_FOUND_RES,
} from './eth-config';
import { contractResultsByHashByIndexURL } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

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

describe('@ethGetTransactionByBlockHashAndIndex using MirrorNode', async function () {
  this.timeout(10000);
  let ethImpl: EthImpl;

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

  it('eth_getTransactionByBlockHashAndIndex with match', async function () {
    // mirror node request mocks
    restMock
      .onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_1}/results/${CONTRACT_TIMESTAMP_1}`)
      .reply(200, defaultDetailedContractResults);
    const result = await ethImpl.getTransactionByBlockHashAndIndex(DEFAULT_BLOCK.hash, numberTo0x(DEFAULT_BLOCK.count));
    expect(result).to.exist;
    expect(result).to.not.be.null;

    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockHashAndIndex should throw for internal error', async function () {
    const randomBlock = {
      hash: '0x5f827a801c579c84eca738827b65612b28ed425b7578bfdd10177e24fc3db8d4b1a7f3d56d83c39b950cc5e4d175dd64',
      count: 9,
    };
    const defaultContractResultsWithNullableFrom = _.cloneDeep(defaultContractResults);
    defaultContractResultsWithNullableFrom.results[0].from = null;
    restMock
      .onGet(contractResultsByHashByIndexURL(randomBlock.hash, randomBlock.count))
      .reply(200, defaultContractResultsWithNullableFrom);

    const args = [randomBlock.hash, numberTo0x(randomBlock.count)];
    const errMessage = "Cannot read properties of null (reading 'substring')";

    await RelayAssertions.assertRejection(
      predefined.INTERNAL_ERROR(errMessage),
      ethImpl.getTransactionByBlockHashAndIndex,
      true,
      ethImpl,
      args,
    );
  });

  it('eth_getTransactionByBlockHashAndIndex with no contract result match', async function () {
    // mirror node request mocks
    restMock.onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count)).reply(404, NOT_FOUND_RES);

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      DEFAULT_BLOCK.hash.toString(),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex with no contract results', async function () {
    restMock.onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count)).reply(200, EMPTY_RES);

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      DEFAULT_BLOCK.hash.toString(),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.equal(null);
  });

  it('eth_getTransactionByBlockHashAndIndex returns 155 transaction for type 0', async function () {
    restMock.onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count)).reply(200, {
      results: [
        {
          ...CONTRACT_RESULT_MOCK,
          type: 0,
        },
      ],
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      DEFAULT_BLOCK.hash.toString(),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.be.an.instanceOf(Transaction);
  });

  it('eth_getTransactionByBlockHashAndIndex returns 2930 transaction for type 1', async function () {
    restMock.onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count)).reply(200, {
      results: [
        {
          ...CONTRACT_RESULT_MOCK,
          type: 1,
          access_list: [],
        },
      ],
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      DEFAULT_BLOCK.hash.toString(),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.be.an.instanceOf(Transaction2930);
  });

  it('eth_getTransactionByBlockHashAndIndex returns 1559 transaction for type 2', async function () {
    restMock.onGet(contractResultsByHashByIndexURL(DEFAULT_BLOCK.hash, DEFAULT_BLOCK.count)).reply(200, {
      results: [
        {
          ...CONTRACT_RESULT_MOCK,
          type: 2,
          access_list: [],
          max_fee_per_gas: '0x47',
          max_priority_fee_per_gas: '0x47',
        },
      ],
    });

    const result = await ethImpl.getTransactionByBlockHashAndIndex(
      DEFAULT_BLOCK.hash.toString(),
      numberTo0x(DEFAULT_BLOCK.count),
    );
    expect(result).to.be.an.instanceOf(Transaction1559);
  });
});
