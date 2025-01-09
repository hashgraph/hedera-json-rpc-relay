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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import { ASCIIToHex, numberTo0x, prepend0x } from '../../../dist/formatters';
import { predefined } from '../../../src';
import { SDKClient } from '../../../src/lib/clients';
import { EthImpl } from '../../../src/lib/eth';
import { RequestDetails } from '../../../src/lib/types';
import RelayAssertions from '../../assertions';
import {
  blockLogsBloom,
  defaultContractResults,
  defaultDetailedContractResults,
  overrideEnvsInMochaDescribe,
} from '../../helpers';
import {
  ACCOUNT_WITHOUT_TRANSACTIONS,
  BLOCK_HASH,
  BLOCK_HASH_PREV_TRIMMED,
  BLOCK_HASH_TRIMMED,
  BLOCK_NUMBER_HEX,
  BLOCK_TIMESTAMP_HEX,
  CONTRACT_ADDRESS_1,
  CONTRACT_ADDRESS_2,
  CONTRACT_HASH_1,
  CONTRACT_HASH_2,
  CONTRACT_RESULTS_LOGS_WITH_FILTER_URL,
  CONTRACT_RESULTS_WITH_FILTER_URL,
  CONTRACT_TIMESTAMP_1,
  CONTRACT_TIMESTAMP_2,
  contractByEvmAddress,
  CONTRACTS_RESULTS_NEXT_URL,
  DEFAULT_BLOCK,
  DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
  DEFAULT_CONTRACT,
  DEFAULT_ETH_GET_BLOCK_BY_LOGS,
  DEFAULT_LOGS,
  DEFAULT_NETWORK_FEES,
  LINKS_NEXT_RES,
  MOCK_ACCOUNT_WITHOUT_TRANSACTIONS,
  NO_SUCH_BLOCK_EXISTS_RES,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';

use(chaiAsPromised);

let sdkClientStub: sinon.SinonStubbedInstance<SDKClient>;
let getSdkClientStub: sinon.SinonStub;
let ethImplLowTransactionCount: EthImpl;

describe('@ethGetBlockByHash using MirrorNode', async function () {
  this.timeout(10000);
  const { restMock, hapiServiceInstance, ethImpl, cacheService, mirrorNodeInstance, logger, registry } =
    generateEthTestEnv(true);
  const results = defaultContractResults.results;
  const TOTAL_GAS_USED = numberTo0x(results[0].gas_used + results[1].gas_used);

  const requestDetails = new RequestDetails({ requestId: 'eth_getBlockByHashTest', ipAddress: '0.0.0.0' });

  overrideEnvsInMochaDescribe({ ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE: 1 });

  this.beforeEach(async () => {
    // reset cache and restMock
    await cacheService.clear(requestDetails);
    restMock.reset();
    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(ACCOUNT_WITHOUT_TRANSACTIONS).reply(200, MOCK_ACCOUNT_WITHOUT_TRANSACTIONS);
    restMock
      .onGet(contractByEvmAddress(CONTRACT_ADDRESS_1))
      .reply(200, { ...DEFAULT_CONTRACT, evmAddress: CONTRACT_ADDRESS_1 });
    restMock
      .onGet(contractByEvmAddress(CONTRACT_ADDRESS_2))
      .reply(200, { ...DEFAULT_CONTRACT, evmAddress: CONTRACT_ADDRESS_2 });

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
  });

  it('eth_getBlockByHash with match', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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

    const res = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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
      const result = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true, requestDetails);
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

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true, requestDetails);
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
    await cacheService.clear(requestDetails);
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

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, true, requestDetails);
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
    await cacheService.clear(requestDetails);
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(404, NO_SUCH_BLOCK_EXISTS_RES);

    const result = await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
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
      requestDetails,
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

    const args = [BLOCK_HASH, true, requestDetails];

    await RelayAssertions.assertRejection(
      predefined.MAX_BLOCK_SIZE(77),
      ethImplLowTransactionCount.getBlockByHash,
      true,
      ethImplLowTransactionCount,
      args,
    );
  });

  [false, true].forEach((showDetails) => {
    it(`eth_getBlockByHash should skip wrong nonce transactions when showDetails = ${showDetails}`, async () => {
      // mirror node request mocks
      restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
      restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, {
        results: [
          ...defaultContractResults.results,
          { ...defaultContractResults.results[1], result: 'WRONG_NONCE' },
          { ...defaultContractResults.results[1], error_message: prepend0x(ASCIIToHex('WRONG_NONCE')) },
        ],
      });
      restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, DEFAULT_ETH_GET_BLOCK_BY_LOGS);

      const result = await ethImpl.getBlockByHash(BLOCK_HASH, showDetails, requestDetails);

      RelayAssertions.assertBlock(
        result,
        {
          hash: BLOCK_HASH_TRIMMED,
          gasUsed: TOTAL_GAS_USED,
          number: BLOCK_NUMBER_HEX,
          parentHash: BLOCK_HASH_PREV_TRIMMED,
          timestamp: BLOCK_TIMESTAMP_HEX,
          transactions: [CONTRACT_HASH_1, CONTRACT_HASH_2], // should not include the transaction with wrong nonce
          receiptsRoot: DEFAULT_BLOCK_RECEIPTS_ROOT_HASH,
        },
        showDetails,
      );
    });
  });

  it('eth_getBlockByHash should throw an error if nulbale entities found in logs', async function () {
    // mirror node request mocks
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(CONTRACT_RESULTS_WITH_FILTER_URL).reply(200, defaultContractResults);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);

    const nullEntitiedLogs = [
      {
        logs: [{ ...DEFAULT_LOGS.logs[0], block_number: null }],
      },
      {
        logs: [{ ...DEFAULT_LOGS.logs[0], index: null }],
      },
      {
        logs: [{ ...DEFAULT_LOGS.logs[0], block_hash: '0x' }],
      },
    ];

    for (const logEntry of nullEntitiedLogs) {
      try {
        restMock.onGet(CONTRACT_RESULTS_LOGS_WITH_FILTER_URL).reply(200, logEntry);

        await ethImpl.getBlockByHash(BLOCK_HASH, false, requestDetails);
        expect.fail('should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
        expect(error.message).to.include('The log entry from the remote Mirror Node server is missing required fields');
      }
    }
  });
});
