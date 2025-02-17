// SPDX-License-Identifier: Apache-2.0

import { Transaction } from './model';

export class ModelConverter {
  static zeroHex = '0x0';
  static oneHex = '0x1';
  static typeTwoTransactionHex = '0x2';
  static defaultTxGasHex = '0x4194304'; // 400k

  static createTransactionFromLog(log, chainId) {
    return new Transaction({
      accessList: undefined, // we don't support access lists for now
      blockHash: log.blockHash,
      blockNumber: log.blockNumber,
      chainId: chainId,
      from: log.address,
      gas: ModelConverter.defaultTxGasHex,
      gasPrice: undefined,
      hash: log.transactionHash,
      input: ModelConverter.zeroHex,
      maxPriorityFeePerGas: undefined,
      maxFeePerGas: undefined,
      nonce: ModelConverter.zeroHex,
      r: undefined,
      s: undefined,
      to: log.address,
      transactionIndex: log.transactionIndex,
      type: ModelConverter.typeTwoTransactionHex, // 0x0 for legacy transactions, 0x1 for access list types, 0x2 for dynamic fees.
      v: undefined,
      value: ModelConverter.zeroHex,
    });
  }
}
