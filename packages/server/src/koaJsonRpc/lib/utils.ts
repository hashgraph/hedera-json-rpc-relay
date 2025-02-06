/*-
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

import type { Server } from 'http';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

export function hasOwnProperty(obj: any, prop: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function setServerTimeout(server: Server): void {
  const requestTimeoutMs = ConfigService.get('SERVER_REQUEST_TIMEOUT_MS');
  server.setTimeout(requestTimeoutMs);
}

export function getBatchRequestsMaxSize(): number {
  return ConfigService.get('BATCH_REQUESTS_MAX_SIZE');
}

export function getLimitDuration(): number {
  return ConfigService.get('LIMIT_DURATION');
}

export function getDefaultRateLimit(): number {
  return ConfigService.get('DEFAULT_RATE_LIMIT');
}

export function getRequestIdIsOptional(): boolean {
  return ConfigService.get('REQUEST_ID_IS_OPTIONAL');
}

export function getBatchRequestsEnabled(): boolean {
  return ConfigService.get('BATCH_REQUESTS_ENABLED');
}
