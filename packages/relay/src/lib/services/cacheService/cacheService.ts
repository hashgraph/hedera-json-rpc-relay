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

import { Registry } from 'prom-client';
import { Logger } from 'pino';
import { LocalLRUCache, RedisCache } from '../../clients';
import { ICacheClient } from '../../clients/cacheClient/ICacheClient';

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
  private readonly sharedCache;

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
   * Represents a caching manager that utilizes various cache implementations based on configuration.
   * @param {Logger} logger - The logger used for logging all output from this class.
   * @param {Registry} register - The metrics register used for metrics tracking.
   */
  public constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;

    this.internalCache = new LocalLRUCache(logger, register);
    this.sharedCache = this.internalCache;

    if (this.isRedisEnabled()) {
      this.sharedCache = new RedisCache(logger, register);
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

  public get(key: string, callingMethod: string, requestIdPrefix?: string, shared: boolean = false): any {
    if (shared) {
      // handle shared cache
      return null;
    } else {
      return this.internalCache.get(key, callingMethod, requestIdPrefix);
    }
    // Depending on the shared boolean, this method decide from where it should request the data.
    // Fallbacks to internalCache in case of error from the shared cache.
    // Getting from shared cache depends on REDIS_ENABLED env. variable
  }

  public set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number,
    requestIdPrefix?: string,
    shared: boolean = false
  ): void {
    if (shared) {
      // handle shared cache
    } else {
      this.internalCache.set(key, value, callingMethod, ttl, requestIdPrefix);
    }
    // Depending on the shared boolean, this method decide where it should save the data.
    // Fallbacks to internalCache in case of error from the shared cache.
    // Setting to shared cache depends on REDIS_ENABLED env. variable
  }

  public delete(key: string, callingMethod: string, requestIdPrefix?: string, shared: boolean = false): void {
    if (shared) {
      // handle shared cache
    } else {
      this.internalCache.delete(key, callingMethod, requestIdPrefix);
    }
    // Depending on the shared boolean, this method decide from where it should delete the data.
    // Fallbacks to internalCache in case of error from the shared cache.
    // Deleting from shared cache depends on REDIS_ENABLED env. variable
  }

  public clear(shared: boolean = false): void {
    if (shared) {
      // handle shared cache
    } else {
      this.internalCache.clear();
    }
    // In case of error does NOT fallback to shared cache.
    // Clearing from shared cache depends on REDIS_ENABLED env. variable
  }
}
