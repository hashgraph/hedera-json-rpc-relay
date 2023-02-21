/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import { JsonRpcError, predefined } from './lib/errors/JsonRpcError';
import { MirrorNodeClientError } from './lib/errors/MirrorNodeClientError';

export { JsonRpcError, predefined, MirrorNodeClientError };

export { RelayImpl } from './lib/relay';

export interface Relay {
  web3(): Web3;

  net(): Net;

  eth(): Eth;

  subs(): Subs;
}

export interface Subs {
  subscribe(connection, uri): string;

  unsubscribe(connection, uri): boolean;
}

export interface Web3 {
  clientVersion(): string;
}

export interface Net {
  listening(): boolean;

  version(): string;
}

export interface Eth {

  blockNumber(requestId?: string): Promise<string>;

  call(call: any, blockParam: string | null, requestId?: string): Promise<string | JsonRpcError>;

  coinbase(requestId?: string): JsonRpcError;

  estimateGas(transaction:any, blockParam: string| null, requestId?: string): Promise<string>;

  gasPrice(requestId?: string): Promise<string>;

  getBalance(account: string, blockNumber: string | null, requestId?: string): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean, requestId?: string): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean, requestId?: string): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string, requestId?: string): Promise<string | null>;

  getBlockTransactionCountByNumber(blockNum: string, requestId?: string): Promise<string | null>

  getCode(address: string, blockNumber: string | null, requestId?: string): Promise<string>;

  chainId(requestId?: string): string;

  getLogs(blockHash: string|null, fromBlock: string|null, toBlock: string|null, address: string|null, topics: any[]|null, requestId?: string): Promise<Log[]>;

  getStorageAt(address: string, slot: string, blockNumber: string|null, requestId?: string): Promise<string>;

  getTransactionByBlockHashAndIndex(hash: string, index: string, requestId?: string): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(blockNum: string, index: string, requestId?: string): Promise<Transaction | null>;

  getTransactionByHash(hash: string, requestId?: string): Promise<Transaction | null>;

  getTransactionCount(address: string, blockNum: string, requestId?: string): Promise<string | JsonRpcError>;

  getTransactionReceipt(hash: string, requestId?: string): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(requestId?: string): Promise<any>;

  getUncleByBlockNumberAndIndex(requestId?: string): Promise<any>;

  getUncleCountByBlockHash(requestId?: string): Promise<string>;

  getUncleCountByBlockNumber(requestId?: string): Promise<string>;

  getWork(requestId?: string): JsonRpcError;

  feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number>|null, requestId?: string): Promise<any>;

  hashrate(requestId?: string): Promise<string>;

  maxPriorityFeePerGas(requestId?: string): Promise<string>;

  mining(requestId?: string): Promise<boolean>;

  protocolVersion(requestId?: string): JsonRpcError;

  sendRawTransaction(transaction: string, requestId?: string): Promise<string | JsonRpcError>;

  sendTransaction(requestId?: string): JsonRpcError;

  sign(requestId?: string): JsonRpcError;

  signTransaction(requestId?: string): JsonRpcError;

  submitHashrate(requestId?: string): JsonRpcError;

  submitWork(requestId?: string): Promise<boolean>;

  syncing(requestId?: string): Promise<boolean>;

  accounts(requestId?: string): Array<any>;
}
