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

/**
 * Represents an error that can occur when interacting with the Redis cache.
 * @class
 */
export class RedisCacheError {
  public type: string;
  public fullError?: string;
  public message?: string;
  public stack?: string;

  static ErrorMessages = {
    SOCKET_CLOSED: 'SocketClosedUnexpectedlyError',
  };

  /**
   * Creates a new RedisCacheError instance from the provided error object.
   * @constructor
   * @param {any} error - The error object representing the Redis cache error.
   */
  constructor(error: any) {
    this.type = error.type;
    this.message = error.message;
    this.stack = error.stack;
    this.fullError = error;
  }

  public isSocketClosed(): boolean {
    return this.type === RedisCacheError.ErrorMessages.SOCKET_CLOSED;
  }
}
