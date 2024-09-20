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
import crypto from 'crypto';

export class Utils {
  public static readonly IP_ADDRESS_REGEX = /\b((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}\b/g;

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
   * Generates a random trace ID for requests.
   *
   * @returns {string} The generated random trace ID.
   */
  public static generateRequestId = (): string => {
    return crypto.randomUUID();
  };

  /**
   * Estimates the total fee in tinybars for file transactions based on the given call data size,
   * file chunk size, and the current network exchange rate.
   *
   * @param {number} callDataSize - The total size of the call data in bytes.
   * @param {number} fileChunkSize - The size of each file chunk in bytes.
   * @param {number} currentNetworkExchangeRateInCents - The current network exchange rate in cents per HBAR.
   * @returns {number} The estimated transaction fee in tinybars.
   */
  public static estimateFileTransactionsFee(
    callDataSize: number,
    fileChunkSize: number,
    currentNetworkExchangeRateInCents: number,
  ): number {
    const fileCreateTransactions = 1;
    const fileCreateFeeInCents = constants.NETWORK_FEES_IN_CENTS.FILE_CREATE_PER_5_KB;

    // The first chunk goes in with FileCreateTransaciton, the rest are FileAppendTransactions
    const fileAppendTransactions = Math.floor(callDataSize / fileChunkSize) - 1;
    const lastFileAppendChunkSize = callDataSize % fileChunkSize;

    const fileAppendFeeInCents = constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_PER_5_KB;
    const lastFileAppendChunkFeeInCents =
      constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_BASE_FEE +
      lastFileAppendChunkSize * constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_RATE_PER_BYTE;

    const totalTxFeeInCents =
      fileCreateTransactions * fileCreateFeeInCents +
      fileAppendFeeInCents * fileAppendTransactions +
      lastFileAppendChunkFeeInCents;

    const estimatedTxFee = Math.round(
      (totalTxFeeInCents / currentNetworkExchangeRateInCents) * constants.HBAR_TO_TINYBAR_COEF,
    );

    return estimatedTxFee;
  }
}
