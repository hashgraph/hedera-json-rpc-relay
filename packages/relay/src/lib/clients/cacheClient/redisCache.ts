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

export class RedisCache implements ICacheClient {
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
      }}
    });
    this.client.connect();

    this.client.on("ready", function() {  
      logger.info("Connected to Redis server successfully!");  
    });

    this.client.on("error", function(error) {
      const redisError = new RedisCacheError(error);
      if (redisError.isSocketClosed()) {
        logger.error(`Error occured with Redis Connection. Error is: ${redisError.message}`);  
      } else {
        logger.error(`${redisError.fullError}`);
      }
   });
  }

  get(key: string, callingMethod: string, requestIdPrefix?: string | undefined) {
    throw new Error('Method not implemented.');
  }

  set(
    key: string,
    value: any,
    callingMethod: string,
    ttl?: number | undefined,
    requestIdPrefix?: string | undefined
  ): void {
    throw new Error('Method not implemented.');
  }

  delete(key: string, callingMethod: string, requestIdPrefix?: string | undefined): void {
    throw new Error('Method not implemented.');
  }

  clear(): void {
    throw new Error('Method not implemented.');
  }
}
