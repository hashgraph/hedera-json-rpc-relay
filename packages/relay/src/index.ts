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
import { IContractCallRequest, RequestDetails } from './lib/types';
import { JsonRpcError, predefined } from './lib/errors/JsonRpcError';
import WebSocketError from './lib/errors/WebSocketError';
import { MirrorNodeClientError } from './lib/errors/MirrorNodeClientError';
import { MirrorNodeClient } from './lib/clients';
import { IFilterService } from './lib/services/ethService/ethFilterService/IFilterService';
import { IDebugService } from './lib/services/debugService/IDebugService';

export { JsonRpcError, predefined, MirrorNodeClientError, WebSocketError };

export { RelayImpl } from './lib/relay';

export interface Relay {
  web3(): Web3;

  net(): Net;

  eth(): Eth;

  subs(): Subs | undefined;

  mirrorClient(): MirrorNodeClient;

  populatePreconfiguredSpendingPlans(): Promise<void>;
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
  blockNumber(requestDetails: RequestDetails): Promise<string>;

  call(call: any, blockParam: string | object | null, requestDetails: RequestDetails): Promise<string | JsonRpcError>;

  coinbase(requestDetails: RequestDetails): JsonRpcError;

  estimateGas(
    transaction: IContractCallRequest,
    blockParam: string | null,
    requestDetails: RequestDetails,
  ): Promise<string | JsonRpcError>;

  gasPrice(requestDetails: RequestDetails): Promise<string>;

  getBalance(account: string, blockNumber: string | null, requestDetails: RequestDetails): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean, requestDetails: RequestDetails): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean, requestDetails: RequestDetails): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string, requestDetails: RequestDetails): Promise<string | null>;

  getBlockTransactionCountByNumber(blockNum: string, requestDetails: RequestDetails): Promise<string | null>;

  getCode(address: string, blockNumber: string | null, requestDetails: RequestDetails): Promise<string>;

  chainId(requestDetails: RequestDetails): string;

  getLogs(
    blockHash: string | null,
    fromBlock: string | null,
    toBlock: string | null,
    address: string | string[] | null,
    topics: any[] | null,
    requestDetails: RequestDetails,
  ): Promise<Log[]>;

  getStorageAt(
    address: string,
    slot: string,
    requestDetails: RequestDetails,
    blockNumber: string | null,
  ): Promise<string>;

  getTransactionByBlockHashAndIndex(
    hash: string,
    index: string,
    requestDetails: RequestDetails,
  ): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(
    blockNum: string,
    index: string,
    requestDetails: RequestDetails,
  ): Promise<Transaction | null>;

  getTransactionByHash(hash: string, requestDetails: RequestDetails): Promise<Transaction | null>;

  getTransactionCount(
    address: string,
    blockNum: string,
    requestDetails: RequestDetails,
  ): Promise<string | JsonRpcError>;

  getTransactionReceipt(hash: string, requestDetails: RequestDetails): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(requestDetails: RequestDetails): Promise<any>;

  getUncleByBlockNumberAndIndex(requestDetails: RequestDetails): Promise<any>;

  getUncleCountByBlockHash(requestDetails: RequestDetails): Promise<string>;

  getUncleCountByBlockNumber(requestDetails: RequestDetails): Promise<string>;

  getWork(requestDetails: RequestDetails): JsonRpcError;

  feeHistory(
    blockCount: number,
    newestBlock: string,
    rewardPercentiles: Array<number> | null,
    requestDetails: RequestDetails,
  ): Promise<any>;

  hashrate(requestDetails: RequestDetails): Promise<string>;

  maxPriorityFeePerGas(requestDetails: RequestDetails): Promise<string>;

  mining(requestDetails: RequestDetails): Promise<boolean>;

  protocolVersion(requestDetails: RequestDetails): JsonRpcError;

  sendRawTransaction(transaction: string, requestDetails: RequestDetails): Promise<string | JsonRpcError>;

  sendTransaction(requestDetails: RequestDetails): JsonRpcError;

  sign(requestDetails: RequestDetails): JsonRpcError;

  signTransaction(requestDetails: RequestDetails): JsonRpcError;

  submitHashrate(requestDetails: RequestDetails): JsonRpcError;

  submitWork(requestDetails: RequestDetails): Promise<boolean>;

  syncing(requestDetails: RequestDetails): Promise<boolean>;

  accounts(requestDetails: RequestDetails): Array<any>;

  filterService(): IFilterService;

  debugService(): IDebugService;
}
