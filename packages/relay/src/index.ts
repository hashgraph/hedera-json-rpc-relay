<<<<<<< HEAD:packages/bridge/src/index.ts
import {Block, Receipt} from './lib/model';

export { BridgeImpl } from './lib/bridge';
=======
export { RelayImpl } from './lib/relay';
>>>>>>> 0e638ab (Replace bridge and hashio references with relay):packages/relay/src/index.ts

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

  getBlockByNumber(blockNum: number): Promise<Block | null>;

  // getBlockTransactionCountByHash();
  // getBlockTransactionCountByNumber();
  getCode(address: string, blockNumber: string | null): Promise<string>;

  chainId(): string;

  // getLogs();
  // getStorageAt();
  // getTransactionByBlockHashAndIndex();
  // getTransactionByBLockNumberAndIndex();
  // getTransactionByHash();
  getTransactionCount(address: string, blocknum: string): Promise<number>;

  getTransactionReceipt(hash: string): Promise<Receipt | null>;

  getUncleByBlockHashAndIndex(): Promise<any>;

  getUncleByBlockNumberAndIndex(): Promise<any>;

  getUncleCountByBlockHash(): Promise<string>;

  getUncleCountByBlockNumber(): Promise<string>;

  // getWork();
  feeHistory(): Promise<any>;

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
