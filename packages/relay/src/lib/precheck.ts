/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import * as ethers from 'ethers';
import { predefined } from './errors';
import { MirrorNodeClient } from './clients';
import {BigNumber} from "ethers";

export class Precheck {
  private mirrorNodeClient: MirrorNodeClient;

  constructor(mirrorNodeClient: MirrorNodeClient) {
    this.mirrorNodeClient = mirrorNodeClient;
  }

  /**
   * @param transaction
   */
  async nonce(transaction: string) {
    const tx = ethers.utils.parseTransaction(transaction);
    const rsTx = await ethers.utils.resolveProperties({
      gasPrice: tx.gasPrice,
      gasLimit: tx.gasLimit,
      value: tx.value,
      nonce: tx.nonce,
      data: tx.data,
      chainId: tx.chainId,
      to: tx.to
    });
    const raw = ethers.utils.serializeTransaction(rsTx);
    const recoveredAddress = ethers.utils.recoverAddress(
      ethers.utils.arrayify(ethers.utils.keccak256(raw)),
      // @ts-ignore
      ethers.utils.joinSignature({ 'r': tx.r, 's': tx.s, 'v': tx.v })
    );
    const accountInfo = await this.mirrorNodeClient.getAccount(recoveredAddress);

    // @ts-ignore
    if (accountInfo && accountInfo.ethereum_nonce > tx.nonce) {
      throw predefined.NONCE_TOO_LOW;
    }
  }

  /**
   * @param transaction
   */
  async gasLimit(transaction: string) {
    const BLOCK_GAS_LIMIT: BigNumber = BigNumber.from(15_000_000);

    const tx = ethers.utils.parseTransaction(transaction);

    const intrinsicGasCost = this.transactionIntrinsicGasCost(tx.data, tx.to);

    if (tx.gasLimit > BLOCK_GAS_LIMIT) {
      throw predefined.GAS_LIMIT_TOO_HIGH;
    } else if (tx.gasLimit < intrinsicGasCost) {
      throw predefined.GAS_LIMIT_TOO_LOW;
    }

    // @ts-ignore
    if (accountInfo && accountInfo.ethereum_nonce > tx.nonce) {
      throw predefined.NONCE_TOO_LOW;
    }
  }

  private transactionIntrinsicGasCost(data: string, to: string|undefined) {
    const TX_DATA_ZERO_COST = 4;
    const ISTANBUL_TX_DATA_NON_ZERO_COST = 16;
    const TX_BASE_COST = 21_000;
    const TX_CREATE_EXTRA = 32000;

    const isCreate = (to == undefined) ||(to.length == 0);

    let zeros = 0;

    const dataBytes = Buffer.from(data, "hex");

    for (let i=0; i<dataBytes.length; i++) {
      if (dataBytes[i] == 0) {
        zeros++;
      }
    }

    const nonZeros = data.length - zeros;
    const cost = TX_BASE_COST + TX_DATA_ZERO_COST * zeros + ISTANBUL_TX_DATA_NON_ZERO_COST * nonZeros;

    return BigNumber.from(isCreate ? cost + TX_CREATE_EXTRA : cost);
  }
}
