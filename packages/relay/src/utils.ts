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
import { EnvProvider } from '@hashgraph/json-rpc-env-provider/dist/services';

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
        (gasPrice / constants.TINYBAR_TO_WEIBAR_COEF) *
          (Number(EnvProvider.get('GAS_PRICE_PERCENTAGE_BUFFER') || 0) / 100),
      ) * constants.TINYBAR_TO_WEIBAR_COEF;

    return gasPrice;
  };

  /**
   * @param operatorMainKey
   * @returns PrivateKey
   */
  public static createPrivateKeyBasedOnFormat(operatorMainKey: string): PrivateKey {
    switch (EnvProvider.get('OPERATOR_KEY_FORMAT')) {
      case 'DER':
      case undefined:
      case null:
        return PrivateKey.fromStringDer(operatorMainKey);
      case 'HEX_ED25519':
        return PrivateKey.fromStringED25519(operatorMainKey);
      case 'HEX_ECDSA':
        return PrivateKey.fromStringECDSA(operatorMainKey);
      default:
        throw new Error(`Invalid OPERATOR_KEY_FORMAT provided: ${EnvProvider.get('OPERATOR_KEY_FORMAT')}`);
    }
  }
}
