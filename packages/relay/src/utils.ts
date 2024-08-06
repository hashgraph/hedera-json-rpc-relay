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

import { PrivateKey } from '@hashgraph/sdk';
import constants from './lib/constants';
import { keccak256 } from 'ethers';
import { prepend0x, strip0x } from './formatters';
import { EthImpl } from './lib/eth';

export class Utils {
  public static readonly addPercentageBufferToGasPrice = (gasPrice: number): number => {
    // converting to tinybar and afterward to weibar again is needed
    // in order to handle the possibility of an invalid floating number being calculated as a gas price
    // e.g.
    //   current gas price = 126
    //   buffer = 10%
    //   buffered gas price = 126 + 12.6 = 138.6 <--- invalid tinybars
    gasPrice +=
      Math.round(
        (gasPrice / constants.TINYBAR_TO_WEIBAR_COEF) * (Number(process.env.GAS_PRICE_PERCENTAGE_BUFFER || 0) / 100),
      ) * constants.TINYBAR_TO_WEIBAR_COEF;

    return gasPrice;
  };

  /**
   * @param operatorMainKey
   * @returns PrivateKey
   */
  public static createPrivateKeyBasedOnFormat(operatorMainKey: string): PrivateKey {
    switch (process.env.OPERATOR_KEY_FORMAT) {
      case 'DER':
      case undefined:
      case null:
        return PrivateKey.fromStringDer(operatorMainKey);
      case 'HEX_ED25519':
        return PrivateKey.fromStringED25519(operatorMainKey);
      case 'HEX_ECDSA':
        return PrivateKey.fromStringECDSA(operatorMainKey);
      default:
        throw new Error(`Invalid OPERATOR_KEY_FORMAT provided: ${process.env.OPERATOR_KEY_FORMAT}`);
    }
  }

  /**
   * Generate logs bloom for synthetic transaction
   * @param address
   * @param topics
   */
  public static createSyntheticLogsBloom(address: string, topics: string[]): string {
    if (!topics.length) {
      return EthImpl.emptyBloom;
    }

    const items = [address, ...topics];
    const BYTE_SIZE = 256;
    const MASK = 0x7ff;
    const bitvector = new Uint8Array(BYTE_SIZE);
    for (let k = 0; k < items.length; k++) {
      const item = Buffer.alloc(32, strip0x(keccak256(items[k])), 'hex');
      for (let i = 0; i < 3; i++) {
        const first2bytes = new DataView(item.buffer).getUint16(i * 2);
        const loc = MASK & first2bytes;
        const byteLoc = loc >> 3;
        const bitLoc = 1 << loc % 8;
        bitvector[BYTE_SIZE - byteLoc - 1] |= bitLoc;
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

    let match = true;
    for (let i = 0; i < 3 && match; i++) {
      const first2bytes = new DataView(itemBuf.buffer).getUint16(i * 2);
      const loc = MASK & first2bytes;
      const byteLoc = loc >> 3;
      const bitLoc = 1 << loc % 8;
      match = (bitvectorUint8Arr[BYTE_SIZE - byteLoc - 1] & bitLoc) !== 0;
    }

    return Boolean(match);
  }
}
