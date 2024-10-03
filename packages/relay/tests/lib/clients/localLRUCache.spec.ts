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
import { configServiceTestHelper } from '../../../../config-service/tests/configServiceTestHelper';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Registry } from 'prom-client';
import pino from 'pino';
import { LocalLRUCache } from '../../../src/lib/clients';
import constants from '../../../src/lib/constants';
import { RequestDetails } from '../../../src/lib/types';

const logger = pino();
const registry = new Registry();
let localLRUCache: LocalLRUCache;

const callingMethod = 'localLRUCacheTest';

chai.use(chaiAsPromised);

describe('LocalLRUCache Test Suite', async function () {
  this.timeout(10000);

  const requestDetails = new RequestDetails({ requestId: 'localLRUCacheTest', ipAddress: '0.0.0.0' });

  this.beforeAll(() => {
    localLRUCache = new LocalLRUCache(logger.child({ name: `cache` }), registry);
  });

  this.beforeEach(() => {
    localLRUCache.clear();
  });

  describe('verify simple cache', async function () {
    it('get on empty cache return null', async function () {
      const cacheValue = await localLRUCache.get('test', callingMethod, requestDetails);
      expect(cacheValue).to.be.null;
    });

    it('get on valid string cache returns non null', async function () {
      const key = 'key';
      const expectedValue = 'value';
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValue = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.equal(expectedValue);
    });

    it('get on valid int cache returns non null', async function () {
      const key = 'key';
      const expectedValue = 1;
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValue = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.equal(expectedValue);
    });

    it('get on valid false boolean cache returns non null', async function () {
      const key = 'key';
      const expectedValue = false;
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValue = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.equal(expectedValue);
    });

    it('get on valid true boolean cache returns non null', async function () {
      const key = 'key';
      const expectedValue = true;
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValue = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.equal(expectedValue);
    });

    it('get on valid object cache returns non null', async function () {
      const key = 'key';
      const expectedValue = { key: 'value' };
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValue = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.equal(expectedValue);
    });

    it('delete a valid object', async function () {
      const key = 'key';
      const expectedValue = { key: 'value' };
      await localLRUCache.set(key, expectedValue, callingMethod, requestDetails);
      const cacheValueBeforeDelete = await localLRUCache.get(key, callingMethod, requestDetails);
      await localLRUCache.delete(key, callingMethod, requestDetails);

      const cacheValueAfterDelete = await localLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValueBeforeDelete).to.not.be.null;
      expect(cacheValueAfterDelete).to.be.null;
    });
  });

  describe('verify cache management', async function () {
    beforeEach(() => {
      configServiceTestHelper.dynamicOverride('CACHE_MAX', constants.CACHE_MAX.toString());
    });

    it('verify cache size', async function () {
      const cacheMaxSize = 2;
      configServiceTestHelper.dynamicOverride('CACHE_MAX', `${cacheMaxSize}`);
      const customLocalLRUCache = new LocalLRUCache(logger.child({ name: `cache` }), registry);
      const keyValuePairs = {
        key1: 'value1',
        key2: 'value2',
        key3: 'value3',
      };

      Object.entries(keyValuePairs).forEach(([key, value]) => {
        customLocalLRUCache.set(key, value, callingMethod, requestDetails);
      });

      const key1 = await customLocalLRUCache.get('key1', callingMethod, requestDetails);
      const key2 = await customLocalLRUCache.get('key2', callingMethod, requestDetails);
      const key3 = await customLocalLRUCache.get('key3', callingMethod, requestDetails);
      // expect cache to have capped at max size
      expect(key1).to.be.null; // key1 should have been evicted
      expect(key2).to.be.equal(keyValuePairs.key2);
      expect(key3).to.be.equal(keyValuePairs.key3);
    });

    it('verify cache LRU nature', async function () {
      const customLocalLRUCache = new LocalLRUCache(logger.child({ name: `cache` }), registry);
      const key = 'key';
      let valueCount = 0; // keep track of values sets
      await customLocalLRUCache.set(key, ++valueCount, callingMethod, requestDetails);
      await customLocalLRUCache.set(key, ++valueCount, callingMethod, requestDetails);
      await customLocalLRUCache.set(key, ++valueCount, callingMethod, requestDetails);
      const cacheValue = await customLocalLRUCache.get(key, callingMethod, requestDetails);
      // expect cache to have the latest value for key
      expect(cacheValue).to.be.equal(valueCount);
    });

    it('verify cache ttl nature', async function () {
      const customLocalLRUCache = new LocalLRUCache(logger.child({ name: `cache` }), registry);
      const key = 'key';
      await customLocalLRUCache.set(key, 'value', callingMethod, requestDetails, 100); // set ttl to 1 ms
      await new Promise((r) => setTimeout(r, 500)); // wait for ttl to expire
      const cacheValue = await customLocalLRUCache.get(key, callingMethod, requestDetails);
      expect(cacheValue).to.be.null;
    });
  });

  describe('KEYS Test Suite', async function () {
    it('should retrieve keys matching a glob-style pattern with *', async function () {
      const keys = ['hello', 'hallo', 'hxllo'];
      for (let i = 0; i < keys.length; i++) {
        await localLRUCache.set(keys[i], `value${i}`, callingMethod, requestDetails);
      }
      await expect(localLRUCache.keys('h*llo', callingMethod, requestDetails)).to.eventually.have.members(keys);
    });

    it('should retrieve keys matching a glob-style pattern with ?', async function () {
      const keys = ['hello', 'hallo', 'hxllo'];
      for (let i = 0; i < keys.length; i++) {
        await localLRUCache.set(keys[i], `value${i}`, callingMethod, requestDetails);
      }
      await expect(localLRUCache.keys('h?llo', callingMethod, requestDetails)).to.eventually.have.members(keys);
    });

    it('should retrieve keys matching a glob-style pattern with []', async function () {
      const key1 = 'hello';
      const key2 = 'hallo';
      const pattern = 'h[ae]llo';

      await localLRUCache.set(key1, 'value1', callingMethod, requestDetails);
      await localLRUCache.set(key2, 'value2', callingMethod, requestDetails);

      const keys = await localLRUCache.keys(pattern, callingMethod, requestDetails);
      expect(keys).to.include.members([key1, key2]);
    });

    it('should retrieve keys matching a glob-style pattern with [^]', async function () {
      const key1 = 'hallo';
      const key2 = 'hbllo';
      const pattern = 'h[^e]llo';

      await localLRUCache.set(key1, 'value1', callingMethod, requestDetails);
      await localLRUCache.set(key2, 'value2', callingMethod, requestDetails);

      const keys = await localLRUCache.keys(pattern, callingMethod, requestDetails);
      expect(keys).to.include.members([key1, key2]);
    });

    it('should retrieve keys matching a glob-style pattern with [a-b]', async function () {
      const key1 = 'hallo';
      const key2 = 'hbllo';
      const pattern = 'h[a-b]llo';

      await localLRUCache.set(key1, 'value1', callingMethod, requestDetails);
      await localLRUCache.set(key2, 'value2', callingMethod, requestDetails);

      const keys = await localLRUCache.keys(pattern, callingMethod, requestDetails);
      expect(keys).to.include.members([key1, key2]);
    });

    it('should retrieve keys matching a pattern with escaped special characters', async function () {
      const keys = ['h*llo', 'h?llo', 'h[llo', 'h]llo'];
      for (let i = 0; i < keys.length; i++) {
        await localLRUCache.set(keys[i], `value${i}`, callingMethod, requestDetails);
      }
      for (const key of keys) {
        await expect(
          localLRUCache.keys(key.replace(/([*?[\]])/g, '\\$1'), callingMethod, requestDetails),
        ).eventually.has.members([key]);
      }
    });

    it('should retrieve all keys with * pattern', async function () {
      const key1 = 'firstname';
      const key2 = 'lastname';
      const key3 = 'age';
      const pattern = '*';

      await localLRUCache.set(key1, 'Jack', callingMethod, requestDetails);
      await localLRUCache.set(key2, 'Stuntman', callingMethod, requestDetails);
      await localLRUCache.set(key3, '35', callingMethod, requestDetails);

      const keys = await localLRUCache.keys(pattern, callingMethod, requestDetails);
      expect(keys).to.include.members([key1, key2, key3]);
    });
  });
});
