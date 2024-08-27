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

import { expect } from 'chai';
import { CacheService } from '../../../../packages/relay/src/lib/services/cacheService/cacheService';
import { Registry } from 'prom-client';
const registry = new Registry();

const DATA_LABEL_PREFIX = 'acceptance-test-';
const DATA = {
  foo: 'bar',
};
const CALLING_METHOD = 'AcceptanceTest';

describe('@cache-service Acceptance Tests for shared cache', function () {
  let cacheService: CacheService;

  before(async () => {
    cacheService = new CacheService(global.logger, registry);
    await new Promise((r) => setTimeout(r, 1000));
  });

  it('Correctly performs set, get and delete operations', async () => {
    const dataLabel = `${DATA_LABEL_PREFIX}1`;

    await cacheService.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined, true);
    await new Promise((r) => setTimeout(r, 200));

    const cache = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(cache).to.deep.eq(DATA, 'set method saves to shared cache');

    const cacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(cacheFromService).to.deep.eq(DATA, 'getAsync method reads correctly from shared cache');

    await cacheService.delete(dataLabel, CALLING_METHOD, undefined, true);
    await new Promise((r) => setTimeout(r, 200));

    const deletedCache = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(deletedCache).to.eq(null, 'the delete method correctly deletes from shared cache');

    const deletedCacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(deletedCacheFromService).to.eq(null, 'getAsync method cannot read deleted cache');
  });

  it('Correctly sets TTL time', async () => {
    const ttl = 1000;
    const dataLabel = `${DATA_LABEL_PREFIX}2`;

    await cacheService.set(dataLabel, DATA, CALLING_METHOD, ttl, undefined, true);
    await new Promise((r) => setTimeout(r, 200));

    const cache = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(cache).to.deep.eq(DATA, 'data is stored with TTL');

    await new Promise((r) => setTimeout(r, ttl));

    const expiredCache = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(expiredCache).to.eq(null, 'cache expires after TTL period');

    const deletedCacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
    expect(deletedCacheFromService).to.eq(null, 'getAsync method cannot read expired cache');
  });

  it('Fallsback to local cache for REDIS_ENABLED !== true', async () => {
    const dataLabel = `${DATA_LABEL_PREFIX}3`;

    process.env.REDIS_ENABLED = 'false';
    const serviceWithDisabledRedis = new CacheService(global.logger, registry);
    await new Promise((r) => setTimeout(r, 1000));
    expect(serviceWithDisabledRedis.isRedisEnabled()).to.eq(false, 'redis is disabled');
    await serviceWithDisabledRedis.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined, true);
    await new Promise((r) => setTimeout(r, 200));

    const dataInLRU = await serviceWithDisabledRedis.getAsync(dataLabel, CALLING_METHOD);
    expect(dataInLRU).to.deep.eq(DATA, 'data is stored in local cache');

    process.env.REDIS_ENABLED = 'true';
  });

  it('Cache set by one instance can be accessed by another', async () => {
    const dataLabel = `${DATA_LABEL_PREFIX}4`;
    const otherServiceInstance = new CacheService(global.logger, registry);
    await cacheService.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined, true);
    await new Promise((r) => setTimeout(r, 200));

    const cachedData = await otherServiceInstance.getAsync(dataLabel, CALLING_METHOD);
    expect(cachedData).to.deep.eq(DATA, 'cached data is read correctly by other service instance');
  });

  describe('fallback to local cache in case of Redis error', async () => {
    const dataLabel = `${DATA_LABEL_PREFIX}_redis_error`;

    let currentRedisEnabledEnv;
    let cacheService;

    before(async () => {
      currentRedisEnabledEnv = process.env.REDIS_ENABLED;

      process.env.REDIS_ENABLED = 'true';
      cacheService = new CacheService(global.logger, registry);

      // disconnect redis client to simulate Redis error
      await cacheService.disconnectRedisClient();
      await new Promise((r) => setTimeout(r, 1000));
    });

    after(async () => {
      process.env.REDIS_ENABLED = currentRedisEnabledEnv;
    });

    it('test getAsync operation', async () => {
      await cacheService.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined);
      await new Promise((r) => setTimeout(r, 200));

      const dataInLRU = await cacheService.getAsync(dataLabel, CALLING_METHOD);
      expect(dataInLRU).to.deep.eq(DATA, 'data is stored in local cache');
    });

    it('test multiSet operation', async () => {
      const pairs = {
        boolean: true,
        int: -1,
        string: '5644',
      };

      await cacheService.multiSet(pairs, CALLING_METHOD, undefined, undefined);
      await new Promise((r) => setTimeout(r, 200));

      for (const key in pairs) {
        const cachedValue = await cacheService.getAsync(key, CALLING_METHOD);
        expect(cachedValue).deep.equal(pairs[key]);
      }
    });

    it('test delete operation', async () => {
      await cacheService.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined);
      await new Promise((r) => setTimeout(r, 200));

      await cacheService.delete(dataLabel, CALLING_METHOD);
      const dataInLRU = await cacheService.getAsync(dataLabel, CALLING_METHOD);
      expect(dataInLRU).to.be.null;
    });
  });
});
