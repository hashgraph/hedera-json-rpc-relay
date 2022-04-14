export { BridgeImpl } from './lib/bridge';

export interface Bridge {
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
  blockNumber(): number;

  call(call: any, blockParam: string): Promise<string>;

  // coinbase();
  estimateGas(): number;

  gasPrice(): number;

  getBalance(account: string): Promise<string>;

  getBlockByHash(hash: string): any;

  getBlockByNumber(blockNum: number): any;

  // getBlockTransactionCountByHash();
  // getBlockTransactionCountByNumber();
  getCode(): string;

  chainId(): string;

  // getLogs();
  // getStorageAt();
  // getTransactionByBlockHashAndIndex();
  // getTransactionByBLockNumberAndIndex();
  // getTransactionByHash();
  getTransactionCount(): number;

  getTransactionReceipt(hash: string): Promise<any>;

  getUncleByBlockHashAndIndex(): Promise<any>;
  getUncleByBlockNumberAndIndex(): Promise<any>;
  getUncleCountByBlockHash(): Promise<string>;
  getUncleCountByBlockNumber(): Promise<string>;
  // getWork();
  feeHistory(): any;

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

  accounts(): Array<any>
}
