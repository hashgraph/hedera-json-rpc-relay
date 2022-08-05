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
}

export interface Web3 {
  clientVersion(): string;
}

export interface Net {
  listening(): boolean;

  version(): string;
}

export interface Eth {

  blockNumber(requestId?: number): Promise<string>;

  call(call: any, blockParam: string | null, requestId?: number): Promise<string | JsonRpcError>;

  coinbase(requestId?: number): JsonRpcError;

  estimateGas(transaction:any, blockParam: string| null, requestId?: number): Promise<string>;

  gasPrice(requestId?: number): Promise<string>;

  getBalance(account: string, blockNumber: string | null, requestId?: number): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean, requestId?: number): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean, requestId?: number): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string, requestId?: number): Promise<string | null>;

  getBlockTransactionCountByNumber(blockNum: string, requestId?: number): Promise<string | null>
  
  getCode(address: string, blockNumber: string | null, requestId?: number): Promise<string>;

  chainId(requestId?: number): string;

  getLogs(blockHash: string|null, fromBlock: string|null, toBlock: string|null, address: string|null, topics: any[]|null, requestId?: number): Promise<Log[]>;

  getStorageAt(address: string, slot: string, blockNumber: string|null, requestId?: number): JsonRpcError;

  getTransactionByBlockHashAndIndex(hash: string, index: number, requestId?: number): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(blockNum: string, index: number, requestId?: number): Promise<Transaction | null>;

  getTransactionByHash(hash: string, requestId?: number): Promise<Transaction | null>;
  
  getTransactionCount(address: string, blocknum: string, requestId?: number): Promise<string | JsonRpcError>;

  getTransactionReceipt(hash: string, requestId?: number): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(requestId?: number): Promise<any>;

  getUncleByBlockNumberAndIndex(requestId?: number): Promise<any>;

  getUncleCountByBlockHash(requestId?: number): Promise<string>;

  getUncleCountByBlockNumber(requestId?: number): Promise<string>;

  getWork(requestId?: number): JsonRpcError;

  feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number>|null, requestId?: number): Promise<any>;

  hashrate(requestId?: number): Promise<string>;

  mining(requestId?: number): Promise<boolean>;

  protocolVersion(requestId?: number): JsonRpcError;

  sendRawTransaction(transaction: string, requestId?: number): Promise<string | JsonRpcError>;

  sendTransaction(requestId?: number): JsonRpcError;

  sign(requestId?: number): JsonRpcError;

  signTransaction(requestId?: number): JsonRpcError;

  submitHashrate(requestId?: number): JsonRpcError;

  submitWork(requestId?: number): Promise<boolean>;

  syncing(requestId?: number): Promise<boolean>;

  accounts(requestId?: number): Array<any>;
}
