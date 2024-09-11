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

import { JsonRpcError } from '../../../errors/JsonRpcError';
import { Log } from '../../../model';
import { IRequestDetails } from '../../../types/IRequestDetails';

export interface IFilterService {
  newFilter(
    fromBlock: string,
    toBlock: string,
    requestDetails: IRequestDetails,
    address?: string,
    topics?: any[],
  ): Promise<string | JsonRpcError>;

  newBlockFilter(requestDetails: IRequestDetails): Promise<string | JsonRpcError>;

  uninstallFilter(filterId: string, requestDetails: IRequestDetails): Promise<boolean>;

  newPendingTransactionFilter(requestDetails: IRequestDetails): JsonRpcError;

  getFilterLogs(filterId: string, requestDetails: IRequestDetails): Promise<any>;

  getFilterChanges(filterId: string, requestDetails: IRequestDetails): Promise<string[] | Log[] | JsonRpcError>;
}
