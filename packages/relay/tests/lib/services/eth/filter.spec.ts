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

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { MirrorNodeClient } from '../../../../src/lib/clients';
import pino from 'pino';
import constants from '../../../../src/lib/constants';
import { CommonService, FilterService } from '../../../../src/lib/services/ethService';
import {
  defaultBlock,
  defaultEvmAddress,
  defaultLogs1,
  defaultLogTopics,
  toHex,
  withOverriddenEnvsInMochaTest,
} from '../../../helpers';
import RelayAssertions from '../../../assertions';
import { predefined } from '../../../../src';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { RequestDetails } from '../../../../src/lib/types';
import { v4 as uuid } from 'uuid';

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let filterService: FilterService;
let cacheService: CacheService;

describe('Filter API Test Suite', async function () {
  this.timeout(10000);

  const requestDetails = new RequestDetails({ requestId: uuid(), ipAddress: '0.0.0.0' });
  const filterObject = {
    toBlock: 'latest',
  };

  const blockFilterObject = {
    type: constants.FILTER.TYPE.NEW_BLOCK,
    params: {
      blockAtCreation: defaultBlock.number,
    },
    lastQueried: null,
  };
  const existingFilterId = '0x1112233';
  const nonExistingFilterId = '0x1112231';
  const LATEST_BLOCK_QUERY = 'blocks?limit=1&order=desc';
  const BLOCK_BY_NUMBER_QUERY = 'blocks';

  const validateFilterCache = async (filterId: string, expectedFilterType: string, expectedParams = {}) => {
    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const cachedFilter = await cacheService.getAsync(cacheKey, 'validateFilterCache', requestDetails);
    expect(cachedFilter).to.exist;
    expect(cachedFilter.type).to.exist;
    expect(cachedFilter.type).to.eq(expectedFilterType);
    expect(cachedFilter.params).to.exist;
    expect(cachedFilter.params).to.deep.eq(expectedParams);
    expect(cachedFilter.lastQueried).to.be.null;
  };

  this.beforeAll(() => {
    cacheService = new CacheService(logger.child({ name: `cache` }), registry);
    mirrorNodeInstance = new MirrorNodeClient(
      ConfigService.get('MIRROR_NODE_URL'),
      logger.child({ name: `mirror-node` }),
      registry,
      cacheService,
    );

    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });

    const common = new CommonService(mirrorNodeInstance, logger.child({ name: 'common-service' }), cacheService);
    filterService = new FilterService(
      mirrorNodeInstance,
      logger.child({ name: 'filter-service' }),
      cacheService,
      common,
    );
  });

  this.beforeEach(async () => {
    // reset cache and restMock
    await cacheService.clear(requestDetails);
    restMock.reset();
  });

  this.afterEach(() => {
    restMock.resetHandlers();
  });

  describe('all methods require a filter flag', async function () {
    withOverriddenEnvsInMochaTest({ FILTER_API_ENABLED: undefined }, () => {
      it(`should throw UNSUPPORTED_METHOD for newFilter`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.newFilter,
          true,
          filterService,
          [undefined, undefined, requestDetails],
        );
      });

      it(`should throw UNSUPPORTED_METHOD for uninstallFilter`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.uninstallFilter,
          true,
          filterService,
          [existingFilterId, requestDetails],
        );
      });

      it(`should throw UNSUPPORTED_METHOD for getFilterChanges`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.getFilterChanges,
          true,
          filterService,
          [existingFilterId, requestDetails],
        );
      });
    });

    withOverriddenEnvsInMochaTest({ FILTER_API_ENABLED: true }, () => {
      let filterId: string;

      beforeEach(async () => {
        restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [{ ...defaultBlock }] });
        filterId = await filterService.newFilter(undefined, undefined, requestDetails);
      });

      it(`should call newFilter`, async function () {
        expect(filterId).to.exist;
        expect(RelayAssertions.validateHash(filterId, 32)).to.eq(true, 'returns valid filterId');
      });

      it(`should call getFilterChanges`, async function () {
        restMock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
        restMock
          .onGet(
            `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
          )
          .reply(200, defaultLogs1);
        const filterChanges = await filterService.getFilterChanges(filterId, requestDetails);
        expect(filterChanges).to.exist;
      });

      it(`should call uninstallFilter`, async function () {
        const isFilterUninstalled = await filterService.uninstallFilter(filterId, requestDetails);
        expect(isFilterUninstalled).to.eq(true, 'executes correctly');
      });
    });

    withOverriddenEnvsInMochaTest({ FILTER_API_ENABLED: false }, () => {
      it(`should throw UNSUPPORTED_METHOD for newFilter`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.newFilter,
          true,
          filterService,
          [undefined, undefined, requestDetails],
        );
      });

      it(`should throw UNSUPPORTED_METHOD for uninstallFilter`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.uninstallFilter,
          true,
          filterService,
          [existingFilterId, requestDetails],
        );
      });

      it(`should throw UNSUPPORTED_METHOD for getFilterChanges`, async function () {
        await RelayAssertions.assertRejection(
          predefined.UNSUPPORTED_METHOD,
          filterService.getFilterChanges,
          true,
          filterService,
          [existingFilterId, requestDetails],
        );
      });
    });
  });

  describe('eth_newFilter', async function () {
    let blockNumberHexes: Record<number, string>;
    let numberHex: string;

    beforeEach(() => {
      blockNumberHexes = {
        5: toHex(5),
        1400: toHex(1400),
        1500: toHex(1500),
        2000: toHex(2000),
        2001: toHex(2001),
      };

      numberHex = blockNumberHexes[1500];

      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/5`).reply(200, { ...defaultBlock, number: 5 });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/1400`).reply(200, { ...defaultBlock, number: 1400 });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/1500`).reply(200, { ...defaultBlock, number: 1500 });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/2000`).reply(200, { ...defaultBlock, number: 2000 });
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [{ ...defaultBlock, number: 2002 }] });
    });

    it('Returns a valid filterId', async function () {
      expect(
        RelayAssertions.validateHash(await filterService.newFilter(undefined, undefined, requestDetails), 32),
      ).to.eq(true, 'with default param values');
      expect(
        RelayAssertions.validateHash(await filterService.newFilter(numberHex, undefined, requestDetails), 32),
      ).to.eq(true, 'with fromBlock');
      expect(
        RelayAssertions.validateHash(await filterService.newFilter(numberHex, 'latest', requestDetails), 32),
      ).to.eq(true, 'with fromBlock, toBlock');
      expect(
        RelayAssertions.validateHash(
          await filterService.newFilter(numberHex, 'latest', requestDetails, defaultEvmAddress),
          32,
        ),
      ).to.eq(true, 'with fromBlock, toBlock, address');
      expect(
        RelayAssertions.validateHash(
          await filterService.newFilter(numberHex, 'latest', requestDetails, defaultEvmAddress, defaultLogTopics),
          32,
        ),
      ).to.eq(true, 'with fromBlock, toBlock, address, topics');
      expect(
        RelayAssertions.validateHash(
          await filterService.newFilter(numberHex, 'latest', requestDetails, defaultEvmAddress, defaultLogTopics),
          32,
        ),
      ).to.eq(true, 'with all parameters');
    });

    it('Creates a filter with type=log', async function () {
      const filterId = await filterService.newFilter(
        numberHex,
        'latest',
        requestDetails,
        defaultEvmAddress,
        defaultLogTopics,
      );
      await validateFilterCache(filterId, constants.FILTER.TYPE.LOG, {
        fromBlock: numberHex,
        toBlock: 'latest',
        address: defaultEvmAddress,
        topics: defaultLogTopics,
      });
    });

    it('validates fromBlock and toBlock', async function () {
      // reject if fromBlock is larger than toBlock
      await RelayAssertions.assertRejection(
        predefined.INVALID_BLOCK_RANGE,
        filterService.newFilter,
        true,
        filterService,
        [blockNumberHexes[1500], blockNumberHexes[1400], requestDetails],
      );
      await RelayAssertions.assertRejection(
        predefined.INVALID_BLOCK_RANGE,
        filterService.newFilter,
        true,
        filterService,
        ['latest', blockNumberHexes[1400], requestDetails],
      );

      // reject when no fromBlock is provided
      await RelayAssertions.assertRejection(
        predefined.MISSING_FROM_BLOCK_PARAM,
        filterService.newFilter,
        true,
        filterService,
        [null, blockNumberHexes[1400], requestDetails],
      );

      // block range is valid
      expect(
        RelayAssertions.validateHash(
          await filterService.newFilter(blockNumberHexes[1400], blockNumberHexes[1500], requestDetails),
          32,
        ),
      ).to.eq(true);
      expect(
        RelayAssertions.validateHash(
          await filterService.newFilter(blockNumberHexes[1400], 'latest', requestDetails),
          32,
        ),
      ).to.eq(true);
    });
  });

  describe('eth_uninstallFilter', async function () {
    it('should return true if filter is deleted', async function () {
      const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
      await cacheService.set(
        cacheKey,
        filterObject,
        filterService.ethUninstallFilter,
        requestDetails,
        constants.FILTER.TTL,
      );

      const result = await filterService.uninstallFilter(existingFilterId, requestDetails);

      const isDeleted = !(await cacheService.getAsync(cacheKey, filterService.ethUninstallFilter, requestDetails));
      expect(result).to.eq(true);
      expect(isDeleted).to.eq(true);
    });

    it('should return false if filter does not exist, therefore is not deleted', async function () {
      const result = await filterService.uninstallFilter(nonExistingFilterId, requestDetails);
      expect(result).to.eq(false);
    });
  });

  describe('eth_newBlockFilter', async function () {
    beforeEach(() => {
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [defaultBlock] });
    });

    it('Returns a valid filterId', async function () {
      expect(RelayAssertions.validateHash(await filterService.newBlockFilter(requestDetails), 32)).to.eq(true);
    });

    it('Creates a filter with type=new_block', async function () {
      const filterId = await filterService.newBlockFilter(requestDetails);
      await validateFilterCache(filterId, constants.FILTER.TYPE.NEW_BLOCK, {
        blockAtCreation: toHex(defaultBlock.number),
      });
    });
  });

  describe('eth_getFilterLogs', async function () {
    it('should throw FILTER_NOT_FOUND for type=newBlock', async function () {
      const filterIdBlockType = await filterService.createFilter(
        constants.FILTER.TYPE.NEW_BLOCK,
        filterObject,
        requestDetails,
      );
      await RelayAssertions.assertRejection(
        predefined.FILTER_NOT_FOUND,
        filterService.getFilterLogs,
        true,
        filterService,
        [filterIdBlockType, requestDetails],
      );
    });

    it('should throw FILTER_NOT_FOUND for type=pendingTransaction', async function () {
      const filterIdBlockType = await filterService.createFilter(
        constants.FILTER.TYPE.PENDING_TRANSACTION,
        filterObject,
        requestDetails,
      );
      await RelayAssertions.assertRejection(
        predefined.FILTER_NOT_FOUND,
        filterService.getFilterLogs,
        true,
        filterService,
        [filterIdBlockType, requestDetails],
      );
    });

    it('should be able to get accurate logs with fromBlock filter', async function () {
      const filteredLogs = {
        logs: defaultLogs1.map((log) => {
          return {
            ...log,
            block_number: 2,
          };
        }),
      };
      const customBlock = {
        ...defaultBlock,
        block_number: 3,
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [customBlock] });
      restMock.onGet('blocks/1').reply(200, { ...defaultBlock, block_number: 1 });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${customBlock.timestamp.from}&timestamp=lte:${customBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);

      const filterId = await filterService.newFilter('0x1', undefined, requestDetails);

      const logs = await filterService.getFilterLogs(filterId, requestDetails);

      expect(logs).to.not.be.empty;
      logs.every((log) => expect(Number(log.blockNumber)).to.be.greaterThan(1));
    });

    it('should be able to get accurate logs with toBlock filter', async function () {
      const filteredLogs = {
        logs: defaultLogs1.map((log) => {
          return { ...log, block_number: 2 };
        }),
      };
      const customBlock = {
        ...defaultBlock,
        block_number: 3,
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [customBlock] });
      restMock.onGet('blocks/3').reply(200, customBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${customBlock.timestamp.from}&timestamp=lte:${customBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);

      const filterId = await filterService.newFilter(undefined, '0x3', requestDetails);

      const logs = await filterService.getFilterLogs(filterId, requestDetails);

      expect(logs).to.not.be.empty;
      logs.every((log) => expect(Number(log.blockNumber)).to.be.lessThan(3));
    });

    it('should be able to get accurate logs with address filter', async function () {
      const filteredLogs = {
        logs: defaultLogs1.map((log) => {
          return { ...log, address: defaultEvmAddress };
        }),
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
      restMock
        .onGet(
          `contracts/${defaultEvmAddress}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);

      const filterId = await filterService.newFilter(undefined, undefined, requestDetails, defaultEvmAddress);

      const logs = await filterService.getFilterLogs(filterId, requestDetails);

      expect(logs).to.not.be.empty;
      logs.every((log) => expect(log.address).to.equal(defaultEvmAddress));
    });

    it('should be able to get accurate logs with topics', async function () {
      const customTopic = ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'];

      const filteredLogs = {
        logs: defaultLogs1.map((log) => {
          return {
            ...log,
            topics: customTopic,
          };
        }),
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&topic0=${customTopic[0]}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);

      const filterId = await filterService.newFilter(undefined, undefined, requestDetails, undefined, customTopic);

      const logs = await filterService.getFilterLogs(filterId, requestDetails);

      expect(logs).to.not.be.empty;
      logs.every((log) => expect(log.topics).to.deep.equal(customTopic));
    });
  });

  describe('eth_getFilterChanges', async function () {
    it('should throw error for non-existing filters', async function () {
      await RelayAssertions.assertRejection(
        predefined.FILTER_NOT_FOUND,
        filterService.getFilterChanges,
        true,
        filterService,
        [nonExistingFilterId, requestDetails],
      );
    });

    it('should throw error for invalid filter type', async function () {
      await RelayAssertions.assertRejection(
        predefined.FILTER_NOT_FOUND,
        filterService.getFilterChanges,
        true,
        filterService,
        [nonExistingFilterId, requestDetails],
      );
    });

    it('should return the hashes of latest blocks', async function () {
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [{ ...defaultBlock, number: defaultBlock.number + 4 }] });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}?block.number=gt:${defaultBlock.number}&order=asc`).reply(200, {
        blocks: [
          { ...defaultBlock, number: defaultBlock.number + 1, hash: '0x1' },
          { ...defaultBlock, number: defaultBlock.number + 2, hash: '0x2' },
          { ...defaultBlock, number: defaultBlock.number + 3, hash: '0x3' },
        ],
      });
      restMock
        .onGet(`${BLOCK_BY_NUMBER_QUERY}?block.number=gt:${defaultBlock.number + 3}&order=asc`)
        .reply(200, { blocks: [] });

      const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
      await cacheService.set(
        cacheKey,
        blockFilterObject,
        filterService.ethGetFilterChanges,
        requestDetails,
        constants.FILTER.TTL,
      );

      const result = await filterService.getFilterChanges(existingFilterId, requestDetails);

      expect(result).to.exist;
      expect(result.length).to.eq(3, 'returns correct number of blocks');
      expect(result[0]).to.eq('0x1', 'result is in ascending order');
      expect(result[1]).to.eq('0x2');
      expect(result[2]).to.eq('0x3');

      const secondResult = await filterService.getFilterChanges(existingFilterId, requestDetails);
      expect(secondResult).to.exist;
      expect(secondResult.length).to.eq(0, 'second call returns no block hashes');
    });

    it('should return no blocks if the second request is for the same block', async function () {
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [{ ...defaultBlock, number: defaultBlock.number + 3 }] });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}?block.number=gt:${defaultBlock.number}&order=asc`).reply(200, {
        blocks: [{ ...defaultBlock, number: defaultBlock.number + 1, hash: '0x1' }],
      });

      restMock
        .onGet(`${BLOCK_BY_NUMBER_QUERY}?block.number=gt:${defaultBlock.number + 1}&order=asc`)
        .reply(200, { blocks: [] });

      const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
      await cacheService.set(
        cacheKey,
        blockFilterObject,
        filterService.ethGetFilterChanges,
        requestDetails,
        constants.FILTER.TTL,
      );

      const resultCurrentBlock = await filterService.getFilterChanges(existingFilterId, requestDetails);
      expect(resultCurrentBlock).to.not.be.empty;

      const resultSameBlock = await filterService.getFilterChanges(existingFilterId, requestDetails);
      expect(resultSameBlock).to.be.empty;
    });

    it('should return valid list of logs', async function () {
      const filteredLogs = {
        logs: defaultLogs1.map((log) => {
          return {
            ...log,
            block_number: 9,
          };
        }),
      };
      const customBlock = {
        ...defaultBlock,
        block_number: 9,
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [customBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${customBlock.timestamp.from}&timestamp=lte:${customBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, filteredLogs);
      restMock.onGet('blocks/1').reply(200, { ...defaultBlock, block_number: 1 });

      const filterId = await filterService.newFilter('0x1', undefined, requestDetails);

      const logs = await filterService.getFilterChanges(filterId, requestDetails);
      expect(logs).to.not.be.empty;
      logs.forEach((log) => expect(Number(log.blockNumber)).to.equal(9));
    });

    it('should return an empty set if there are no logs', async function () {
      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock
        .onGet(
          `contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`,
        )
        .reply(200, []);
      restMock.onGet('blocks/1').reply(200, { ...defaultBlock, block_number: 1 });

      const filterId = await filterService.newFilter('0x1', undefined, requestDetails);
      const logs = await filterService.getFilterChanges(filterId, requestDetails);
      expect(logs).to.be.empty;
    });

    it('should return an empty set if there are no block hashes (e.g. 2 requests within 2 seconds)', async function () {
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, { blocks: [{ ...defaultBlock, number: defaultBlock.number }] });
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}?block.number=gt:${defaultBlock.number}&order=asc`).reply(200, {
        blocks: [],
      });

      const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
      await cacheService.set(
        cacheKey,
        blockFilterObject,
        filterService.ethGetFilterChanges,
        requestDetails,
        constants.FILTER.TTL,
      );

      const blocks = await filterService.getFilterChanges(existingFilterId, requestDetails);
      expect(blocks).to.be.empty;
    });
  });
});
