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

export interface ICacheClient {
  get(key: string, callingMethod: string, requestIdPrefix?: string): any;
  set(key: string, value: any, callingMethod: string, ttl?: number, requestIdPrefix?: string): void;
  delete(key: string, callingMethod: string, requestIdPrefix?: string): void;
  clear(): void;
  multiSet(keyValuePairs: Record<string, any>, callingMethod: string, requestIdPrefix?: string): void;
  pipelineSet(
    keyValuePairs: Record<string, any>,
    callingMethod: string,
    ttl?: number | undefined,
    requestIdPrefix?: string,
  ): void;
  disconnect(): Promise<void> | void;
}
