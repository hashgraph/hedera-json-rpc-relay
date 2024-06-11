export interface IFeeHistory {
  baseFeePerGas: string[] | undefined;
  gasUsedRatio: number[] | null;
  oldestBlock: string;
  reward?: string[][];
}
