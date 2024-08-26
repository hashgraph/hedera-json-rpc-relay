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
import { LogsBloomUtils } from './logsBloomUtils';

/**
 * A {Log} serialized as a tuple containing:
 * - {Uint8Array} address
 * - {Uint8Array[]} topics
 * - {Uint8Array} data
 */
export type SerializedLog = [Uint8Array, Uint8Array[], Uint8Array];

export interface IReceiptRootHashLog {
  address: string;
  data: string;
  topics: string[];
}

export interface IReceiptRootHash {
  cumulativeGasUsed: string;
  logs: IReceiptRootHashLog[];
  logsBloom: string;
  root: string;
  status: string;
  transactionIndex: string;
  type: string | null; // null for HAPI transactions
}

export class ReceiptsRootUtils {
  private static encodeLogs(logs: IReceiptRootHashLog[]): SerializedLog[] {
    const serializedLogs: SerializedLog[] = [];
    for (const log of logs) {
      const topics: Uint8Array[] = [];
      for (const topic of log.topics) {
        topics.push(hexToBytes(topic));
      }
      serializedLogs.push([hexToBytes(log.address), topics, hexToBytes(log.data)]);
    }

    return serializedLogs;
  }

  private static encodeReceipt(receipt: IReceiptRootHash, txType: number): Uint8Array {
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

  public static buildReceiptRootHashes(txHashes: string[], contractResults: any[], logs: Log[]): IReceiptRootHash[] {
    const receipts: IReceiptRootHash[] = [];

    for (let i in txHashes) {
      const txHash: string = txHashes[i];
      const logsPerTx: Log[] = logs.filter((log) => log.transactionHash == txHash);
      const crPerTx: any[] = contractResults.filter((cr) => cr.hash == txHash);
      receipts.push({
        transactionIndex: crPerTx.length ? intToHex(crPerTx[0].transaction_index) : logsPerTx[0].transactionIndex,
        type: crPerTx.length && crPerTx[0].type ? intToHex(crPerTx[0].type) : null,
        root: crPerTx.length ? crPerTx[0].root : EthImpl.zeroHex32Byte,
        status: crPerTx.length ? crPerTx[0].status : EthImpl.oneHex,
        cumulativeGasUsed: crPerTx.length ? intToHex(crPerTx[0].block_gas_used) : EthImpl.zeroHex,
        logsBloom: crPerTx.length
          ? crPerTx[0].bloom
          : LogsBloomUtils.buildLogsBloom(logs[0].address, logsPerTx[0].topics),
        logs: logsPerTx.map((log: IReceiptRootHashLog) => {
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

  public static async getRootHash(receipts: IReceiptRootHash[]): Promise<string> {
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
