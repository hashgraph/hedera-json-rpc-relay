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

import { SDKClient } from '../../../src/lib/clients';
import { numberTo0x } from '../../../dist/formatters';
import {
  BLOCKS_LIMIT_ORDER_URL,
  BLOCK_NUMBER,
  BLOCK_TRANSACTION_COUNT,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_NETWORK_FEES,
  NO_SUCH_BLOCK_EXISTS_RES,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;

describe('@ethGetBlockTransactionCountByNumber using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
  });

  it('eth_getBlockTransactionCountByNumber with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber(BLOCK_NUMBER.toString());
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with match should hit cache', async function () {
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).replyOnce(200, DEFAULT_BLOCK);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockTransactionCountByNumber(BLOCK_NUMBER.toString());
      expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
    }
  });

  it('eth_getBlockTransactionCountByNumber with no match', async function () {
    cacheService.clear();
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);

    const result = await ethImpl.getBlockTransactionCountByNumber(BLOCK_NUMBER.toString());
    expect(result).to.equal(null);
  });

  it('eth_getBlockTransactionCountByNumber with latest tag', async function () {
    // mirror node request mocks
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('latest');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with finalized tag', async function () {
    // mirror node request mocks
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('finalized');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with safe tag', async function () {
    // mirror node request mocks
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('safe');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with pending tag', async function () {
    // mirror node request mocks
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, DEFAULT_BLOCKS_RES);
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('pending');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with earliest tag', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/0`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('earliest');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByNumber with hex number', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/3735929054`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByNumber('0xdeadc0de');
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });
});
