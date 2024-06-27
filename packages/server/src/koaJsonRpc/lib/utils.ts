/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import type { Server } from 'http';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';

export function hasOwnProperty(obj: any, prop: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function setServerTimeout(server: Server): void {
  const requestTimeoutMs = parseInt(process.env.SERVER_REQUEST_TIMEOUT_MS ?? '60000');
  server.setTimeout(requestTimeoutMs);
}

export function getBatchRequestsMaxSize(): number {
  return parseInt(process.env.BATCH_REQUESTS_MAX_SIZE ?? '100');
}

export function getLimitDuration(): number {
  return parseInt(process.env.LIMIT_DURATION ?? constants.DEFAULT_RATE_LIMIT.DURATION.toString());
}

export function getDefaultRateLimit(): number {
  return parseInt(process.env.DEFAULT_RATE_LIMIT ?? '200');
}

export function getRequestIdIsOptional(): boolean {
  return process.env.REQUEST_ID_IS_OPTIONAL == 'true';
}

export function getBatchRequestsEnabled(): boolean {
  return process.env.BATCH_REQUESTS_ENABLED == 'true';
}
