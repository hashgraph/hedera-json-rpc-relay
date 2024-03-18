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
import { pino } from 'pino';
import { Registry } from 'prom-client';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { expect } from 'chai';
import * as sinon from 'sinon';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
const logger = pino();
const registry = new Registry();
let cacheService: CacheService;

const callingMethod = 'CacheServiceTest';

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

      cacheService.set(key, value, callingMethod);
      const cachedValue = cacheService.get(key, callingMethod);

      expect(cachedValue).eq(value);
    });

    it('should be able to set and delete from internal cache', async function () {
      const key = 'string';
      const value = 'value';

      cacheService.set(key, value, callingMethod);
      cacheService.delete(key, callingMethod);
      const cachedValue = cacheService.get(key, callingMethod);

      expect(cachedValue).to.be.null;
    });

    it('should be able to get from internal cache when calling getSharedWithFallback', async function () {
      const key = 'string';
      const value = 'value';

      cacheService.set(key, value, callingMethod, undefined, undefined, true);
      const cachedValue = cacheService.getSharedWithFallback(key, callingMethod);

      expect(cachedValue).eq(value);
    });

    it('should be able to set using multiSet and get them separately', async function () {
      const entries: Record<string, any> = {};
      entries['key1'] = 'value1';
      entries['key2'] = 'value2';
      entries['key3'] = 'value3';

      cacheService.multiSet(entries, callingMethod, undefined, true);

      for (const [key, value] of Object.entries(entries)) {
        const valueFromCache = cacheService.getSharedWithFallback(key, callingMethod, undefined);
        expect(valueFromCache).eq(value);
      }
    });
  });

  describe('Shared Cache Test Suite', async function () {
    const mock = sinon.createSandbox();

    this.beforeAll(() => {
      process.env.REDIS_ENABLED = 'true';
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      process.env.TEST = 'false';
      cacheService = new CacheService(logger.child({ name: 'cache-service' }), registry);
    });

    this.beforeEach(() => {
      mock.stub(cacheService, 'set').returns(true);
      mock.stub(cacheService, 'delete').returns(true);
    });

    this.afterEach(() => {
      mock.restore();
    });

    this.afterAll(() => {
      process.env.TEST = 'true';
    });

    it('should be able to set and get from shared cache', async function () {
      const key = 'string';
      const value = 'value';

      cacheService.set(key, value, callingMethod, undefined, undefined, true);

      mock.stub(cacheService, 'getAsync').returns(value);
      const cachedValue = await cacheService.getAsync(key, callingMethod, undefined);

      expect(cachedValue).eq(value);
    });

    it('should be able to set and delete from shared cache', async function () {
      const key = 'string';
      const value = 'value';

      cacheService.set(key, value, callingMethod, undefined, undefined, true);

      await cacheService.delete(key, callingMethod, undefined, true);
      mock.stub(cacheService, 'getAsync').returns(null);
      const cachedValue = await cacheService.getAsync(key, callingMethod, undefined);

      expect(cachedValue).to.be.null;
    });

    it('should be able to get from shared cache with fallback to internal cache', async function () {
      const key = 'string';
      const value = 'value';

      cacheService.set(key, value, callingMethod, undefined, undefined, true);

      mock.stub(cacheService, 'getAsync').returns(value);
      const cachedValue = await cacheService.getSharedWithFallback(key, callingMethod, undefined);

      expect(cachedValue).eq(value);
    });

    it('should be able to set using multiSet and get them separately using internal cache', async function () {
      const entries: Record<string, any> = {};
      entries['key1'] = 'value1';
      entries['key2'] = 'value2';
      entries['key3'] = 'value3';

      cacheService.multiSet(entries, callingMethod, undefined, false);

      for (const [key, value] of Object.entries(entries)) {
        const valueFromCache = cacheService.getSharedWithFallback(key, callingMethod, undefined);
        expect(valueFromCache).eq(value);
      }
    });
  });
});
