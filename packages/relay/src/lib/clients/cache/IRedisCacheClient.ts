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

import type { ICacheClient } from './ICacheClient';
import { RequestDetails } from '../../types';

export interface IRedisCacheClient extends ICacheClient {
  disconnect: () => Promise<void>;
  incrBy(key: string, amount: number, callingMethod: string, requestDetails: RequestDetails): Promise<number>;
  rPush(key: string, value: any, callingMethod: string, requestDetails: RequestDetails): Promise<number>;
  lRange(
    key: string,
    start: number,
    end: number,
    callingMethod: string,
    requestDetails: RequestDetails,
  ): Promise<any[]>;
}
