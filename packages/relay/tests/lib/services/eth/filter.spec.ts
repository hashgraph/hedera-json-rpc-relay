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
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { MirrorNodeClient } from '../../../../src/lib/clients/mirrorNodeClient';
import pino from 'pino';
import constants from '../../../../src/lib/constants';
import { ClientCache } from '../../../../src/lib/clients';
import { FilterService, CommonService } from '../../../../src/lib/services/ethService';
import {defaultEvmAddress, getRequestId, toHex, defaultBlock, defaultLogTopics, defaultLogs1} from "../../../helpers";
import RelayAssertions from "../../../assertions";
import {predefined} from "../../../../src";

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let filterService: FilterService;
let clientCache: ClientCache;
let mirrorNodeCache: ClientCache;

describe('Filter API Test Suite', async function () {
  this.timeout(10000);

  const filterObject = {
    toBlock: 'latest',
  };
  const existingFilterId = '0x1112233';
  const nonExistingFilterId = '0x1112231';
  const LATEST_BLOCK_QUERY = 'blocks?limit=1&order=desc';
  const BLOCK_BY_NUMBER_QUERY = 'blocks';

  const validateFilterCache = (filterId, expectedFilterType, expectedParams = {}) => {
    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const cachedFilter = clientCache.get(cacheKey);
    expect(cachedFilter).to.exist;
    expect(cachedFilter.type).to.exist;
    expect(cachedFilter.type).to.eq(expectedFilterType);
    expect(cachedFilter.params).to.exist;
    expect(cachedFilter.params).to.deep.eq(expectedParams);
    expect(cachedFilter.lastQueried).to.be.null;
  }

  this.beforeAll(() => {
    clientCache = new ClientCache(logger.child({ name: `cache` }), registry);
    // @ts-ignore
    mirrorNodeInstance = new MirrorNodeClient(
        process.env.MIRROR_NODE_URL,
        logger.child({ name: `mirror-node` }),
        registry,
        clientCache
    );

    // @ts-ignore
    mirrorNodeCache = mirrorNodeInstance.cache;

    // @ts-ignore
    restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: 'throwException' });

    // @ts-ignore
    web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: 'throwException' });

    // @ts-ignore
    const common = new CommonService(mirrorNodeInstance, logger, clientCache);
    filterService = new FilterService(mirrorNodeInstance, logger, clientCache, common);
  });

  this.beforeEach(() => {
    // reset cache and restMock
    mirrorNodeCache.clear();
    clientCache.clear();
    restMock.reset();
  });

  this.afterEach(() => {
    restMock.resetHandlers();
  });

  describe('all methods require a filter flag', async function () {
    let ffAtStart;

    before(function () {
      ffAtStart = process.env.FILTER_API_ENABLED;
    });

    after(function () {
      process.env.FILTER_API_ENABLED = ffAtStart;
    });

    it('FILTER_API_ENABLED is not specified', async function () {
      delete process.env.FILTER_API_ENABLED;
      await RelayAssertions.assertRejection(predefined.UNSUPPORTED_METHOD, filterService.newFilter, true, filterService, []);
      await RelayAssertions.assertRejection(predefined.UNSUPPORTED_METHOD, filterService.uninstallFilter, true, filterService, []);
    });

    it('FILTER_API_ENABLED=true', async function () {
      process.env.FILTER_API_ENABLED='true';
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, {blocks: [{...defaultBlock}]});
      const filterId = await filterService.newFilter();
      expect(filterId).to.exist;
      expect(RelayAssertions.validateHash(filterId, 32)).to.eq(true, 'returns valid filterId');
      expect((await filterService.uninstallFilter(filterId))).to.eq(true, 'executes correctly');
    });

    it('FILTER_API_ENABLED=false', async function () {
      process.env.FILTER_API_ENABLED='false';
      await RelayAssertions.assertRejection(predefined.UNSUPPORTED_METHOD, filterService.newFilter, true, filterService, []);
      await RelayAssertions.assertRejection(predefined.UNSUPPORTED_METHOD, filterService.uninstallFilter, true, filterService, []);
    });
  });

  describe('eth_newFilter', async function() {
    let blockNumberHexes, numberHex;

    beforeEach(() => {
      blockNumberHexes = {
        5: toHex(5),
        1400: toHex(1400),
        1500: toHex(1500),
        2000: toHex(2000),
        2001: toHex(2001),
      };

      numberHex = blockNumberHexes[1500];

      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/5`).reply(200, {...defaultBlock, number: 5});
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/1400`).reply(200, {...defaultBlock, number: 1400});
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/1500`).reply(200, {...defaultBlock, number: 1500});
      restMock.onGet(`${BLOCK_BY_NUMBER_QUERY}/2000`).reply(200, {...defaultBlock, number: 2000});
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, {blocks: [{...defaultBlock, number: 2002}]});
    })

    it('Returns a valid filterId', async function() {
      expect(RelayAssertions.validateHash(await filterService.newFilter(), 32)).to.eq(true, 'with default param values');
      expect(RelayAssertions.validateHash(await filterService.newFilter(numberHex), 32)).to.eq(true, 'with fromBlock');
      expect(RelayAssertions.validateHash(await filterService.newFilter(numberHex, 'latest'), 32)).to.eq(true, 'with fromBlock, toBlock');
      expect(RelayAssertions.validateHash(await filterService.newFilter(numberHex, 'latest', defaultEvmAddress), 32)).to.eq(true, 'with fromBlock, toBlock, address');
      expect(RelayAssertions.validateHash(await filterService.newFilter(numberHex, 'latest', defaultEvmAddress, defaultLogTopics), 32)).to.eq(true, 'with fromBlock, toBlock, address, topics');
      expect(RelayAssertions.validateHash(await filterService.newFilter(numberHex, 'latest', defaultEvmAddress, defaultLogTopics, getRequestId()), 32)).to.eq(true, 'with all parameters');
    });

    it('Creates a filter with type=log', async function() {
      const filterId = await filterService.newFilter(numberHex, 'latest', defaultEvmAddress, defaultLogTopics, getRequestId());
      validateFilterCache(filterId, constants.FILTER.TYPE.LOG, {
        "fromBlock": numberHex,
        "toBlock": "latest",
        "address": defaultEvmAddress,
        "topics": defaultLogTopics
      });
    });

    it('validates fromBlock and toBlock', async function() {
      // fromBlock is larger than toBlock
      await RelayAssertions.assertRejection(predefined.INVALID_BLOCK_RANGE, filterService.newFilter, true, filterService, [blockNumberHexes[1500], blockNumberHexes[1400]]);
      await RelayAssertions.assertRejection(predefined.INVALID_BLOCK_RANGE, filterService.newFilter, true, filterService, ['latest', blockNumberHexes[1400]]);

      // block range is too large
      await RelayAssertions.assertRejection(predefined.RANGE_TOO_LARGE(1000), filterService.newFilter, true, filterService, [blockNumberHexes[5], blockNumberHexes[2000]]);

      // block range is valid
      expect(RelayAssertions.validateHash(await filterService.newFilter(blockNumberHexes[1400], blockNumberHexes[1500]), 32)).to.eq(true);
      expect(RelayAssertions.validateHash(await filterService.newFilter(blockNumberHexes[1400], 'latest'), 32)).to.eq(true);
    });
  });

  describe('eth_uninstallFilter', async function() {
    it('should return true if filter is deleted', async function () {
      const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
      clientCache.set(cacheKey, filterObject, filterService.ethUninstallFilter, 300000, undefined);

      const result = await filterService.uninstallFilter(existingFilterId);

      const isDeleted = clientCache.get(cacheKey, filterService.ethUninstallFilter, undefined) ? false : true;
      expect(result).to.eq(true);
      expect(isDeleted).to.eq(true);
    });

    it('should return false if filter does not exist, therefore is not deleted', async function () {
      const result = await filterService.uninstallFilter(nonExistingFilterId);

      expect(result).to.eq(false);
    });
  });

  describe('eth_newBlockFilter', async function() {
    beforeEach(() => {
      restMock.onGet(LATEST_BLOCK_QUERY).reply(200, {blocks: [defaultBlock]});
    })

    it('Returns a valid filterId', async function() {
      expect(RelayAssertions.validateHash(await filterService.newBlockFilter(), 32)).to.eq(true);
    });

    it('Creates a filter with type=new_block', async function() {
      const filterId = await filterService.newBlockFilter(getRequestId());
      validateFilterCache(filterId, constants.FILTER.TYPE.NEW_BLOCK, {
        blockAtCreation: toHex(defaultBlock.number)
      });
    });
  });

  describe('eth_getFilterLogs', async function() {
    it('should throw FILTER_NOT_FOUND for type=newBlock', async function() {
      const filterIdBlockType = await filterService.createFilter(constants.FILTER.TYPE.NEW_BLOCK, filterObject);

      await RelayAssertions.assertRejection(predefined.FILTER_NOT_FOUND, filterService.getFilterLogs, true, filterService, [filterIdBlockType]);
    });

    it('should throw FILTER_NOT_FOUND for type=pendingTransaction', async function() {
      const filterIdBlockType = await filterService.createFilter(constants.FILTER.TYPE.PENDING_TRANSACTION, filterObject);

      await RelayAssertions.assertRejection(predefined.FILTER_NOT_FOUND, filterService.getFilterLogs, true, filterService, [filterIdBlockType]);
    });

    it('should be able to get accurate logs with fromBlock filter', async function() {
      const filteredLogs = {
        logs: defaultLogs1.map(log => {
          return {
            ...log,
            block_number: 2
          };
        })
      };
      const customBlock = {
        ...defaultBlock,
        block_number: 3
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [customBlock] });
      restMock.onGet('blocks/1').reply(200, { ...defaultBlock, block_number: 1 });
      restMock.onGet(`contracts/results/logs?timestamp=gte:${customBlock.timestamp.from}&timestamp=lte:${customBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);

      const filterId = await filterService.newFilter('0x1');
      const logs = await filterService.getFilterLogs(filterId);

      expect(logs).to.not.be.empty;
      logs.every(log => expect(Number(log.blockNumber)).to.be.greaterThan(1));
    });

    it('should be able to get accurate logs with toBlock filter', async function() {
      const filteredLogs = {
        logs: defaultLogs1.map(log => {
          return { ...log, block_number: 2 };
        })
      };
      const customBlock = {
        ...defaultBlock,
        block_number: 3
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [customBlock] });
      restMock.onGet('blocks/3').reply(200, customBlock);
      restMock.onGet(`contracts/results/logs?timestamp=gte:${customBlock.timestamp.from}&timestamp=lte:${customBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);

      const filterId = await filterService.newFilter(null, '0x3');
      const logs = await filterService.getFilterLogs(filterId);

      expect(logs).to.not.be.empty;
      logs.every(log => expect(Number(log.blockNumber)).to.be.lessThan(3));
    });

    it('should be able to get accurate logs with address filter', async function() {
      const filteredLogs = {
        logs: defaultLogs1.map(log => {
          return { ...log, address: defaultEvmAddress };
        })
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/${defaultEvmAddress}/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&limit=100&order=asc`).reply(200, filteredLogs);

      const filterId = await filterService.newFilter(null, null, defaultEvmAddress);
      const logs = await filterService.getFilterLogs(filterId);

      expect(logs).to.not.be.empty;
      logs.every(log => expect(log.address).to.equal(defaultEvmAddress));
    });

    it('should be able to get accurate logs with topics', async function() {
      const customTopic = [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      ];

      const filteredLogs = {
        logs: defaultLogs1.map(log => {
          return {
            ...log,
            topics: customTopic
          };
        })
      };

      restMock.onGet('blocks?limit=1&order=desc').reply(200, { blocks: [defaultBlock] });
      restMock.onGet(`blocks/${defaultBlock.number}`).reply(200, defaultBlock);
      restMock.onGet(`contracts/results/logs?timestamp=gte:${defaultBlock.timestamp.from}&timestamp=lte:${defaultBlock.timestamp.to}&topic0=${customTopic[0]}&limit=100&order=asc`).reply(200, filteredLogs);

      const filterId = await filterService.newFilter(null, null, null, customTopic);
      const logs = await filterService.getFilterLogs(filterId);

      expect(logs).to.not.be.empty;
      logs.every(log => expect(log.topics).to.deep.equal(customTopic));
    });
  });
});
