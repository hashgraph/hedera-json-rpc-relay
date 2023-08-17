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

  public constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;
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
