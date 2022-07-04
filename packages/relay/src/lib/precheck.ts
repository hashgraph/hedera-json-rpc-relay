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
import {EthImpl} from "./eth";
import {Logger} from "pino";

export class Precheck {
  private mirrorNodeClient: MirrorNodeClient;
  private chain: string;
  private readonly logger: Logger;

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, chainId: string) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.chain = chainId;
    this.logger = logger;
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

  chainId(transaction: string) {
    const tx = ethers.utils.parseTransaction(transaction);
    const txChainId = EthImpl.prepend0x(Number(tx.chainId).toString(16));
    const passes = txChainId === this.chain;
    if (!passes) {
      this.logger.trace('Failed chainId precheck for sendRawTransaction(transaction=%s, chainId=%s)', transaction, txChainId);
    }

    return {
      passes,
      chainId: txChainId
    };
  }

  gasPrice(transaction: string, gasPrice: number) {
    const tx = ethers.utils.parseTransaction(transaction);
    const minGasPrice = ethers.ethers.BigNumber.from(gasPrice);
    const txGasPrice = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const passes = txGasPrice.gte(minGasPrice);

    if (!passes) {
      this.logger.trace('Failed gas price precheck for sendRawTransaction(transaction=%s, gasPrice=%s, requiredGasPrice=%s)', transaction, txGasPrice, minGasPrice);
    }

    return {
      passes,
      error: predefined.GAS_PRICE_TOO_LOW
    }
  }
}
