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

import { Logger } from 'pino';
import { Registry } from 'prom-client';
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
   * Used to set a shared cache policy for the class instance
   * @private
   */
  private readonly useSharedCache: boolean;

  /**
   * Represents a caching manager that utilizes various cache implementations based on configuration.
   * @param {Logger} logger - The logger used for logging all output from this class.
   * @param {Registry} register - The metrics register used for metrics tracking.
   */
  public constructor(logger: Logger, register: Registry, useSharedCache: boolean = false) {
    this.logger = logger;
    this.register = register;

    this.internalCache = new LocalLRUCache(logger.child({ name: 'localLRUCache' }), register);
    this.sharedCache = this.internalCache;
    this.isSharedCacheEnabled = this.isRedisEnabled();
    this.useSharedCache = useSharedCache;

    if (this.isSharedCacheEnabled) {
      this.sharedCache = new RedisCache(logger.child({ name: 'redisCache' }), register);
    }
  }

  /**
   * Checks whether Redis caching is enabled based on environment variables.
   * @private
   * @returns {boolean} Returns true if Redis caching is enabled, otherwise false.
   */
  private isRedisEnabled(): boolean {
    const redisEnabled = process.env.REDIS_ENABLED && process.env.REDIS_ENABLED === 'true';
    const redisUrlValid = process.env.REDIS_URL && process.env.REDIS_URL !== '';

    if (redisEnabled && redisUrlValid) {
      return true;
    }
    return false;
  }

  private shouldUseSharedCache(shared: boolean = false): boolean {
    return (shared || this.useSharedCache) && this.isSharedCacheEnabled;
  }

  /**
   * Retrieves a value from the cache asynchronously.
   *
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<any>} A Promise that resolves with the cached value or null if not found.
   */
  public async getAsync(
    key: string,
    callingMethod: string,
    requestIdPrefix?: string
  ): Promise<any> {
    if (!this.isSharedCacheEnabled) {
      return null;
    }

    try {
      return await this.sharedCache.get(key, callingMethod, requestIdPrefix);
    } catch (error) {
      const redisError = new RedisCacheError(error);
      this.logger.error(
        `${requestIdPrefix} Error occurred while getting the cache from Redis. Fallback to internal cache. Error is: ${redisError.fullError}`
      );
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
  public async get(key: string, callingMethod: string, requestIdPrefix?: string, shared: boolean = false): Promise<any> {
    if (this.shouldUseSharedCache(shared)) {
      try {
        return await this.sharedCache.get(key, callingMethod, requestIdPrefix);
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
            `${requestIdPrefix} Error occurred while getting the cache from Redis. Fallback to internal cache. Error is: ${redisError.fullError}`
        );
      }
    }
    else {
      return this.internalCache.get(key, callingMethod, requestIdPrefix);
    }
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
   * @param {boolean} shared - Whether to use the shared cache (optional, default: false).
   */
  public set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number,
    requestIdPrefix?: string,
    shared: boolean = false
  ): void {
    if ((shared || this.useSharedCache) && this.isSharedCacheEnabled) {
      try {
        this.sharedCache.set(key, value, callingMethod, ttl, requestIdPrefix);
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while setting the cache to Redis. Fallback to internal cache. Error is: ${redisError.fullError}`
        );
      }
    } else {
      this.internalCache.set(key, value, callingMethod, ttl, requestIdPrefix);
    }
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
  public delete(key: string, callingMethod: string, requestIdPrefix?: string, shared: boolean = false): void {
    if (shared && this.isSharedCacheEnabled) {
      try {
        return this.sharedCache.delete(key, callingMethod, requestIdPrefix);
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while deleting cache from Redis. Error is: ${redisError.fullError}`
        );
      }
    } else {
      this.internalCache.delete(key, callingMethod, requestIdPrefix);
    }
  }

  /**
   * Clears the cache.
   * If the shared cache is enabled and an error occurs while clearing it, just logs the error.
   * Else the internal cache clearing is attempted.
   * @param {boolean} shared - Whether to clear the shared cache (optional, default: false).
   */
  public clear(requestIdPrefix?: string, shared: boolean = false): void {
    if (shared && this.isSharedCacheEnabled) {
      try {
        return this.sharedCache.clear();
      } catch (error) {
        const redisError = new RedisCacheError(error);
        this.logger.error(
          `${requestIdPrefix} Error occurred while clearing Redis cache. Error is: ${redisError.fullError}`
        );
      }
    } else {
      this.internalCache.clear();
    }
  }
}
