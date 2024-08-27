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
import { pino } from 'pino';
import { Registry } from 'prom-client';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { RedisInMemoryServer } from '../../../redisInMemoryServer';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
const logger = pino();
const registry = new Registry();
let cacheService: CacheService;

const callingMethod = 'CacheServiceTest';

chai.use(chaiAsPromised);

describe('CacheService Test Suite', async function () {
  this.timeout(10000);

  describe('Internal Cache Test Suite', async function () {
    this.beforeAll(() => {
      process.env.REDIS_ENABLED = 'false';
      cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
    });

    this.beforeEach(() => {
      cacheService.clear();
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

    describe('disconnectRedisClient', async function () {
      it('should not throw error if shared cache is not enabled', async function () {
        cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
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
    let redisInMemoryServer: RedisInMemoryServer;

    this.beforeAll(async () => {
      redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 6381);
      await redisInMemoryServer.start();

      process.env.REDIS_ENABLED = 'true';
      process.env.REDIS_URL = 'redis://127.0.0.1:6381';
      process.env.TEST = 'false';
      process.env.MULTI_SET = 'true';
      cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
    });

    this.afterAll(async () => {
      await redisInMemoryServer.stop();
      process.env.TEST = 'true';
      await cacheService.disconnectRedisClient();
    });

    this.beforeEach(async () => {
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
    });

    describe('rPush', async function () {
      it('should push value to shared cache', async function () {
        const key = 'list';
        const value = 'item';

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
    });

    describe('disconnectRedisClient', async function () {
      it('should disconnect Redis client if shared cache is enabled', async function () {
        const disconnectSpy = sinon.spy(cacheService['sharedCache'], <any>'disconnect');
        await cacheService.disconnectRedisClient();
        expect(disconnectSpy.calledOnce).to.be.true;
      });
    });
  });
});
