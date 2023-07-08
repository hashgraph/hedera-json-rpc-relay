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

import { expect } from 'chai';
import { Registry } from 'prom-client';
import pino from 'pino';
import { ClientCache } from '../../../src/lib/clients';
import constants from '../../../src/lib/constants';


const logger = pino();
const registry = new Registry();
let clientCache: ClientCache;

const callingMethod = 'clientCacheTest';

describe('Simple ClientCache', async function () {
    this.timeout(10000);

    this.beforeAll(() => {
      clientCache = new ClientCache(logger.child({ name: `cache` }), registry);
    });    
    
    this.beforeEach(() => {
      clientCache.clear();
    });
    
    describe('verify simple cache', async function () {
      it('get on empty cache return null', async function () {
        const cacheValue = clientCache.get('test', callingMethod);
        expect(cacheValue).to.be.null;
      }); 
  
      it('get on valid string cache returns non null', async function () {
        const key = 'key';
        const expectedValue = 'value';
        clientCache.set(key, expectedValue, callingMethod);
        const cacheValue = clientCache.get(key, callingMethod);
        expect(cacheValue).to.be.equal(expectedValue);
      });

      it('get on valid int cache returns non null', async function () {
        const key = 'key';
        const expectedValue = 1;
        clientCache.set(key, expectedValue, callingMethod);
        const cacheValue = clientCache.get(key, callingMethod);
        expect(cacheValue).to.be.equal(expectedValue);
      });
  
      it('get on valid false boolean cache returns non null', async function () {
        const key = 'key';
        const expectedValue = false;
        clientCache.set(key, expectedValue, callingMethod);
        const cacheValue = clientCache.get(key, callingMethod);
        expect(cacheValue).to.be.equal(expectedValue);
      });

      it('get on valid true boolean cache returns non null', async function () {
        const key = 'key';
        const expectedValue = true;
        clientCache.set(key, expectedValue, callingMethod);
        const cacheValue = clientCache.get(key, callingMethod);
        expect(cacheValue).to.be.equal(expectedValue);
      });
  
      it('get on valid object cache returns non null', async function () {
        const key = 'key';
        const expectedValue = { key: 'value' };
        clientCache.set(key, expectedValue, callingMethod);
        const cacheValue = clientCache.get(key, callingMethod);
        expect(cacheValue).to.be.equal(expectedValue);
      });
    });

    describe('verify cache management', async function () {
      this.beforeEach(() => {
        process.env.CACHE_MAX = constants.CACHE_MAX.toString();
      });

      it('verify cache size', async function () {
        const cacheMaxSize = 2;
        process.env.CACHE_MAX = `${cacheMaxSize}`;
        const customClientCache = new ClientCache(logger.child({ name: `cache` }), registry);
        const keyValuePairs = {
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        };

        Object.entries(keyValuePairs).forEach(([key, value]) => {
          customClientCache.set(key, value, callingMethod);
        });

        // expect cache to have capped at max size
        expect(customClientCache.get('key1', callingMethod)).to.be.null; // key1 should have been evicted
        expect(customClientCache.get('key2', callingMethod)).to.be.equal(keyValuePairs.key2);
        expect(customClientCache.get('key3', callingMethod)).to.be.equal(keyValuePairs.key3);
      });

      it('verify cache LRU nature', async function () {
        const customClientCache = new ClientCache(logger.child({ name: `cache` }), registry);
        const key = 'key';
        let valueCount = 0; // keep track of values sets
        customClientCache.set(key, ++valueCount, callingMethod);
        customClientCache.set(key, ++valueCount, callingMethod);
        customClientCache.set(key, ++valueCount, callingMethod);
        const cacheValue = customClientCache.get(key, callingMethod);
        // expect cache to have latest value for key
        expect(cacheValue).to.be.equal(valueCount);
      });

      it('verify cache ttl nature', async function () {
        const customClientCache = new ClientCache(logger.child({ name: `cache` }), registry);
        const key = 'key';
        customClientCache.set(key, 'value', callingMethod, 100); // set ttl to 1 ms
        await new Promise(r => setTimeout(r, 500)); // wait for ttl to expire
        const cacheValue = customClientCache.get(key, callingMethod);
        expect(cacheValue).to.be.null;
      });
    });
});