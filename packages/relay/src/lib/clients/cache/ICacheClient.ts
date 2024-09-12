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

import { RequestDetails } from '../../types/RequestDetails';

export interface ICacheClient {
  keys(pattern: string, callingMethod: string, requestDetails: RequestDetails): Promise<string[]>;
  get(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<any>;
  set(key: string, value: any, callingMethod: string, requestDetails: RequestDetails, ttl?: number): Promise<void>;
  multiSet(keyValuePairs: Record<string, any>, callingMethod: string, requestDetails: RequestDetails): Promise<void>;
  pipelineSet(
    keyValuePairs: Record<string, any>,
    callingMethod: string,
    requestDetails: RequestDetails,
    ttl?: number | undefined,
  ): Promise<void>;
  delete(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<void>;
  clear(): Promise<void>;
}
