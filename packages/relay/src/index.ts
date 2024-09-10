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
  blockNumber(requestDetails: IRequestDetails): Promise<string>;

  call(call: any, blockParam: string | object | null, requestDetails: IRequestDetails): Promise<string | JsonRpcError>;

  coinbase(requestDetails: IRequestDetails): JsonRpcError;

  estimateGas(
    transaction: IContractCallRequest,
    blockParam: string | null,
    requestDetails: IRequestDetails,
  ): Promise<string | JsonRpcError>;

  gasPrice(requestDetails: IRequestDetails): Promise<string>;

  getBalance(account: string, blockNumber: string | null, requestDetails: IRequestDetails): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean, requestDetails: IRequestDetails): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean, requestDetails: IRequestDetails): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string, requestDetails: IRequestDetails): Promise<string | null>;

  getBlockTransactionCountByNumber(blockNum: string, requestDetails: IRequestDetails): Promise<string | null>;

  getCode(address: string, blockNumber: string | null, requestDetails: IRequestDetails): Promise<string>;

  chainId(requestDetails: IRequestDetails): string;

  getLogs(
    blockHash: string | null,
    fromBlock: string | null,
    toBlock: string | null,
    address: string | string[] | null,
    topics: any[] | null,
    requestDetails: IRequestDetails,
  ): Promise<Log[]>;

  getStorageAt(
    address: string,
    slot: string,
    requestDetails: IRequestDetails,
    blockNumber: string | null,
  ): Promise<string>;

  getTransactionByBlockHashAndIndex(
    hash: string,
    index: string,
    requestDetails: IRequestDetails,
  ): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(
    blockNum: string,
    index: string,
    requestDetails: IRequestDetails,
  ): Promise<Transaction | null>;

  getTransactionByHash(hash: string, requestDetails: IRequestDetails): Promise<Transaction | null>;

  getTransactionCount(
    address: string,
    blockNum: string,
    requestDetails: IRequestDetails,
  ): Promise<string | JsonRpcError>;

  getTransactionReceipt(hash: string, requestDetails: IRequestDetails): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(requestDetails: IRequestDetails): Promise<any>;

  getUncleByBlockNumberAndIndex(requestDetails: IRequestDetails): Promise<any>;

  getUncleCountByBlockHash(requestDetails: IRequestDetails): Promise<string>;

  getUncleCountByBlockNumber(requestDetails: IRequestDetails): Promise<string>;

  getWork(requestDetails: IRequestDetails): JsonRpcError;

  feeHistory(
    blockCount: number,
    newestBlock: string,
    rewardPercentiles: Array<number> | null,
    requestDetails: IRequestDetails,
  ): Promise<any>;

  hashrate(requestDetails: IRequestDetails): Promise<string>;

  maxPriorityFeePerGas(requestDetails: IRequestDetails): Promise<string>;

  mining(requestDetails: IRequestDetails): Promise<boolean>;

  protocolVersion(requestDetails: IRequestDetails): JsonRpcError;

  sendRawTransaction(transaction: string, requestDetails: IRequestDetails): Promise<string | JsonRpcError>;

  sendTransaction(requestDetails: IRequestDetails): JsonRpcError;

  sign(requestDetails: IRequestDetails): JsonRpcError;

  signTransaction(requestDetails: IRequestDetails): JsonRpcError;

  submitHashrate(requestDetails: IRequestDetails): JsonRpcError;

  submitWork(requestDetails: IRequestDetails): Promise<boolean>;

  syncing(requestDetails: IRequestDetails): Promise<boolean>;

  accounts(requestDetails: IRequestDetails): Array<any>;

  filterService(): IFilterService;

  debugService(): IDebugService;
}
