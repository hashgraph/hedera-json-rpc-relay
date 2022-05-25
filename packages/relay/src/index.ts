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

import {Block, Receipt, Transaction} from './lib/model';

export { RelayImpl } from './lib/relay';

export interface Relay {
  web3(): Web3;

  net(): Net;

  eth(): Eth;
}

export interface Web3 {
  clientVersion(): string;

  // sha();
}

export interface Net {
  listening(): boolean;

  peerCount(): number;

  version(): string;
}

export interface Eth {
  // getProof();
  // accounts();
  blockNumber(): Promise<number>;

  call(call: any, blockParam: string): Promise<string>;

  // coinbase();
  estimateGas(): Promise<number>;

  gasPrice(): Promise<number>;

  getBalance(account: string, blockNumber: string | null): Promise<string>;

  getBlockByHash(hash: string, showDetails: boolean): Promise<Block | null>;

  getBlockByNumber(blockNum: string, showDetails: boolean): Promise<Block | null>;

  getBlockTransactionCountByHash(hash: string): Promise<number | null>;

  getBlockTransactionCountByNumber(blockNum: string): Promise<number | null>
  
  getCode(address: string, blockNumber: string | null): Promise<string>;

  chainId(): string;

  // getLogs(fromBlock: string|null, toBlock: string|null, address: string|null, topics: any[]|null);
  // getStorageAt(address: string, slot: string, blockNumber: string|null);

  getTransactionByBlockHashAndIndex(hash: string, index: number): Promise<Transaction | null>;

  getTransactionByBlockNumberAndIndex(blockNum: string, index: number): Promise<Transaction | null>;

  getTransactionByHash(hash: string): Promise<Transaction | null>;
  
  getTransactionCount(address: string, blocknum: string): Promise<number>;

  getTransactionReceipt(hash: string): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(): Promise<any>;

  getUncleByBlockNumberAndIndex(): Promise<any>;

  getUncleCountByBlockHash(): Promise<string>;

  getUncleCountByBlockNumber(): Promise<string>;

  // getWork();
  feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number>|null): Promise<any>;

  hashrate(): Promise<string>;

  mining(): Promise<boolean>;

  // protocolVersion();
  sendRawTransaction(transaction: string): Promise<string>;

  // sendTransaction();
  // sign();
  // signTransaction();
  // signTypedData();
  // submitHashrate();
  submitWork(): Promise<boolean>;

  syncing(): Promise<boolean>;

  accounts(): Array<any>;
}
