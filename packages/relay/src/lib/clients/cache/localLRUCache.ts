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
import { Gauge, Registry } from 'prom-client';
import { ICacheClient } from './ICacheClient';
import constants from '../../constants';

const LRU = require('lru-cache');

/**
 * Represents a LocalLRUCache instance that uses an LRU (Least Recently Used) caching strategy
 * for caching items internally from requests.
 * @implements {ICacheClient}
 */
export class LocalLRUCache implements ICacheClient {
  /**
   * Configurable options used when initializing the cache.
   *
   * @private
   */
  private readonly options = {
    // The maximum number (or size) of items that remain in the cache (assuming no TTL pruning or explicit deletions).
    max: Number.parseInt(process.env.CACHE_MAX ?? constants.CACHE_MAX.toString()),
    // Max time to live in ms, for items before they are considered stale.
    ttl: Number.parseInt(process.env.CACHE_TTL ?? constants.CACHE_TTL.ONE_HOUR.toString()),
  };

  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly cache;

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
  private cacheKeyGauge: Gauge<string>;

  /**
   * Represents a LocalLRUCache instance that uses an LRU (Least Recently Used) caching strategy
   * for caching items internally from requests.
   * @implements {ICacheClient}
   * @class
   * @constructor
   * @param {Logger} logger - The logger instance to be used for logging.
   * @param {Registry} register - The registry instance used for metrics tracking.
   */
  public constructor(logger: Logger, register: Registry) {
    this.cache = new LRU(this.options);
    this.logger = logger;
    this.register = register;

    const cacheSizeCollect = () => {
      this.purgeStale();
      this.cacheKeyGauge.set(this.cache.size);
    };

    const metricCounterName = 'rpc_relay_cache';
    register.removeSingleMetric(metricCounterName);
    this.cacheKeyGauge = new Gauge({
      name: metricCounterName,
      help: 'Relay LRU cache gauge',
      registers: [register],
      async collect() {
        cacheSizeCollect();
      },
    });
  }

  /**
   * Retrieves a cached value associated with the given key.
   * If the value exists in the cache, updates metrics and logs the retrieval.
   * @param {string} key - The key associated with the cached value.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   * @returns {*} The cached value if found, otherwise null.
   */
  public get(key: string, callingMethod: string, requestIdPrefix?: string): any {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.logger.trace(
        `${requestIdPrefix} returning cached value ${key}:${JSON.stringify(value)} on ${callingMethod} call`,
      );
      return value;
    }

    return null;
  }

  /**
   * Sets a value in the cache associated with the given key.
   * Updates metrics, logs the caching, and associates a TTL if provided.
   * @param {string} key - The key to associate with the value.
   * @param {*} value - The value to cache.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {number} ttl - Time to live for the cached value in milliseconds (optional).
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   */
  public set(key: string, value: any, callingMethod: string, ttl?: number, requestIdPrefix?: string): void {
    const resolvedTtl = ttl ?? this.options.ttl;
    this.logger.trace(`${requestIdPrefix} caching ${key}:${JSON.stringify(value)} for ${resolvedTtl} ms`);
    this.cache.set(key, value, { ttl: resolvedTtl });
  }

  /**
   * Deletes a cached value associated with the given key.
   * Logs the deletion of the cache entry.
   * @param {string} key - The key associated with the cached value to delete.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {string} requestIdPrefix - A prefix to include in log messages (optional).
   */
  public delete(key: string, callingMethod: string, requestIdPrefix?: string): void {
    this.logger.trace(`${requestIdPrefix} delete cache for ${key}`);
    this.cache.delete(key);
  }

  /**
   * Purges stale entries from the cache.
   * This method should be called periodically to remove items that have expired.
   */
  public purgeStale(): void {
    this.cache.purgeStale();
  }

  /**
   * Clears the entire cache, removing all entries.
   * Use this method with caution, as it wipes all cached data.
   */
  public clear(): void {
    this.cache.clear();
  }
}
