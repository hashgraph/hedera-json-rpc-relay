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

import { Logger } from 'pino';
import { Counter, Registry } from 'prom-client';
import { ICacheClient } from '../../clients/cache/ICacheClient';
import { LocalLRUCache, RedisCache } from '../../clients';
import { RedisCacheError } from '../../errors/RedisCacheError';

/**
 * A service that manages caching using different cache implementations based on configuration.
 */
export class CacheService {
  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly internalCache: ICacheClient;

  /**
   * The Redis cache used for caching items from requests.
   *
   * @private
   */
  private readonly sharedCache: ICacheClient;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * The metrics register used for metrics tracking.
   * @private
   */
  private readonly register: Registry;

  /**
   * Used for reference to the state of REDIS_ENABLED and REDIS_URL env. variables.
   */
  private readonly isSharedCacheEnabled: boolean;

  /**
   * Used for setting what type of multiSet method should be used to save new values.
   */
  private readonly shouldMultiSet: boolean;

  /**
   * Represents a caching manager that utilizes various cache implementations based on configuration.
   * @param {Logger} logger - The logger used for logging all output from this class.
   * @param {Registry} register - The metrics register used for metrics tracking.
   */

  private static readonly cacheTypes = {
    REDIS: 'redis',
    LRU: 'lru',
  };

  private static readonly methods = {
    GET: 'get',
    GET_ASYNC: 'getAsync',
    SET: 'set',
    DELETE: 'delete',
    MSET: 'mSet',
    PIPELINE: 'pipeline',
  };

  private readonly cacheMethodsCounter: Counter;

  public constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;

    this.internalCache = new LocalLRUCache(logger.child({ name: 'localLRUCache' }), register);
    this.sharedCache = this.internalCache;
    this.isSharedCacheEnabled = process.env.TEST === 'true' ? false : this.isRedisEnabled();
    this.shouldMultiSet = process.env.MULTI_SET && process.env.MULTI_SET === 'true' ? true : false;

    if (this.isSharedCacheEnabled) {
      this.sharedCache = new RedisCache(logger.child({ name: 'redisCache' }), register);
    }

