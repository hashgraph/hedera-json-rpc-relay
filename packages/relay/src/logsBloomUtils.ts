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

import { keccak256 } from 'ethers';
import { prepend0x, strip0x } from './formatters';
import { EthImpl } from './lib/eth';

export class LogsBloomUtils {
  private static readonly BYTE_SIZE = 256;
  private static readonly MASK = 0x7ff;

  /**
   * Generate logs bloom for synthetic transaction
   * @param address
   * @param topics
   */
  public static buildLogsBloom(address: string, topics: string[]): string {
    if (!address?.length) {
      return EthImpl.emptyBloom;
    }
    if (!topics.length) {
      return EthImpl.emptyBloom;
    }

    const items = [address, ...topics];
    const bitvector = new Uint8Array(this.BYTE_SIZE);
    for (let k = 0; k < items.length; k++) {
      const item = Buffer.alloc(32, strip0x(keccak256(items[k])), 'hex');
      for (let i = 0; i < 3; i++) {
        const first2bytes = new DataView(item.buffer).getUint16(i * 2);
        const loc = this.MASK & first2bytes;
        const byteLoc = loc >> 3;
        const bitLoc = 1 << loc % 8;
        bitvector[this.BYTE_SIZE - byteLoc - 1] |= bitLoc;
      }
    }

    return prepend0x(Buffer.from(bitvector).toString('hex'));
  }

  /**
   * Check whether an item exists in the hex encoded logs bloom bitvector
   * @param item
   * @param bitvector
   */
  public static checkInLogsBloom(item: string, bitvector: string): boolean {
    const bitvectorUint8Arr = Uint8Array.from(Buffer.from(strip0x(bitvector), 'hex'));
    const itemBuf = Buffer.alloc(32, strip0x(keccak256(item)), 'hex');
    const BYTE_SIZE = 256;
    const MASK = 0x7ff;

    let match: boolean = true;
    for (let i = 0; i < 3 && match; i++) {
      const first2bytes = new DataView(itemBuf.buffer).getUint16(i * 2);
      const loc = MASK & first2bytes;
      const byteLoc = loc >> 3;
      const bitLoc = 1 << loc % 8;
      match = (bitvectorUint8Arr[BYTE_SIZE - byteLoc - 1] & bitLoc) !== 0;
    }

    return match;
  }
}
