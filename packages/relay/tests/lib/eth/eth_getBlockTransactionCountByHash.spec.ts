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
import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../../src/lib/hbarlimiter';
import { numberTo0x } from '../../../dist/formatters';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import {
  BLOCK_HASH,
  BLOCK_TRANSACTION_COUNT,
  DEFAULT_BLOCK,
  DEFAULT_NETWORK_FEES,
  ETH_FEE_HISTORY_VALUE,
  NO_SUCH_BLOCK_EXISTS_RES,
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

describe('@ethGetBlockTransactionCountByHash using MirrorNode', async function () {
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

  it('eth_getBlockTransactionCountByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH);
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByHash with match should hit cache', async function () {
    restMock.onGet(`blocks/${BLOCK_HASH}`).replyOnce(200, DEFAULT_BLOCK);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH);
      expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
    }
  });

  it('eth_getBlockTransactionCountByHash with no match', async function () {
    cacheService.clear();
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);

    const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH);
    expect(result).to.equal(null);
  });
});
