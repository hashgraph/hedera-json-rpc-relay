import type { Log } from '../model';

export interface ITransactionReceipt {
  blockHash: string;
  blockNumber: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  from: string;
  gasUsed: string;
  logs: Log[];
  logsBloom: string;
  root: string;
  status: string;
  to: string;
  transactionHash: string;
  transactionIndex: string | null;
  type: string | null;
  revertReason?: string;
}
