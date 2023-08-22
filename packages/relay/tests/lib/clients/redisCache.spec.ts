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

import { pino } from "pino";
import { RedisCache } from "../../../src/lib/clients";
import { Registry } from "prom-client";
import { createClient } from 'redis-mock';
import { expect } from "chai";

const logger = pino();
const registry = new Registry();
let redisCache: RedisCache;

const callingMethod = 'RedisCacheTest';

describe.only('RedisCache Test Suite', async function () {
    this.timeout(10000);


  this.beforeAll(() => {
    redisCache = new RedisCache(logger.child({ name: `cache` }), registry);

    // @ts-ignore
    redisCache.client = createClient();
  });

  this.beforeEach(() => {
    redisCache.clear();
  });

  describe('Get Test Suite', async function () {
    it('should get null on empty cache', async function () {
        const cacheValue = await redisCache.get('test', callingMethod);
        expect(cacheValue).to.be.null;
    });

    it('should get valid int cache', async function () {

    });

    it('should get valid boolean cache', async function () {

    });

    it('should get valid array cache', async function () {

    });

    it('should get valid object cache', async function () {

    });
  });

  describe('Set Test Suite', async function () {
    it('should set int cache', async function () {

    });

    it('should set boolean cache', async function () {

    });

    it('should set array cache', async function () {

    });

    it('should set object cache', async function () {

    });

    it('should set valid cache with custom ttl', async function () {

    });
  });

  describe('Delete Test Suite', async function () {
    it('should delete int cache', async function () {

    });

    it('should delete boolean cache', async function () {

    });

    it('should delete array cache', async function () {

    });

    it('should delete object cache', async function () {

    });
  });
});
