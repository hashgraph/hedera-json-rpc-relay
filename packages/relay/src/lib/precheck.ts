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
import {JsonRpcError, predefined} from './errors';
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

  /**
   * @param transaction
   */
  async gasLimit(transaction: string) {
    const BLOCK_GAS_LIMIT = 15_000_000;

    const tx = ethers.utils.parseTransaction(transaction);
    const gasLimit = tx.gasLimit.toNumber();

    const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(tx.data, tx.to);

    if (gasLimit > BLOCK_GAS_LIMIT) {
      this.logger.trace('Failed gasLimit precheck for sendRawTransaction(transaction=%s). Gas Limit was too high: %s, block gas limit: %s', transaction, gasLimit, BLOCK_GAS_LIMIT);
      throw predefined.GAS_LIMIT_TOO_HIGH;
    } else if (gasLimit < intrinsicGasCost) {
      this.logger.trace('Failed gasLimit precheck for sendRawTransaction(transaction=%s). Gas Limit was too low: %s, intrinsic gas cost: %s', transaction, gasLimit, intrinsicGasCost);
      throw predefined.GAS_LIMIT_TOO_LOW;
    }
  }

  private static transactionIntrinsicGasCost(data: string, to: string|undefined) {
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

    return isCreate ? cost + TX_CREATE_EXTRA : cost;
  }

  chainId(transaction: string) {
    const tx = ethers.utils.parseTransaction(transaction);
    const txChainId = EthImpl.prepend0x(Number(tx.chainId).toString(16));
    const passes = txChainId === this.chain;
    if (!passes) {
      this.logger.trace('Failed chainId precheck for sendRawTransaction(transaction=%s, chainId=%s)', transaction, txChainId);
      throw new JsonRpcError({
        name: 'ChainId not supported',
        code: -32000,
        message: `ChainId (${txChainId}) not supported. The correct chainId is ${this.chain}.`
      });
    }
  }
}
