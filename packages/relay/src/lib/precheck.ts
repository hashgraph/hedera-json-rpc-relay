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
import { predefined } from './errors/JsonRpcError';
import { MirrorNodeClient, SDKClient } from './clients';
import { EthImpl } from './eth';
import { Logger } from 'pino';
import constants from './constants';
import { Transaction } from 'ethers';
import { formatRequestIdMessage } from '../formatters';

export class Precheck {
  private mirrorNodeClient: MirrorNodeClient;
  private sdkClient: SDKClient;
  private readonly chain: string;
  private readonly logger: Logger;

  constructor(mirrorNodeClient: MirrorNodeClient, sdkClient: SDKClient, logger: Logger, chainId: string) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.sdkClient = sdkClient;
    this.chain = chainId;
    this.logger = logger;
  }

  private static parseTxIfNeeded(transaction: string | Transaction): Transaction {
    return typeof transaction === 'string'
      ? ethers.utils.parseTransaction(transaction)
      : transaction;
  }

  value(tx: Transaction) {
    if (tx.data === EthImpl.emptyHex && tx.value.lt(constants.TINYBAR_TO_WEIBAR_COEF)) {
      throw predefined.VALUE_TOO_LOW;
    }
  }

  /**
   * @param transaction
   * @param gasPrice
   */
  async sendRawTransactionCheck(transaction: string, gasPrice: number, requestId?: string) {
    const parsedTx = Precheck.parseTxIfNeeded(transaction);

    this.gasLimit(parsedTx, requestId);
    await this.nonce(parsedTx, requestId);
    this.chainId(parsedTx, requestId);
    this.value(parsedTx);
    this.gasPrice(parsedTx, gasPrice, requestId);
    await this.balance(parsedTx, EthImpl.ethSendRawTransaction, requestId);
  }

  /**
   * @param tx
   */
  async nonce(tx: Transaction, requestId?: string) {
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
    const accountInfo = await this.mirrorNodeClient.getAccount(recoveredAddress, requestId);

    // @ts-ignore
    if (accountInfo && accountInfo.ethereum_nonce > tx.nonce) {
      throw predefined.NONCE_TOO_LOW;
    }
  }

  /**
   * @param tx
   */
  chainId(tx: Transaction, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const txChainId = EthImpl.prepend0x(Number(tx.chainId).toString(16));
    const passes = txChainId === this.chain;
    if (!passes) {
      this.logger.trace(`${requestIdPrefix} Failed chainId precheck for sendRawTransaction(transaction=%s, chainId=%s)`, JSON.stringify(tx), txChainId);
      throw predefined.UNSUPPORTED_CHAIN_ID(txChainId, this.chain);
    }
  }

  /**
   * @param tx
   * @param gasPrice
   */
  gasPrice(tx: Transaction, gasPrice: number, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const minGasPrice = ethers.ethers.BigNumber.from(gasPrice);
    const txGasPrice = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const passes = txGasPrice.gte(minGasPrice);

    if (!passes) {
      this.logger.trace(`${requestIdPrefix} Failed gas price precheck for sendRawTransaction(transaction=%s, gasPrice=%s, requiredGasPrice=%s)`, JSON.stringify(tx), txGasPrice, minGasPrice);
      throw predefined.GAS_PRICE_TOO_LOW;
    }
  }

  /**
   * @param tx
   * @param callerName
   */
  async balance(tx: Transaction, callerName: string, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const result = {
      passes: false,
      error: predefined.INSUFFICIENT_ACCOUNT_BALANCE
    };
    const txGas = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const txTotalValue = tx.value.add(txGas.mul(tx.gasLimit));
    let tinybars;

    const accountResponse: any = await this.mirrorNodeClient.getAccount(tx.from!, requestId);
    if (accountResponse == null) {
      this.logger.trace(`${requestIdPrefix} Failed to retrieve account details from mirror node on balance precheck for sendRawTransaction(transaction=${JSON.stringify(tx)}, totalValue=${txTotalValue})`);
      throw predefined.RESOURCE_NOT_FOUND;
    }

    try {
      tinybars = await this.sdkClient.getAccountBalanceInTinyBar(accountResponse.account, callerName, requestId);
      result.passes = ethers.ethers.BigNumber.from(tinybars.toString()).mul(constants.TINYBAR_TO_WEIBAR_COEF).gte(txTotalValue);
    } catch (error: any) {
      this.logger.trace(`${requestIdPrefix} Error on balance precheck for sendRawTransaction(transaction=%s, totalValue=%s, error=%s)`, JSON.stringify(tx), txTotalValue, error.message);
      throw predefined.INTERNAL_ERROR;
    }

    if (!result.passes) {
      this.logger.trace(`${requestIdPrefix} Failed balance precheck for sendRawTransaction(transaction=%s, totalValue=%s, accountTinyBarBalance=%s)`, JSON.stringify(tx), txTotalValue, tinybars);
      throw predefined.INSUFFICIENT_ACCOUNT_BALANCE;
    }
  }

  /**
   * @param tx
   */
  gasLimit(tx: Transaction, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const gasLimit = tx.gasLimit.toNumber();
    const failBaseLog = 'Failed gasLimit precheck for sendRawTransaction(transaction=%s).';

    const intrinsicGasCost = Precheck.transactionIntrinsicGasCost(tx.data, tx.to);


    if (gasLimit > constants.BLOCK_GAS_LIMIT) {
      this.logger.trace(`${requestIdPrefix} ${failBaseLog} Gas Limit was too high: %s, block gas limit: %s`, JSON.stringify(tx), gasLimit, constants.BLOCK_GAS_LIMIT);
      throw predefined.GAS_LIMIT_TOO_HIGH;
    } else if (gasLimit < intrinsicGasCost) {
      this.logger.trace(`${requestIdPrefix} ${failBaseLog} Gas Limit was too low: %s, intrinsic gas cost: %s`, JSON.stringify(tx), gasLimit, intrinsicGasCost);
      throw predefined.GAS_LIMIT_TOO_LOW;
    }
  }

  /**
   * Calculates the intrinsic gas cost based on the number of empty bytes and whether the transaction is CONTRACT_CREATE
   * @param data
   * @param to
   * @private
   */
  private static transactionIntrinsicGasCost(data: string, to: string | undefined) {
    const isCreate = (to == undefined) || (to.length == 0);

    let zeros = 0;

    const dataBytes = Buffer.from(data, 'hex');

    for (const c of dataBytes) {
      if (c == 0) {
        zeros++;
      }
    }

    const nonZeros = data.replace('0x', '').length - zeros;
    const cost = constants.TX_BASE_COST + constants.TX_DATA_ZERO_COST * zeros + constants.ISTANBUL_TX_DATA_NON_ZERO_COST * nonZeros;
    return isCreate ? cost + constants.TX_CREATE_EXTRA : cost;
  }
}
