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
import path from 'path';
import dotenv from 'dotenv';
import { expect, use } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { predefined } from '../../../src/lib/errors/JsonRpcError';
import { EthImpl } from '../../../src/lib/eth';
import {
  blockLogsBloom,
  defaultContractResults,
  defaultDetailedContractResults,
  LONG_ZERO_ADDRESS,
} from '../../helpers';
import { SDKClient } from '../../../src/lib/clients';
import RelayAssertions from '../../assertions';
import { numberTo0x } from '../../../dist/formatters';
import {
  BLOCK_HASH,
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  BLOCK_TIMESTAMP_HEX,
  CONTRACTS_RESULTS_NEXT_URL,
  CONTRACT_ADDRESS_1,
  CONTRACT_ADDRESS_2,
  CONTRACT_HASH_1,
  CONTRACT_HASH_2,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  CONTRACT_RESULTS_WITH_FILTER_URL,
  CONTRACT_TIMESTAMP_1,
  CONTRACT_TIMESTAMP_2,
  DEFAULT_BLOCK,
  DEFAULT_CONTRACT,
  DEFAULT_ETH_GET_BLOCK_BY_LOGS,
  DEFAULT_NETWORK_FEES,
  LINKS_NEXT_RES,
  MOCK_ACCOUNT_WITHOUT_TRANSACTIONS,
  NO_SUCH_BLOCK_EXISTS_RES,
  contractByEvmAddress,
  DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;
let ethImplLowTransactionCount: EthImpl;

describe('@ethGetBlockByHash using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService, mirrorNodeInstance, logger, registry } =
    generateEthTestEnv(true);
  const results = defaultContractResults.results;
  const TOTAL_GAS_USED = numberTo0x(results[0].gas_used + results[1].gas_used);

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(`accounts/${LONG_ZERO_ADDRESS}?transactions=false`).reply(200, MOCK_ACCOUNT_WITHOUT_TRANSACTIONS);
    restMock
      .onGet(contractByEvmAddress(CONTRACT_ADDRESS_1))
      .reply(200, { ...DEFAULT_CONTRACT, evmAddress: CONTRACT_ADDRESS_1 });
    restMock
      .onGet(contractByEvmAddress(CONTRACT_ADDRESS_2))
      .reply(200, { ...DEFAULT_CONTRACT, evmAddress: CONTRACT_ADDRESS_2 });

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
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
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
      receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
    });
  });

  it('eth_getBlockByHash with match and duplicated transactions', async function () {
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, {
      results: [...defaultContractResults.results, ...defaultContractResults.results],
    });
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const res = await ethImpl.getBlockByHash(BLOCK_HASH, false);
    RelayAssertions.assertBlock(res, {
      transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2],
      hash: BLOCK_HASH_TRIMMED,
      number: BLOCK_NUMBER_HEX,
      timestamp: BLOCK_TIMESTAMP_HEX,
      parentHash: BLOCK_HASH_PREV_TRIMMED,
      gasUsed: TOTAL_GAS_USED,
    });
  });

  it('eth_getBlockByHash with match and valid logsBloom field', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, {
      ...DEFAULT_BLOCK,
      logs_bloom: blockLogsBloom,
    });
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
      receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
    });

    expect(result?.logsBloom).equal(blockLogsBloom);
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
      receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
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
        receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
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
        receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
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
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);

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
      .abortRequest();
    await RelayAssertions.assertRejection(predefined.INTERNAL_ERROR(), ethImpl.getBlockByHash, false, ethImpl, [
      BLOCK_HASH,
      false,
    ]);
  });

  it('eth_getBlockByHash with greater number of transactions than the ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_1}/results/${CONTRACT_TIMESTAMP_1}`)
      .reply(200, defaultDetailedContractResults);
    restMock
      .onGet(`contracts/${CONTRACT_ADDRESS_2}/results/${CONTRACT_TIMESTAMP_2}`)
      .reply(200, defaultDetailedContractResults);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const args = [BLOCK_HASH, true];

    await RelayAssertions.assertRejection(
      predefined.MAX_BLOCK_SIZE(77),
      ethImplLowTransactionCount.getBlockByHash,
      true,
      ethImplLowTransactionCount,
      args,
    );
  });
});
