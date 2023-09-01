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
import { expect } from "chai";
import * as sinon from "sinon";
import { RedisCache } from "../../../src/lib/clients";
import { Registry } from "prom-client";

const logger = pino();
const registry = new Registry();
let redisCache: RedisCache;

const callingMethod = "RedisCacheTest";

describe("RedisCache Test Suite", async function () {
  this.timeout(10000);
  const mock = sinon.createSandbox();

  this.beforeAll(() => {
    redisCache = new RedisCache(logger.child({ name: `cache` }), registry);
  });

  this.beforeEach(() => {
    mock.stub(redisCache, "set").returns(true);
    mock.stub(redisCache, "delete").returns(true);
  });

  this.afterEach(() => {
    mock.restore();
  });

  describe("Get and Set Test Suite", async function () {
    it("should get null on empty cache", async function () {
      mock.stub(redisCache, "get").returns(null);
      const cacheValue = await redisCache.get("test", callingMethod);
      expect(cacheValue).to.be.null;
    });

    it("should get valid int cache", async function () {
      const key = "int";
      const value = 1;

      mock.stub(redisCache, "get").returns(value);
      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });

    it("should get valid boolean cache", async function () {
      const key = "boolean";
      const value = false;

      mock.stub(redisCache, "get").returns(value);
      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });

    it("should get valid array cache", async function () {
      const key = "array";
      const value = ["false"];

      mock.stub(redisCache, "get").returns(value);
      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });

    it("should get valid object cache", async function () {
      const key = "object";
      const value = { result: true };

      mock.stub(redisCache, "get").returns(value);
      await redisCache.set(key, value, callingMethod);

      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).equal(value);
    });
  });

  describe("Delete Test Suite", async function () {
    it("should delete int cache", async function () {
      const key = "int";
      const value = 1;

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      mock.stub(redisCache, "get").returns(null);
      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it("should delete boolean cache", async function () {
      const key = "boolean";
      const value = false;

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      mock.stub(redisCache, "get").returns(null);
      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it("should delete array cache", async function () {
      const key = "array";
      const value = ["false"];

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      mock.stub(redisCache, "get").returns(null);
      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });

    it("should delete object cache", async function () {
      const key = "object";
      const value = { result: true };

      await redisCache.set(key, value, callingMethod);
      await redisCache.delete(key, callingMethod);

      mock.stub(redisCache, "get").returns(null);
      const cachedValue = await redisCache.get(key, callingMethod);
      expect(cachedValue).to.be.null;
    });
  });
});
