// SPDX-License-Identifier: Apache-2.0

import { Logger } from 'pino';
import { Gauge, Registry } from 'prom-client';
import { ICacheClient } from './ICacheClient';
import LRUCache, { LimitedByCount, LimitedByTTL } from 'lru-cache';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { RequestDetails } from '../../types';
import { Utils } from '../../../utils';

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
  private readonly options: LimitedByCount & LimitedByTTL = {
    // The maximum number (or size) of items that remain in the cache (assuming no TTL pruning or explicit deletions).
    max: ConfigService.get('CACHE_MAX'),
    // Max time to live in ms, for items before they are considered stale.
    ttl: ConfigService.get('CACHE_TTL'),
  };

  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly cache: LRUCache<string, any>;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * The gauge used for tracking the size of the cache.
   * @private
   */
  private readonly cacheKeyGauge: Gauge<string>;

  /**
   * A set of keys that should never be evicted from the cache.
   * @private
   */
  private readonly reservedKeys: Set<string>;

  /**
   * The LRU cache used for caching items from requests that should never be evicted.
   *
   * @private
   */
  private readonly reservedCache?: LRUCache<string, any>;

  /**
   * Represents a LocalLRUCache instance that uses an LRU (Least Recently Used) caching strategy
   * for caching items internally from requests.
   * @implements {ICacheClient}
   * @class
   * @constructor
   * @param {Logger} logger - The logger instance to be used for logging.
   * @param {Registry} register - The registry instance used for metrics tracking.
   */
  public constructor(logger: Logger, register: Registry, reservedKeys: Set<string> = new Set()) {
    this.cache = new LRUCache(this.options);
    this.logger = logger;
    this.reservedKeys = reservedKeys;
    if (reservedKeys.size > 0) {
      this.reservedCache = new LRUCache({ max: reservedKeys.size });
    }

    const cacheSizeCollect = (): void => {
      this.purgeStale();
      this.cacheKeyGauge.set(this.cache.size);
    };

    const metricCounterName = 'rpc_relay_cache';
    register.removeSingleMetric(metricCounterName);
    this.cacheKeyGauge = new Gauge({
      name: metricCounterName,
      help: 'Relay LRU cache gauge',
      registers: [register],
      async collect(): Promise<void> {
        cacheSizeCollect();
      },
    });
  }

  /**
   * Retrieves a cached value associated with the given key.
   * If the value exists in the cache, updates metrics and logs the retrieval.
   * @param {string} key - The key associated with the cached value.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {*} The cached value if found, otherwise null.
   */
  public async get(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<any> {
    const cache = this.getCacheInstance(key);
    const value = cache.get(key);
    if (value !== undefined) {
      const censoredKey = key.replace(Utils.IP_ADDRESS_REGEX, '<REDACTED>');
      const censoredValue = JSON.stringify(value).replace(/"ipAddress":"[^"]+"/, '"ipAddress":"<REDACTED>"');
      const message = `Returning cached value ${censoredKey}:${censoredValue} on ${callingMethod} call`;
      if (this.logger.isLevelEnabled('trace')) {
        this.logger.trace(`${requestDetails.formattedRequestId} ${message}`);
      }
      return value;
    }

    return null;
  }

  /**
   * The remaining TTL of the specified key in the cache.
   * @param {string} key - The key to check the remaining TTL for.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<number>} The remaining TTL in milliseconds.
   */
  public async getRemainingTtl(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<number> {
    const cache = this.getCacheInstance(key);
    const remainingTtl = cache.getRemainingTTL(key); // in milliseconds
    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace(
        `${requestDetails.formattedRequestId} returning remaining TTL ${key}:${remainingTtl} on ${callingMethod} call`,
      );
    }
    return remainingTtl;
  }

  /**
   * Sets a value in the cache associated with the given key.
   * Updates metrics, logs the caching, and associates a TTL if provided.
   * @param {string} key - The key to associate with the value.
   * @param {*} value - The value to cache.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {number} ttl - Time to live for the cached value in milliseconds (optional).
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   */
  public async set(
    key: string,
    value: any,
    callingMethod: string,
    requestDetails: RequestDetails,
    ttl?: number,
  ): Promise<void> {
    const resolvedTtl = ttl ?? this.options.ttl;
    const cache = this.getCacheInstance(key);
    if (resolvedTtl > 0) {
      cache.set(key, value, { ttl: resolvedTtl });
    } else {
      cache.set(key, value, { ttl: 0 }); // 0 means indefinite time
    }
    const censoredKey = key.replace(Utils.IP_ADDRESS_REGEX, '<REDACTED>');
    const censoredValue = JSON.stringify(value).replace(/"ipAddress":"[^"]+"/, '"ipAddress":"<REDACTED>"');
    const message = `Caching ${censoredKey}:${censoredValue} on ${callingMethod} for ${
      resolvedTtl > 0 ? `${resolvedTtl} ms` : 'indefinite time'
    }`;
    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace(
        `${requestDetails.formattedRequestId} ${message} (cache size: ${this.cache.size}, max: ${this.options.max})`,
      );
    }
  }

  /**
   * Stores multiple key-value pairs in the cache.
   *
   * @param keyValuePairs - An object where each property is a key and its value is the value to be cached.
   * @param callingMethod - The name of the calling method.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<void>} A Promise that resolves when the values are cached.
   */
  public async multiSet(
    keyValuePairs: Record<string, any>,
    callingMethod: string,
    requestDetails: RequestDetails,
  ): Promise<void> {
    // Iterate over each entry in the keyValuePairs object
    for (const [key, value] of Object.entries(keyValuePairs)) {
      await this.set(key, value, callingMethod, requestDetails);
    }
  }

  /**
   * Stores multiple key-value pairs in the cache.
   *
   * @param keyValuePairs - An object where each property is a key and its value is the value to be cached.
   * @param callingMethod - The name of the calling method.
   * @param ttl - Time to live on the set values
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {void} A Promise that resolves when the values are cached.
   */
  public async pipelineSet(
    keyValuePairs: Record<string, any>,
    callingMethod: string,
    requestDetails: RequestDetails,
    ttl?: number,
  ): Promise<void> {
    // Iterate over each entry in the keyValuePairs object
    for (const [key, value] of Object.entries(keyValuePairs)) {
      await this.set(key, value, callingMethod, requestDetails, ttl);
    }
  }

  /**
   * Deletes a cached value associated with the given key.
   * Logs the deletion of the cache entry.
   * @param {string} key - The key associated with the cached value to delete.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   */
  public async delete(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<void> {
    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace(`${requestDetails.formattedRequestId} delete cache for ${key} on ${callingMethod} call`);
    }
    const cache = this.getCacheInstance(key);
    cache.delete(key);
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
  public async clear(): Promise<void> {
    this.cache.clear();
    this.reservedCache?.clear();
  }

  /**
   * Retrieves all keys in the cache that match the given pattern.
   * @param {string} pattern - The pattern to match keys against.
   * @param {string} callingMethod - The name of the method calling the cache.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<string[]>} An array of keys that match the pattern.
   */
  public async keys(pattern: string, callingMethod: string, requestDetails: RequestDetails): Promise<string[]> {
    const keys = [...this.cache.rkeys(), ...(this.reservedCache?.rkeys() ?? [])];

    // Replace escaped special characters with placeholders
    let regexPattern = pattern
      .replace(/\\\*/g, '__ESCAPED_STAR__')
      .replace(/\\\?/g, '__ESCAPED_QUESTION__')
      .replace(/\\\[/g, '__ESCAPED_OPEN_BRACKET__')
      .replace(/\\]/g, '__ESCAPED_CLOSE_BRACKET__');

    // Replace unescaped special characters with regex equivalents
    regexPattern = regexPattern
      .replace(/\\([*?[\]])/g, (_, char) => `__ESCAPED_${char}__`)
      .replace(/\[([^\]\\]+)]/g, '[$1]')
      .replace(/(?<!\\)\*/g, '.*')
      .replace(/(?<!\\)\?/g, '.')
      .replace(/(?<!\\)\[!]/g, '[^]');

    // Replace placeholders with the original special characters
    regexPattern = regexPattern
      .replace(/__ESCAPED_STAR__/g, '\\*')
      .replace(/__ESCAPED_QUESTION__/g, '\\?')
      .replace(/__ESCAPED_OPEN_BRACKET__/g, '\\[')
      .replace(/__ESCAPED_CLOSE_BRACKET__/g, '\\]');

    const regex = new RegExp(regexPattern);

    const matchingKeys = keys.filter((key) => regex.test(key));

    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace(
        `${requestDetails.formattedRequestId} retrieving keys matching ${pattern} on ${callingMethod} call`,
      );
    }
    return matchingKeys;
  }

  private getCacheInstance(key: string): LRUCache<string, any> {
    return this.reservedCache && this.reservedKeys.has(key) ? this.reservedCache : this.cache;
  }
}
