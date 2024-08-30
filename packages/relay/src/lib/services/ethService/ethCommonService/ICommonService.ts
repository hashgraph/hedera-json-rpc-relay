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
import { Log } from '../../../model';

export interface ICommonService {
  blockTagIsLatestOrPending(tag: any): boolean;

  validateBlockRangeAndAddTimestampToParams(
    params: any,
    fromBlock: string,
    toBlock: string,
    requestIdPrefix?: string,
    address?: string | string[] | null,
  ): Promise<boolean>;

  getHistoricalBlockResponse(
    requestIdPrefix: string,
    blockNumberOrTag?: string | null,
    returnLatest?: boolean,
  ): Promise<any>;

  getLatestBlockNumber(requestIdPrefix?: string): Promise<string>;

  genericErrorHandler(error: any, logMessage?: string): void;

  validateBlockHashAndAddTimestampToParams(params: any, blockHash: string, requestIdPrefix?: string): Promise<boolean>;

  addTopicsToParams(params: any, topics: any[] | null): void;

  getLogsByAddress(address: string | [string], params: any, requestIdPrefix): Promise<any>;

  getLogsWithParams(address: string | [string] | null, param, requestIdPrefix: string): Promise<Log[]>;

  getLogs(
    blockHash: string | null,
    fromBlock: string | 'latest',
    toBlock: string | 'latest',
    address: string | [string] | null,
    topics: any[] | null,
    requestIdPrefix?: string,
  ): Promise<Log[]>;
}
