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

import { pino } from 'pino';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { RedisCache } from '../../../src/lib/clients';
import { Registry } from 'prom-client';
import { RedisInMemoryServer } from '../../redisInMemoryServer';

const logger = pino();
const registry = new Registry();
let redisCache: RedisCache;
let redisInMemoryServer: RedisInMemoryServer;

const callingMethod = 'RedisCacheTest';

describe('RedisCache Test Suite', async function () {
  this.timeout(10000);
  const mock = sinon.createSandbox();

  this.beforeAll(async () => {
    redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 6379);
    await redisInMemoryServer.start();
    redisCache = new RedisCache(logger.child({ name: `cache` }), registry);
  });

  this.afterEach(() => {
    mock.restore();
  });

  this.afterAll(async () => {
    await redisCache.disconnect();
    await redisInMemoryServer.stop();
  });

  describe('Get and Set Test Suite', async function () {
    it('should get null on empty cache', async function () {
      const cacheValue = await redisCache.get('test', callingMethod);
      expect(cacheValue).to.be.null;
    });

    it('should get valid int cache', async function () {
      const key = 'int';
      const value = 1;

      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });

    it('should get valid boolean cache', async function () {
      const key = 'boolean';
      const value = false;

      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });

    it('should get valid array cache', async function () {
      const key = 'array';
      const value = ['false'];

      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).deep.equal(value);
    });

    it('should get valid object cache', async function () {
      const key = 'object';
      const value = { result: true };

      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).deep.equal(value);
    });

    it('should be able to set cache with TTL less than 1000 milliseconds', async () => {
      const key = 'int';
      const value = 1;
      const ttl = 500;

      await redisCache.set(key, value, callingMethod, ttl);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);

      await new Promise((resolve) => setTimeout(resolve, ttl));

      const expiredValue = await redisCache.get(key, callingMethod);
      expect(expiredValue).to.be.null;
    });

    it('should be able to set cache with TTL greater than 1000 milliseconds', async () => {
      const key = 'int';
      const value = 1;
      const ttl = 1500;

      await redisCache.set(key, value, callingMethod, ttl);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);

      await new Promise((resolve) => setTimeout(resolve, ttl));

      const expiredValue = await redisCache.get(key, callingMethod);
      expect(expiredValue).to.be.null;
    });
  });

  describe('MultiSet Test Suite', async function () {
    it('should set multiple key-value pairs in cache', async function () {
      const keyValuePairs = {
        int: 1,
        string: 'test',
        boolean: false,
        array: ['false'],
        object: { result: true },
      };

      await redisCache.multiSet(keyValuePairs, callingMethod);

      for (const key in keyValuePairs) {
        const cachedValue = await redisCache.get(key, callingMethod);
        expect(cachedValue).deep.equal(keyValuePairs[key]);
      }
    });
  });

  describe('PipelineSet Test Suite', async function () {
    it('should set multiple key-value pairs in cache', async function () {
      const keyValuePairs = {
        int: 1,
        string: 'test',
        boolean: false,
        array: ['false'],
        object: { result: true },
      };

      await redisCache.pipelineSet(keyValuePairs, callingMethod);

      for (const key in keyValuePairs) {
        const cachedValue = await redisCache.get(key, callingMethod);
        expect(cachedValue).deep.equal(keyValuePairs[key]);
      }
    });

    it('should set multiple key-value pairs in cache with TTL', async function () {
      const keyValuePairs = {
        int: 1,
        string: 'test',
        boolean: false,
        array: ['false'],
        object: { result: true },
      };

      await redisCache.pipelineSet(keyValuePairs, callingMethod, 500);

      for (const key in keyValuePairs) {
        const cachedValue = await redisCache.get(key, callingMethod);
        expect(cachedValue).deep.equal(keyValuePairs[key]);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      for (const key in keyValuePairs) {
        const expiredValue = await redisCache.get(key, callingMethod);
        expect(expiredValue).to.be.null;
      }
    });
  });

  describe('Delete Test Suite', async function () {
    it('should delete int cache', async function () {
      const key = 'int';
      const value = 1;

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it('should delete boolean cache', async function () {
      const key = 'boolean';
      const value = false;

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it('should delete array cache', async function () {
      const key = 'array';
      const value = ['false'];

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it('should delete object cache', async function () {
      const key = 'object';
      const value = { result: true };

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });
  });

  describe('Increment Test Suite', async function () {
    it('should increment a non-existing key', async function () {
      const key = 'non-existing';
      const amount = 1;

      const newValue = await redisCache.incrBy(key, amount, callingMethod);
      expect(newValue).equal(amount);
    });

    it('should increment an existing key', async function () {
      const key = 'existing';
      const initialValue = 5;
      const amount = 3;

      await redisCache.set(key, initialValue, callingMethod);
      const newValue = await redisCache.incrBy(key, amount, callingMethod);
      expect(newValue).equal(initialValue + amount);
    });

    it('should increment with a negative value', async function () {
      const key = 'negative-increment';
      const initialValue = 5;
      const amount = -2;

      await redisCache.set(key, initialValue, callingMethod);
      const newValue = await redisCache.incrBy(key, amount, callingMethod);
      expect(newValue).equal(initialValue + amount);
    });
  });

  describe('RPUSH Test Suite', async function () {
    it('should push to a non-existing list', async function () {
      const key = 'non-existing-list';
      const value = 'item1';

      const length = await redisCache.rPush(key, value, callingMethod);
      expect(length).equal(1);

      const list = await redisCache.lRange(key, 0, -1, callingMethod);
      expect(list).deep.equal([value]);
    });

    it('should push to an existing list', async function () {
      const key = 'existing-list';
      const initialList = ['item1'];
      const newValue = 'item2';

      await redisCache.rPush(key, initialList[0], callingMethod);
      const length = await redisCache.rPush(key, newValue, callingMethod);
      expect(length).equal(2);

      const list = await redisCache.lRange(key, 0, -1, callingMethod);
      expect(list).deep.equal([...initialList, newValue]);
    });
  });

  describe('LRANGE Test Suite', async function () {
    it('should retrieve a range from a non-existing list', async function () {
      const key = 'non-existing-range';
      const start = 0;
      const end = 1;

      const list = await redisCache.lRange(key, start, end, callingMethod);
      expect(list).deep.equal([]);
    });

    it('should retrieve a range from an existing list', async function () {
      const key = 'existing-range';
      const list = ['item1', 'item2', 'item3'];

      for (const item of list) {
        await redisCache.rPush(key, item, callingMethod);
      }

      const range = await redisCache.lRange(key, 0, 1, callingMethod);
      expect(range).deep.equal(['item1', 'item2']);
    });
  });
});
