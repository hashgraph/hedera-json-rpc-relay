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
import { ICacheClient } from './ICacheClient';
import { Registry } from 'prom-client';
import { createClient, RedisClientType } from 'redis';
import { RedisCacheError } from '../../errors/RedisCacheError';
import constants from '../../constants';

export class RedisCache implements ICacheClient {
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

  public constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;

    const redisUrl = process.env.REDIS_URL!;
    const reconnectDelay = parseInt(process.env.REDIS_RECONNECT_DELAY || '1000');

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
      logger.info('Connected to Redis server successfully!');
    });

    this.client.on('error', function (error) {
      const redisError = new RedisCacheError(error);
      if (redisError.isSocketClosed()) {
        logger.error(`Error occured with Redis Connection. Error is: ${redisError.message}`);
      } else {
        logger.error(`${redisError.fullError}`);
      }
    });
  }

  async get(key: string, callingMethod: string, requestIdPrefix?: string | undefined) {
    const result = await this.client.get(key);
    if (result) {
      this.logger.trace(
        `${requestIdPrefix} returning cached value ${key}:${JSON.stringify(result)} on ${callingMethod} call`
      );
      //add metrics
      return JSON.parse(result);
    }
    return null;
  }

  async set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number | undefined,
    requestIdPrefix?: string | undefined
  ): Promise<void> {
    const serializedValue = JSON.stringify(value);
    const resolvedTtl = ttl ?? this.options.ttl;
    
    await this.client.setEx(key, resolvedTtl, serializedValue);
    this.logger.trace(`${requestIdPrefix} caching ${key}: ${serializedValue} on ${callingMethod} for ${resolvedTtl} ms`);
    //add metrics
  }

  delete(key: string, callingMethod: string, requestIdPrefix?: string | undefined): void {
    throw new Error('Method not implemented.');
  }

  clear(): void {
    throw new Error('Method not implemented.');
  }
}
