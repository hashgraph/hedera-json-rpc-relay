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
import * as _ from 'lodash';
import chaiAsPromised from 'chai-as-promised';

import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { defaultContractResults, defaultDetailedContractResults } from '../../helpers';
import { Transaction } from '../../../src/lib/model';
import { SDKClient } from '../../../src/lib/clients';
import RelayAssertions from '../../assertions';
import { numberTo0x } from '../../../dist/formatters';
import {
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  CONTRACT_ADDRESS_1,
  CONTRACT_HASH_1,
  CONTRACT_TIMESTAMP_1,
  DEFAULT_BLOCK,
  DEFAULT_BLOCKS_RES,
  DEFAULT_NETWORK_FEES,
  NO_SUCH_CONTRACT_RESULT,
} from './eth-config';
import { contractResultsByNumberByIndexURL, generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;

function verifyAggregatedInfo(result: Transaction | null) {
  // verify aggregated info
  expect(result).to.exist;
  expect(result).to.not.be.null;
  if (result) {
    expect(result.blockHash).equal(BLOCK_HASH_TRIMMED);
    expect(result.blockNumber).equal(BLOCK_NUMBER_HEX);
    expect(result.hash).equal(CONTRACT_HASH_1);
    expect(result.to).equal(CONTRACT_ADDRESS_1);
  }
}

describe('@ethGetTransactionByBlockNumberAndIndex using MirrorNode', async function () {
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

  it('eth_getTransactionByBlockNumberAndIndex with match', async function () {
    // mirror node request mocks
    restMock
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_1}/results/${CONTRACT_TIMESTAMP_1}`)
      .reply(200, defaultDetailedContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      numberTo0x(DEFAULT_BLOCK.number),
      numberTo0x(DEFAULT_BLOCK.count),
    );

    verifyAggregatedInfo(result);
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
      .onGet(contractResultsByNumberByIndexURL(randomBlock.number, randomBlock.count))
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
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
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
      .onGet(contractResultsByNumberByIndexURL(randomBlock.number, randomBlock.count))
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
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
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
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('latest', numberTo0x(DEFAULT_BLOCK.count));
    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with finalized tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, DEFAULT_BLOCKS_RES);
    restMock
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('finalized', numberTo0x(DEFAULT_BLOCK.count));
    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with safe tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, DEFAULT_BLOCKS_RES);
    restMock
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('safe', numberTo0x(DEFAULT_BLOCK.count));
    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with match pending tag', async function () {
    // mirror node request mocks
    restMock.onGet('blocks?limit=1&order=desc').reply(200, DEFAULT_BLOCKS_RES);
    restMock
      .onGet(contractResultsByNumberByIndexURL(DEFAULT_BLOCK.number, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('pending', numberTo0x(DEFAULT_BLOCK.count));
    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with earliest tag', async function () {
    // mirror node request mocks
    restMock.onGet(contractResultsByNumberByIndexURL(0, DEFAULT_BLOCK.count)).reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex('earliest', numberTo0x(DEFAULT_BLOCK.count));
    verifyAggregatedInfo(result);
  });

  it('eth_getTransactionByBlockNumberAndIndex with hex number', async function () {
    restMock
      .onGet(contractResultsByNumberByIndexURL(3735929054, DEFAULT_BLOCK.count))
      .reply(200, defaultContractResults);

    const result = await ethImpl.getTransactionByBlockNumberAndIndex(
      '0xdeadc0de' + '',
      numberTo0x(DEFAULT_BLOCK.count),
    );
    verifyAggregatedInfo(result);
  });
});
