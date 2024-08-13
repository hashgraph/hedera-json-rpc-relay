/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import { RLP } from '@ethereumjs/rlp';
import { Trie } from '@ethereumjs/trie';
import { bytesToInt, concatBytes, hexToBytes, intToBytes, intToHex } from '@ethereumjs/util';
import { EthImpl } from './lib/eth';
import { prepend0x } from './formatters';
import { Log } from './lib/model';
import { ITransactionReceipt } from './lib/types/ITransactionReceipt';
import { LogsBloomUtils } from './logsBloomUtils';

/**
 * A {Log} serialized as a tuple containing:
 * - {Uint8Array} address
 * - {Uint8Array[]} topics
 * - {Uint8Array} data
 */
type SerializedLog = [Uint8Array, Uint8Array[], Uint8Array];

export class ReceiptsRootUtils {
  private static encodeLogs(logs: Log[]): SerializedLog[] {
    const serializedLogs: SerializedLog[] = [];
    for (let i = 0; i < logs.length; i++) {
      const topics: Uint8Array[] = [];
      for (let j = 0; j < logs[i].topics.length; j++) {
        topics.push(hexToBytes(logs[i].topics[j]));
      }
      serializedLogs.push([hexToBytes(logs[i].address), topics, hexToBytes(logs[i].data)]);
    }

    return serializedLogs;
  }

  private static encodeReceipt(receipt: ITransactionReceipt, txType: number): Uint8Array {
    let receiptRoot: Uint8Array;
    if (receipt.root) {
      receiptRoot = hexToBytes(receipt.root);
    } else if (bytesToInt(hexToBytes(receipt.status)) === 0) {
      receiptRoot = Uint8Array.from([]);
    } else {
      receiptRoot = hexToBytes(EthImpl.oneHex);
    }

    const encodedReceipt: Uint8Array = RLP.encode([
      receiptRoot,
      hexToBytes(receipt.cumulativeGasUsed),
      hexToBytes(receipt.logsBloom),
      this.encodeLogs(receipt.logs),
    ]);

    // legacy transactions
    if (txType === 0) {
      return encodedReceipt;
    }

    // EIP-2718 serialization
    return concatBytes(intToBytes(txType), encodedReceipt);
  }

  public static buildReceiptsFromTxHashesContractResultsAndLogs(txHashes, contractResults, logs) {
    const receipts: any = [];

    for (let i in txHashes) {
      const txHash = txHashes[i];
      const logsPerTx = logs.filter((el) => el.transactionHash == txHash);
      const crPerTx = contractResults.filter((el) => el.hash == txHash);
      receipts.push({
        transactionIndex: logsPerTx[0].transactionIndex,
        type: crPerTx.length ? intToHex(crPerTx[0].type) : null,
        root: crPerTx.length ? crPerTx[0].root : EthImpl.zeroHex32Byte,
        status: crPerTx.length ? crPerTx[0].status : EthImpl.oneHex,
        cumulativeGasUsed: crPerTx.length ? intToHex(crPerTx[0].block_gas_used) : EthImpl.zeroHex,
        logsBloom: crPerTx.length
          ? crPerTx[0].bloom
          : LogsBloomUtils.buildLogsBloom(logs[0].address, logsPerTx[0].topics),
        logs: logsPerTx.map((log) => {
          return {
            address: log.address,
            data: log.data,
            topics: log.topics,
          };
        }),
      });
    }
    return receipts;
  }

  public static async getRootHash(receipts: ITransactionReceipt[]): Promise<string> {
    if (!receipts.length) {
      return EthImpl.zeroHex32Byte;
    }

    const trie: Trie = new Trie();
    receipts.map(async (receipt) => {
      // key of the element that is being added to the trie
      const path: Uint8Array =
        receipt.transactionIndex === EthImpl.zeroHex
          ? RLP.encode(Buffer.alloc(0))
          : RLP.encode(bytesToInt(hexToBytes(receipt.transactionIndex ?? EthImpl.zeroHex)));
      await trie.put(path, this.encodeReceipt(receipt, bytesToInt(hexToBytes(receipt.type ?? EthImpl.zeroHex))));
    });

    trie.checkpoint();
    await trie.commit();

    return prepend0x(Buffer.from(trie.root()).toString('hex'));
  }
}
