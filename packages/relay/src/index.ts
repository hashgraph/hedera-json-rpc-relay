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

import { Block, Log, Receipt, Transaction } from './lib/model';
import { IContractCallRequest } from './lib/types';
import { JsonRpcError, predefined } from './lib/errors/JsonRpcError';
import WebSocketError from './lib/errors/WebSocketError';
import { MirrorNodeClientError } from './lib/errors/MirrorNodeClientError';
import { MirrorNodeClient } from './lib/clients';
import { IFilterService } from './lib/services/ethService/ethFilterService/IFilterService';
import { IDebugService } from './lib/services/debugService/IDebugService';
import { IRequestDetails } from '../src/lib/types/IRequestDetails';

export { JsonRpcError, predefined, MirrorNodeClientError, WebSocketError };

export { RelayImpl } from './lib/relay';

export interface Relay {
  web3(): Web3;

  net(): Net;

  eth(): Eth;

  subs(): Subs | undefined;

  mirrorClient(): MirrorNodeClient;
}

export interface Subs {
  generateId(): string;

  subscribe(connection, event: string, filters?: {}): string;

  unsubscribe(connection, subscriptionId?: string): number;
}

export interface Web3 {
  clientVersion(): string;
}

export interface Net {
  listening(): boolean;

  version(): string;
}

export interface Eth {
  blockNumber(requestIdPrefix: string): Promise<string>;

  call(call: any, blockParam: string | object | null, requestDetails: IRequestDetails): Promise<string | JsonRpcError>;

  coinbase(requestId?: string): JsonRpcError;

  estimateGas(
    transaction: IContractCallRequest,
    blockParam: string | null,
    requestId?: string,
  ): Promise<string | JsonRpcError>;

  gasPrice(requestDetails: IRequestDetails): Promise<string>;

  getBalance(account: string, blockNumber: string | null, requestIdPrefix: string): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean, requestDetails: IRequestDetails): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean, requestDetails: IRequestDetails): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string, requestIdPrefix: string): Promise<string | null>;

  getBlockTransactionCountByNumber(blockNum: string, requestIdPrefix: string): Promise<string | null>;

  getCode(address: string, blockNumber: string | null, requestDetails: IRequestDetails): Promise<string>;

  chainId(requestId?: string): string;

  getLogs(
    blockHash: string | null,
    fromBlock: string | null,
    toBlock: string | null,
    address: string | string[] | null,
    topics: any[] | null,
    requestId?: string,
  ): Promise<Log[]>;

  getStorageAt(requestIdPrefix: string, address: string, slot: string, blockNumber: string | null): Promise<string>;

  getTransactionByBlockHashAndIndex(hash: string, index: string, requestId?: string): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(
    blockNum: string,
    index: string,
    requestIdPrefix: string,
  ): Promise<Transaction | null>;

  getTransactionByHash(hash: string, requestIdPrefix: string): Promise<Transaction | null>;

  getTransactionCount(address: string, blockNum: string, requestIdPrefix: string): Promise<string | JsonRpcError>;

  getTransactionReceipt(hash: string, requestDetails: IRequestDetails): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(requestId?: string): Promise<any>;

  getUncleByBlockNumberAndIndex(requestId?: string): Promise<any>;

  getUncleCountByBlockHash(requestId?: string): Promise<string>;

  getUncleCountByBlockNumber(requestId?: string): Promise<string>;

  getWork(requestId?: string): JsonRpcError;

  feeHistory(
    blockCount: number,
    newestBlock: string,
    rewardPercentiles: Array<number> | null,
    requestDetails: IRequestDetails,
  ): Promise<any>;

  hashrate(requestId?: string): Promise<string>;

  maxPriorityFeePerGas(requestId?: string): Promise<string>;

  mining(requestId?: string): Promise<boolean>;

  protocolVersion(requestId?: string): JsonRpcError;

  sendRawTransaction(transaction: string, requestDetails: IRequestDetails): Promise<string | JsonRpcError>;

  sendTransaction(requestId?: string): JsonRpcError;

  sign(requestId?: string): JsonRpcError;

  signTransaction(requestId?: string): JsonRpcError;

  submitHashrate(requestId?: string): JsonRpcError;

  submitWork(requestId?: string): Promise<boolean>;

  syncing(requestId?: string): Promise<boolean>;

  accounts(requestId?: string): Array<any>;

  filterService(): IFilterService;

  debugService(): IDebugService;
}
