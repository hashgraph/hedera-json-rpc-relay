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

import { createClient, RedisClientType } from 'redis';
import { Logger } from 'pino';
import { Registry } from 'prom-client';
import { ICacheClient } from './ICacheClient';
import { RedisCacheError } from '../../errors/RedisCacheError';
import constants from '../../constants';

/**
 * A class that provides caching functionality using Redis.
 */
export class RedisCache implements ICacheClient {
  /**
   * Configurable options used when initializing the cache.
   *
   * @private
   */
  private readonly options = {
    // Max time to live in ms, for items before they are considered stale.
    ttl: Number.parseInt(process.env.CACHE_TTL ?? constants.CACHE_TTL.ONE_HOUR.toString()),
  };

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

  private readonly client: RedisClientType;

  /**
   * Creates an instance of `RedisCache`.
   *
   * @param {Logger} logger - The logger instance.
   * @param {Registry} register - The metrics registry.
   */
  public constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;

    const redisUrl = process.env.REDIS_URL!;
    const reconnectDelay = parseInt(process.env.REDIS_RECONNECT_DELAY_MS || '1000');

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          const delay = retries * reconnectDelay;
          logger.warn(`Trying to reconnect with Redis, ${retries} left. Delay is ${delay} ms...`);
          return delay;
        },
      },
    });
    this.client.connect();

    this.client.on('ready', function () {
      logger.info(`Connected to Redis server (${redisUrl}) successfully!`);
    });

    this.client.on('error', function (error) {
      const redisError = new RedisCacheError(error);
      if (redisError.isSocketClosed()) {
        logger.error(`Error occurred with Redis Connection when closing socket: ${redisError.message}`);
      } else {
        logger.error(`Error occurred with Redis Connection: ${redisError.fullError}`);
      }
    });
  }

  /**
   * Retrieves a value from the cache.
   *
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<any | null>} The cached value or null if not found.
   */
  async get(key: string, callingMethod: string, requestIdPrefix?: string | undefined) {
    const result = await this.client.get(key);
    if (result) {
      this.logger.trace(
        `${requestIdPrefix} returning cached value ${key}:${JSON.stringify(result)} on ${callingMethod} call`
      );
      // TODO: add metrics
      return JSON.parse(result);
    }
    return null;
  }

  /**
   * Stores a value in the cache.
   *
   * @param {string} key - The cache key.
   * @param {*} value - The value to be cached.
   * @param {string} callingMethod - The name of the calling method.
   * @param {number} [ttl] - The time-to-live (expiration) of the cache item in milliseconds.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<void>} A Promise that resolves when the value is cached.
   */
  async set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number | undefined,
    requestIdPrefix?: string | undefined
  ): Promise<void> {
    const serializedValue = JSON.stringify(value);
    const resolvedTtl = (ttl ?? this.options.ttl) / 1000; // convert to seconds

    await this.client.setEx(key, resolvedTtl, serializedValue);
    this.logger.trace(
      `${requestIdPrefix} caching ${key}: ${serializedValue} on ${callingMethod} for ${resolvedTtl} s`
    );
    // TODO: add metrics
  }

  /**
   * Deletes a value from the cache.
   *
   * @param {string} key - The cache key.
   * @param {string} callingMethod - The name of the calling method.
   * @param {string} [requestIdPrefix] - The optional request ID prefix.
   * @returns {Promise<void>} A Promise that resolves when the value is deleted from the cache.
   */
  async delete(key: string, callingMethod: string, requestIdPrefix?: string | undefined): Promise<void> {
    await this.client.del(key);
    this.logger.trace(`${requestIdPrefix} delete cache for ${key} on ${callingMethod} call`);
    // TODO: add metrics
  }

  /**
   * Clears the entire cache.
   *
   * @returns {Promise<void>} A Promise that resolves when the cache is cleared.
   */
  async clear(): Promise<void> {
    await this.client.flushAll();
  }
}
