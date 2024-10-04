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

import { ConfigServiceTestHelper } from '../../../../config-service/tests/configServiceTestHelper';
import { expect, use } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { SDKClient } from '../../../src/lib/clients';
import { numberTo0x } from '../../../dist/formatters';
import {
  BLOCK_HASH,
  BLOCK_TRANSACTION_COUNT,
  DEFAULT_BLOCK,
  DEFAULT_NETWORK_FEES,
  NO_SUCH_BLOCK_EXISTS_RES,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';
import { RequestDetails } from '../../../src/lib/types';

use(chaiAsPromised);

let sdkClientStub: sinon.SinonStubbedInstance<SDKClient>;
let getSdkClientStub: sinon.SinonStub;

describe('@ethGetBlockTransactionCountByHash using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

  const requestDetails = new RequestDetails({
    requestId: 'eth_getBlockTransactionCountByHashTest',
    ipAddress: '0.0.0.0',
  });

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear(requestDetails);
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
  });

  it('eth_getBlockTransactionCountByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);

    const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH, requestDetails);
    expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
  });

  it('eth_getBlockTransactionCountByHash with match should hit cache', async function () {
    restMock.onGet(`blocks/${BLOCK_HASH}`).replyOnce(200, DEFAULT_BLOCK);

    for (let i = 0; i < 3; i++) {
      const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH, requestDetails);
      expect(result).equal(numberTo0x(BLOCK_TRANSACTION_COUNT));
    }
  });

  it('eth_getBlockTransactionCountByHash with no match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);

    const result = await ethImpl.getBlockTransactionCountByHash(BLOCK_HASH, requestDetails);
    expect(result).to.equal(null);
  });
});