    /**
     * Labels:
     *  callingMethod - The method initiating the cache operation
     *  cacheType - redis/lru
     *  method - The CacheService method being called
     */
    const metricName = 'rpc_cache_service_methods_counter';
    this.register.removeSingleMetric(metricName);
    this.cacheMethodsCounter = new Counter({
      name: metricName,
      help: 'Counter for calls to methods of CacheService separated by CallingMethod and CacheType',
      registers: [register],
      labelNames: ['callingMethod', 'cacheType', 'method'],
    });
  }

  async disconnectRedisClient(): Promise<void> {
    if (this.sharedCache instanceof RedisCache) {
      await this.sharedCache.disconnect();
    }
  }

  /**
   * Checks whether Redis caching is enabled based on environment variables.
   * @private
   * @returns {boolean} Returns true if Redis caching is enabled, otherwise false.
   */
  public isRedisEnabled(): boolean {
    const redisEnabled = process.env.REDIS_ENABLED && process.env.REDIS_ENABLED === 'true';
    const redisUrlValid = process.env.REDIS_URL && process.env.REDIS_URL !== '';

    if (redisEnabled && redisUrlValid) {
      return true;
    }
    return false;
  }

  /**
   * Retrieves a value from the cache asynchronously.
   *
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<any>} A Promise that resolves with the cached value or null if not found.
   */
  private async getFromSharedCache(key: string, callingMethod: string, requestIdPrefix?: string): Promise<any> {
    try {
      this.cacheMethodsCounter
        .labels(callingMethod, CacheService.cacheTypes.REDIS, CacheService.methods.GET_ASYNC)
        .inc(1);

      return await this.sharedCache.get(key, callingMethod, requestIdPrefix);
    } catch (error) {
      const redisError = new RedisCacheError(error);
      this.logger.error(
        `${requestIdPrefix} Error occurred while getting the cache from Redis. Fallback to internal cache. Error is: ${redisError.fullError}`,
      );

      // fallback to internal cache in case of Redis error
      return await this.getFromInternalCache(key, callingMethod, requestIdPrefix);
    }
  }

  /**
   * If SharedCacheEnabled will use shared, otherwise will fallback to internal cache.
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<any>} A Promise that resolves with the cached value or null if not found.
   */
  public async getAsync(key: string, callingMethod: string, requestIdPrefix?: string): Promise<any> {
    if (this.isSharedCacheEnabled) {
      return await this.getFromSharedCache(key, callingMethod, requestIdPrefix);
    } else {
      return await this.getFromInternalCache(key, callingMethod, requestIdPrefix);
    }
  }

  /**
   * Retrieves a value from the internal cache.
   *
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<any>} A Promise that resolves with the cached value or null if not found.
   */
  private async getFromInternalCache(key: string, callingMethod: string, requestIdPrefix?: string): Promise<any> {
    this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.LRU, CacheService.methods.GET).inc(1);

    return await this.internalCache.get(key, callingMethod, requestIdPrefix);
  }

  /**
   * Sets a value in the cache associated with the given key.
   * If the shared cache is enabled and an error occurs while setting in it,
   * the internal cache is used as a fallback.
   * @param {string} key - The key to associate with the value.
   * @param {*} value - The value to cache.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {number} ttl - Time to live for the cached value in milliseconds (optional).
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   */
  public async set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number,
    requestIdPrefix?: string,
  ): Promise<void> {
    if (this.isSharedCacheEnabled) {
      try {
        this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.REDIS, CacheService.methods.SET).inc(1);

        await this.sharedCache.set(key, value, callingMethod, ttl, requestIdPrefix);
        return;
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while setting the cache to Redis. Fallback to internal cache. Error is: ${redisError.fullError}`,
        );
      }
    }

    // fallback to internal cache in case of Redis error
    this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.LRU, CacheService.methods.SET).inc(1);
    await this.internalCache.set(key, value, callingMethod, ttl, requestIdPrefix);
  }

  /**
   * Sets multiple values in the cache, each associated with its respective key.
   * Depends on env. variable, whether we will be using pipelining method or multiSet
   * If the shared cache is enabled and an error occurs while setting in it,
   * the internal cache is used as a fallback.
   * @param {Record<string, any>} entries - An object containing key-value pairs to cache.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {number} ttl - Time to live for the cached value in milliseconds (optional).
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   * @param {boolean} shared - Whether to use the shared cache (optional, default: false).
   */
  public async multiSet(
    entries: Record<string, any>,
    callingMethod: string,
    ttl?: number,
    requestIdPrefix?: string,
  ): Promise<void> {
    if (this.isSharedCacheEnabled) {
      const metricsMethod = this.shouldMultiSet ? CacheService.methods.MSET : CacheService.methods.PIPELINE;
      try {
        if (this.shouldMultiSet) {
          await this.sharedCache.multiSet(entries, callingMethod, requestIdPrefix);
        } else {
          await this.sharedCache.pipelineSet(entries, callingMethod, ttl, requestIdPrefix);
        }

        this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.REDIS, metricsMethod).inc(1);
        return;
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while setting the cache to Redis. Fallback to internal cache. Error is: ${redisError.fullError}`,
        );
      }
    }

    // fallback to internal cache, but use pipeline, because of it's TTL support
    await this.internalCache.pipelineSet(entries, callingMethod, ttl, requestIdPrefix);
    this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.LRU, CacheService.methods.SET).inc(1);
  }

  /**
   * Deletes a cached value associated with the given key.
   * If the shared cache is enabled and an error occurs while deleting from it, just logs the error.
   * Else the internal cache deletion is attempted.
   * @param {string} key - The key associated with the cached value to delete.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   * @param {boolean} shared - Whether to use the shared cache (optional, default: false).
   */
  public async delete(key: string, callingMethod: string, requestIdPrefix?: string): Promise<void> {
    if (this.isSharedCacheEnabled) {
      try {
        this.cacheMethodsCounter
          .labels(callingMethod, CacheService.cacheTypes.REDIS, CacheService.methods.DELETE)
          .inc(1);

        await this.sharedCache.delete(key, callingMethod, requestIdPrefix);
        return;
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while deleting cache from Redis. Error is: ${redisError.fullError}`,
        );
      }
    }

    // fallback to internal cache in case of Redis error
    this.cacheMethodsCounter.labels(callingMethod, CacheService.cacheTypes.LRU, CacheService.methods.DELETE).inc(1);
    await this.internalCache.delete(key, callingMethod, requestIdPrefix);
  }

  /**
   * Clears the cache.
   * If the shared cache is enabled and an error occurs while clearing it, just logs the error.
   * Else the internal cache clearing is attempted.
   * @param requestIdPrefix
   */
  public async clear(requestIdPrefix?: string): Promise<void> {
    if (this.isSharedCacheEnabled) {
      try {
        await this.sharedCache.clear();
        return;
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while clearing Redis cache. Error is: ${redisError.fullError}`,
        );
      }
    }

    // fallback to internal cache in case of Redis error
    await this.internalCache.clear();
  }
}
