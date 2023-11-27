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
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import RelayAssertions from '../../assertions';
import { numberTo0x } from '../../../dist/formatters';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BLOCK_HASH,
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  BLOCK_TIMESTAMP_HEX,
  CONTRACTS_RESULTS_NEXT_URL,
  CONTRACT_HASH_1,
  CONTRACT_HASH_2,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  CONTRACT_RESULTS_WITH_FILTER_URL,
  DEFAULT_BLOCK,
  DEFAULT_ETH_GET_BLOCK_BY_LOGS,
  DEFAULT_NETWORK_FEES,
  ETH_FEE_HISTORY_VALUE,
  LINKS_NEXT_RES,
  NO_SUCK_BLOCK_EXISTS_RES,
} from './config';

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

describe('@ethBlockByHash using MirrorNode', async function () {
  this.timeout(10000);
  let ethImpl: EthImpl;
  const results = defaultContractResults.results;
  const TOTAL_GAS_USED = numberTo0x(results[0].gas_used + results[1].gas_used);

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

  it('eth_getBlockByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

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
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
    restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

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

  it('eth_getBlockByHash should hit cache', async function () {
    restMock.onGet(`blocks/${BLOCK_HASH}`).replyOnce(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).replyOnce(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockByHash(BLOCK_HASH, false);
      expect(result).to.exist;
      expect(result).to.not.be.null;
      if (result) {
        expect(result.hash).equal(BLOCK_HASH_TRIMMED);
        expect(result.number).equal(BLOCK_NUMBER_HEX);
        RelayAssertions.verifyBlockConstants(result);
      }
    }
  });

  it('eth_getBlockByHash with match and details', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true);
    RelayAssertions.assertBlock(
      result,
      {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        timestamp: BLOCK_TIMESTAMP_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      },
      true,
    );
  });

  it('eth_getBlockByHash with match and details paginated', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, LINKS_NEXT_RES);
    restMock.onGet(CONTRACTS_RESULTS_NEXT_URL).reply(200, defaultContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true);
    RelayAssertions.assertBlock(
      result,
      {
        hash: BLOCK_HASH_TRIMMED,
        gasUsed: TOTAL_GAS_USED,
        number: BLOCK_NUMBER_HEX,
        parentHash: BLOCK_HASH_PREV_TRIMMED,
        timestamp: BLOCK_TIMESTAMP_HEX,
        transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      },
      true,
    );
  });

  it('eth_getBlockByHash with block match and contract revert', async function () {
    cacheService.clear();
    const randomBlock = {
      ...DEFAULT_BLOCK,
      gas_used: 400000,
    };
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, randomBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, []);
    restMock
      .onGet(
        `contracts/results/logs?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .reply(200, { logs: [] });

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true);
    RelayAssertions.assertBlock(result, {
      hash: BLOCK_HASH_TRIMMED,
      gasUsed: numberTo0x(randomBlock.gas_used),
      number: BLOCK_NUMBER_HEX,
      parentHash: BLOCK_HASH_PREV_TRIMMED,
      timestamp: BLOCK_TIMESTAMP_HEX,
      transactions: [],
    });
  });

  it('eth_getBlockByHash with no match', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(404, NO_SUCK_BLOCK_EXISTS_RES);

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, false);
    expect(result).to.equal(null);
  });

  it('eth_getBlockByHash should throw if unexpected error', async function () {
    // mirror node request mocks
    const randomBlock = {
      timestamp: {
        from: `1651560386.060890949`,
        to: '1651560389.060890919',
      },
    };
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, randomBlock);
    restMock
      .onGet(
        `contracts/results?timestamp=gte:${randomBlock.timestamp.from}&timestamp=lte:${randomBlock.timestamp.to}&limit=100&order=asc`,
      )
      .abortRequestOnce();
    await RelayAssertions.assertRejection(predefined.INTERNAL_ERROR(), ethImpl.getBlockByHash, false, ethImpl, [
      BLOCK_HASH,
      false,
    ]);
  });
});
