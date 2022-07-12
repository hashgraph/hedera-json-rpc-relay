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
import { MirrorNodeClient, SDKClient } from './clients';
import {EthImpl} from "./eth";
import {Logger} from "pino";
import constants from './constants';

export class Precheck {
  private mirrorNodeClient: MirrorNodeClient;
  private sdkClient: SDKClient;
  private chain: string;
  private readonly logger: Logger;

  constructor(mirrorNodeClient: MirrorNodeClient, sdkClient: SDKClient, logger: Logger, chainId: string) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.sdkClient = sdkClient;
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
      error: predefined.UNSUPPORTED_CHAIN_ID(txChainId, this.chain)
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
    };
  }

  async balance(transaction: string, callerName: string) {
    const result = {
      passes: false,
      error: predefined.INSUFFICIENT_ACCOUNT_BALANCE
    };

    const tx = ethers.utils.parseTransaction(transaction);
    const txGas = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const txTotalValue = tx.value.add(txGas.mul(tx.gasLimit));

    try {
      const { account }: any = await this.mirrorNodeClient.getAccount(tx.from!);
      const tinybars = await this.sdkClient.getAccountBalanceInTinyBar(account, callerName);

      result.passes = ethers.ethers.BigNumber.from(tinybars.toString()).mul(constants.TINYBAR_TO_WEIBAR_COEF).gte(txTotalValue);

      if (!result.passes) {
        this.logger.trace('Failed balance precheck for sendRawTransaction(transaction=%s, totalValue=%s, accountTinyBarBalance=%s)', transaction, txTotalValue, tinybars);
      }
    } catch (error: any) {
      this.logger.trace('Error on balance precheck for sendRawTransaction(transaction=%s, totalValue=%s, error=%s)', transaction, txTotalValue, error.message);
      
      result.passes = false;
      result.error = predefined.INTERNAL_ERROR;
    }

    return result;
  }
}
