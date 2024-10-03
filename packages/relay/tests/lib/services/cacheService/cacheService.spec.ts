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
import { configServiceTestHelper } from '../../../../../config-service/tests/configServiceTestHelper';
import { pino } from 'pino';
import { Registry } from 'prom-client';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { useInMemoryRedisServer } from '../../../helpers';

const logger = pino();
const registry = new Registry();
let cacheService: CacheService;

const callingMethod = 'CacheServiceTest';

chai.use(chaiAsPromised);

describe('CacheService Test Suite', async function () {
  this.timeout(10000);

  const describeKeysTestSuite = () => {
    describe('keys', async function () {
      it('should retrieve all keys', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        const keys = await cacheService.keys('*', callingMethod);
        expect(keys).to.have.members(Object.keys(entries));
      });

      it('should retrieve keys matching pattern', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        const keys = await cacheService.keys('key*', callingMethod);
        expect(keys).to.have.members(Object.keys(entries));
      });

      it('should retrieve keys matching pattern with ?', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        const keys = await cacheService.keys('key?', callingMethod);
        expect(keys).to.have.members(Object.keys(entries));
      });

      it('should retrieve keys matching pattern with []', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        const keys = await cacheService.keys('key[1-2]', callingMethod);
        expect(keys).to.have.members(['key1', 'key2']);
      });

      it('should retrieve keys matching pattern with [^]', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        // [^3] should match all keys except key3
        const keys = await cacheService.keys('key[^3]', callingMethod);
        expect(keys).to.have.members(['key1', 'key2']);
      });

      it('should retrieve keys matching pattern with [a-b]', async function () {
        const entries: Record<string, any> = {};
        entries['keya'] = 'value1';
        entries['keyb'] = 'value2';
        entries['keyc'] = 'value3';

        await cacheService.multiSet(entries, callingMethod);

        const keys = await cacheService.keys('key[a-c]', callingMethod);
        expect(keys).to.have.members(Object.keys(entries));
      });

      it('should escape special characters in the pattern', async function () {
        const key = 'h*llo';
        const value = 'value';

        await cacheService.set(key, value, callingMethod);

        const keys = await cacheService.keys('h*llo', callingMethod);
        expect(keys).to.have.members([key]);
      });

      it('should retrieve keys from internal cache in case of Redis error', async function () {
        const entries: Record<string, any> = {};
        entries['key1'] = 'value1';
        entries['key2'] = 'value2';
        entries['key3'] = 'value3';

        await cacheService.disconnectRedisClient();
        await cacheService.multiSet(entries, callingMethod);
        const keys = await cacheService.keys('*', callingMethod);
        expect(keys).to.have.members(Object.keys(entries));
      });
    });
  };

  describe('Internal Cache Test Suite', async function () {
    this.beforeAll(() => {
      configServiceTestHelper.dynamicOverride('REDIS_ENABLED', false);
      cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
    });

    this.afterEach(async () => {
      await cacheService.clear();
    });

    it('should be able to set and get from internal cache', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);
      const cachedValue = await cacheService.getAsync(key, callingMethod);

      expect(cachedValue).eq(value);
    });

    it('should be able to set and delete from internal cache', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);
      await cacheService.delete(key, callingMethod);
      const cachedValue = await cacheService.getAsync(key, callingMethod);

      expect(cachedValue).to.be.null;
    });

    it('should be able to get from internal cache when calling getAsync', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);
      const cachedValue = await cacheService.getAsync(key, callingMethod);

      expect(cachedValue).eq(value);
    });

    it('should be able to set using multiSet and get them separately', async function () {
      const entries: Record<string, any> = {};
      entries['key1'] = 'value1';
      entries['key2'] = 'value2';
      entries['key3'] = 'value3';

      await cacheService.multiSet(entries, callingMethod);

      for (const [key, value] of Object.entries(entries)) {
        const valueFromCache = await cacheService.getAsync(key, callingMethod);
        expect(valueFromCache).eq(value);
      }
    });

    describe('incrBy', async function () {
      it('should increment value in internal cache', async function () {
        const key = 'counter';
        const amount = 5;

        await cacheService.set(key, 10, callingMethod);
        const newValue = await cacheService.incrBy(key, amount, callingMethod);

        expect(newValue).to.equal(15);
      });
    });

    describe('rPush', async function () {
      it('should push value to internal cache', async function () {
        const key = 'list';
        const value = 'item';

        await cacheService.rPush(key, value, callingMethod);
        const cachedValue = await cacheService.getAsync(key, callingMethod);

        expect(cachedValue).to.deep.equal([value]);
      });
    });

    describe('lRange', async function () {
      it('should retrieve range from internal cache', async function () {
        const key = 'list';
        const values = ['item1', 'item2', 'item3'];

        await cacheService.set(key, values, callingMethod);
        const range = await cacheService.lRange(key, 0, 1, callingMethod);

        expect(range).to.deep.equal(['item1', 'item2']);
      });

      it('should retrieve range with negative index from internal cache', async function () {
        const key = 'list';
        const values = ['item1', 'item2', 'item3'];

        await cacheService.set(key, values, callingMethod);
        const range = await cacheService.lRange(key, -2, -1, callingMethod);

        expect(range).to.deep.equal(['item2', 'item3']);
      });
    });

    describeKeysTestSuite();

    describe('isRedisClientConnected', async function () {
      it('should return false if shared cache is not enabled', async function () {
        expect(await cacheService.isRedisClientConnected()).to.be.false;
      });
    });

    describe('getNumberOfRedisConnections', async function () {
      it('should return 0 if shared cache is not enabled', async function () {
        expect(await cacheService.getNumberOfRedisConnections()).to.equal(0);
      });
    });

    describe('connectRedisClient', async function () {
      it('should not throw error if shared cache is not enabled', async function () {
        await expect(cacheService.connectRedisClient()).to.not.be.rejected;
      });
    });

    describe('disconnectRedisClient', async function () {
      it('should not throw error if shared cache is not enabled', async function () {
        await expect(cacheService.disconnectRedisClient()).to.not.be.rejected;
      });
    });
  });

  describe('Shared Cache Test Suite', async function () {
    const multiSetEntries: Record<string, string> = {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    };

    useInMemoryRedisServer(logger, 6381);

    let multiSet: string | undefined;

    this.beforeAll(async () => {
      multiSet = ConfigService.get('MULTI_SET');
      configServiceTestHelper.dynamicOverride('MULTI_SET', true);
      cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
    });

    this.afterAll(async () => {
      await cacheService.disconnectRedisClient();
      configServiceTestHelper.dynamicOverride('MULTI_SET', multiSet);
    });

    this.beforeEach(async () => {
      await cacheService.connectRedisClient();
    });

    this.afterEach(async () => {
      await cacheService.clear();
    });

    it('should be able to set and get from shared cache', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);

      const cachedValue = await cacheService.getAsync(key, callingMethod);
      expect(cachedValue).eq(value);
    });

    it('should be able to set and delete from shared cache', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);

      await cacheService.delete(key, callingMethod);

      const cachedValue = await cacheService.getAsync(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it('should be able to get from shared cache with fallback to internal cache', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.set(key, value, callingMethod);

      const cachedValue = await cacheService.getAsync(key, callingMethod);
      expect(cachedValue).eq(value);
    });

    it('should be able to set using multiSet and get them separately using internal cache', async function () {
      await cacheService.multiSet(multiSetEntries, callingMethod);

      for (const [key, value] of Object.entries(multiSetEntries)) {
        const valueFromCache = await cacheService.getAsync(key, callingMethod);
        expect(valueFromCache).eq(value);
      }
    });

    it('should be able to set using pipelineSet and get them separately using internal cache', async function () {
      // @ts-ignore
      cacheService['shouldMultiSet'] = false;

      await cacheService.multiSet(multiSetEntries, callingMethod);

      for (const [key, value] of Object.entries(multiSetEntries)) {
        const valueFromCache = await cacheService.getAsync(key, callingMethod);
        expect(valueFromCache).eq(value);
      }
    });

    it('should be able to getAsync from internal cache in case of Redis error', async function () {
      const key = 'string';
      await cacheService.disconnectRedisClient();

      const cachedValue = await cacheService.getAsync(key, callingMethod);
      expect(cachedValue).eq(null);
    });

    it('should be able to set to internal cache in case of Redis error', async function () {
      const key = 'string';
      const value = 'value';

      await cacheService.disconnectRedisClient();

      await expect(cacheService.set(key, value, callingMethod)).to.eventually.not.be.rejected;

      const internalCacheRes = await cacheService.getAsync(key, callingMethod);
      expect(internalCacheRes).to.eq(value);
    });

    it('should be able to multiSet to internal cache in case of Redis error', async function () {
      await cacheService.disconnectRedisClient();

      await expect(cacheService.multiSet(multiSetEntries, callingMethod)).to.eventually.not.be.rejected;

      for (const [key, value] of Object.entries(multiSetEntries)) {
        const internalCacheRes = await cacheService.getAsync(key, callingMethod);
        expect(internalCacheRes).to.eq(value);
      }
    });

    it('should be able to pipelineSet to internal cache in case of Redis error', async function () {
      // @ts-ignore
      cacheService['shouldMultiSet'] = false;

      await cacheService.disconnectRedisClient();

      await expect(cacheService.multiSet(multiSetEntries, callingMethod)).to.eventually.not.be.rejected;

      for (const [key, value] of Object.entries(multiSetEntries)) {
        const internalCacheRes = await cacheService.getAsync(key, callingMethod);
        expect(internalCacheRes).to.eq(value);
      }
    });

    it('should be able to clear from internal cache in case of Redis error', async function () {
      await cacheService.disconnectRedisClient();

      await expect(cacheService.clear()).to.eventually.not.be.rejected;
    });

    it('should be able to delete from internal cache in case of Redis error', async function () {
      const key = 'string';
      await cacheService.disconnectRedisClient();

      await expect(cacheService.delete(key, callingMethod)).to.eventually.not.be.rejected;
    });

    it('should be able to set to shared cache', async function () {
      const key = 'string';
      const value = 'value';

      await expect(cacheService.set(key, value, callingMethod)).to.eventually.not.be.rejected;
    });

    it('should be able to multiset to shared cache', async function () {
      const items: Record<string, any> = {};
      items['key1'] = 'value1';
      items['key2'] = 'value2';

      await expect(cacheService.multiSet(items, callingMethod)).to.eventually.not.be.rejected;
    });

    it('should be able to delete from shared cache', async function () {
      const key = 'string';

      await expect(cacheService.delete(key, callingMethod)).to.eventually.not.be.rejected;
    });

    describe('incrBy', async function () {
      it('should increment value in internal cache', async function () {
        const key = 'counter';
        const amount = 5;

        await cacheService.set(key, 10, callingMethod);
        const newValue = await cacheService.incrBy(key, amount, callingMethod);

        expect(newValue).to.equal(15);
      });

      it('should increment value in shared cache', async function () {
        const key = 'counter';
        const amount = 5;

        await cacheService.set(key, 10, callingMethod);
        const newValue = await cacheService.incrBy(key, amount, callingMethod);

        expect(newValue).to.equal(15);
      });

      it('should increment value in internal cache in case of Redis error', async function () {
        const key = 'counter';
        const amount = 5;

        await cacheService.disconnectRedisClient();

        const newValue = await cacheService.incrBy(key, amount, callingMethod);

        expect(newValue).to.equal(5);
      });
    });

    describe('rPush', async function () {
      it('should push value to shared cache', async function () {
        const key = 'list';
        const value = 'item';

        await cacheService.rPush(key, value, callingMethod);
        const cachedValue = await cacheService.lRange(key, 0, -1, callingMethod);

        expect(cachedValue).to.deep.equal([value]);
      });

      it('should push value to internal cache in case of Redis error', async function () {
        const key = 'list';
        const value = 'item';

        await cacheService.disconnectRedisClient();

        await cacheService.rPush(key, value, callingMethod);
        const cachedValue = await cacheService.lRange(key, 0, -1, callingMethod);

        expect(cachedValue).to.deep.equal([value]);
      });
    });

    describe('lRange', async function () {
      it('should retrieve range from shared cache', async function () {
        const key = 'list';
        const values = ['item1', 'item2', 'item3'];
        for (const item of values) {
          await cacheService.rPush(key, item, callingMethod);
        }

        const range = await cacheService.lRange(key, 0, 1, callingMethod);

        expect(range).to.deep.equal(['item1', 'item2']);
      });

      it('should retrieve range with negative index from shared cache', async function () {
        const key = 'list';
        const values = ['item1', 'item2', 'item3'];
        for (const item of values) {
          await cacheService.rPush(key, item, callingMethod);
        }

        const range = await cacheService.lRange(key, -2, -1, callingMethod);

        expect(range).to.deep.equal(['item2', 'item3']);
      });

      it('should retrieve range from internal cache in case of Redis error', async function () {
        await cacheService.disconnectRedisClient();

        const key = 'list';
        const values = ['item1', 'item2', 'item3'];
        for (const item of values) {
          await cacheService.rPush(key, item, callingMethod);
        }

        const range = await cacheService.lRange(key, 0, 1, callingMethod);

        expect(range).to.deep.equal(['item1', 'item2']);
      });
    });

    describeKeysTestSuite();

    describe('isRedisClientConnected', async function () {
      it('should return true if shared cache is enabled', async function () {
        expect(await cacheService.isRedisClientConnected()).to.be.true;
      });

      it('should return false if shared cache is enabled and client is disconnected', async function () {
        await cacheService.disconnectRedisClient();
        expect(await cacheService.isRedisClientConnected()).to.be.false;
      });

      it('should return true if shared cache is enabled and client is reconnected', async function () {
        await cacheService.disconnectRedisClient();
        await cacheService.connectRedisClient();
        expect(await cacheService.isRedisClientConnected()).to.be.true;
      });
    });

    describe('getNumberOfRedisConnections', async function () {
      it('should return 1 if shared cache is enabled', async function () {
        expect(await cacheService.getNumberOfRedisConnections()).to.equal(1);
      });

      it('should return 0 if shared cache is enabled and client is disconnected', async function () {
        await cacheService.disconnectRedisClient();
        expect(await cacheService.getNumberOfRedisConnections()).to.equal(0);
      });

      it('should return 1 if shared cache is enabled and client is reconnected', async function () {
        await cacheService.disconnectRedisClient();
        await cacheService.connectRedisClient();
        expect(await cacheService.getNumberOfRedisConnections()).to.equal(1);
      });
    });

    describe('connectRedisClient', async function () {
      it('should connect Redis client if shared cache is enabled', async function () {
        await cacheService.disconnectRedisClient();
        await cacheService.connectRedisClient();
        expect(await cacheService.isRedisClientConnected()).to.be.true;
      });

      it('should not throw error if Redis client is already connected', async function () {
        await cacheService.connectRedisClient();
        await expect(cacheService.connectRedisClient()).to.not.be.rejected;
      });
    });

    describe('disconnectRedisClient', async function () {
      it('should disconnect Redis client if shared cache is enabled', async function () {
        const disconnectSpy = sinon.spy(cacheService['sharedCache'], <any>'disconnect');
        await cacheService.disconnectRedisClient();
        expect(disconnectSpy.calledOnce).to.be.true;
      });

      it('should not throw error if Redis client is already disconnected', async function () {
        await cacheService.disconnectRedisClient();
        await expect(cacheService.disconnectRedisClient()).to.not.be.rejected;
      });
    });
  });
});
