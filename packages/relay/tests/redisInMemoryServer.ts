/*
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

import { RedisMemoryServer } from 'redis-memory-server';
import { Logger } from 'pino';

export class RedisInMemoryServer {
  /**
   * The instance of the in memory Redis server
   *
   * @private
   */
  private readonly inMemoryRedisServer: RedisMemoryServer;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * The desired port to run on.
   * @private
   */
  private readonly portToRunOn: number;

  constructor(logger: Logger, portToRunOn: number) {
    this.logger = logger;
    this.portToRunOn = portToRunOn;
    this.inMemoryRedisServer = new RedisMemoryServer({
      instance: {
        port: this.portToRunOn,
      },
      autoStart: false,
    });
  }

  async start(): Promise<void> {
    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace('Starting Redis in-memory server....');
    }
    const started = await this.inMemoryRedisServer.start();
    if (started) {
      const host = await this.getHost();
      const port = await this.getPort();
      this.logger.info(`Started Redis in-memory server on ${host}:${port} successfully.`);
    } else {
      this.logger.error("Couldn't start Redis in-memory server successfully.");
      await this.performHealthCheck();
    }
  }

  async getPort(): Promise<number> {
    return this.inMemoryRedisServer.getPort();
  }

  async getHost(): Promise<string> {
    return this.inMemoryRedisServer.getHost();
  }

  async stop(): Promise<void> {
    if (this.logger.isLevelEnabled('trace')) {
      this.logger.trace('Stopping Redis in-memory server....');
    }
    const stopped = await this.inMemoryRedisServer.stop();
    if (stopped) {
      this.logger.info('Stopped Redis in-memory server successfully.');
    } else {
      this.logger.info("Couldn't stop Redis in-memory server successfully.");
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Ensure that the instance is running -> throws error if instance cannot be started
      const instanceData = await this.inMemoryRedisServer.ensureInstance();
      if (this.logger.isLevelEnabled('debug')) {
        this.logger.debug(
          `Redis in-memory server health check passed, server is running on port ${instanceData.port}.`,
        );
      }
    } catch (error) {
      this.logger.warn(`Redis in-memory server health check failed: ${error}`);
    }
  }
}
