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

import { JsonRpcError, predefined } from './errors/JsonRpcError';
import { MirrorNodeClient } from './clients';
import { EthImpl } from './eth';
import { Logger } from 'pino';
import constants from './constants';
import { BigNumber, ethers, Transaction } from 'ethers';
import { formatRequestIdMessage, prepend0x } from '../formatters';

export class Precheck {
  private mirrorNodeClient: MirrorNodeClient;
  private readonly chain: string;
  private readonly logger: Logger;

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, chainId: string) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chainId;
  }

  public static parseTxIfNeeded(transaction: string | Transaction): Transaction {
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
  async sendRawTransactionCheck(parsedTx: ethers.Transaction, gasPrice: number, requestId?: string) {
    
    this.gasLimit(parsedTx, requestId);
    const mirrorAccountInfo = await this.verifyAccount(parsedTx, requestId);
    await this.nonce(parsedTx, mirrorAccountInfo.ethereum_nonce, requestId);
    this.chainId(parsedTx, requestId);
    this.value(parsedTx);
    this.gasPrice(parsedTx, gasPrice, requestId);
    await this.balance(parsedTx, mirrorAccountInfo, requestId);
  }

  async verifyAccount(tx: Transaction, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    // verify account
    const accountInfo = await this.mirrorNodeClient.getAccount(tx.from!, requestId);
    if (accountInfo == null) {
      this.logger.trace(`${requestIdPrefix} Failed to retrieve address '${tx.from}' account details from mirror node on verify account precheck for sendRawTransaction(transaction=${JSON.stringify(tx)})`);
      throw predefined.RESOURCE_NOT_FOUND(`address '${tx.from}'.`);
    }

    return accountInfo;
  }

  /**
   * @param tx
   */
  async nonce(tx: Transaction, accountInfoNonce: number, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} Nonce precheck for sendRawTransaction(tx.nonce=${tx.nonce}, accountInfoNonce=${accountInfoNonce})`);

    // @ts-ignore
    if (accountInfoNonce > tx.nonce) {
      throw predefined.NONCE_TOO_LOW(tx.nonce, accountInfoNonce);
    }
  }

  /**
   * @param tx
   */
  chainId(tx: Transaction, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const txChainId = prepend0x(Number(tx.chainId).toString(16));
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
    const minGasPrice = ethers.BigNumber.from(gasPrice);
    const txGasPrice = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const passes = txGasPrice.gte(minGasPrice);

    if (!passes) {
      if (constants.GAS_PRICE_TINY_BAR_BUFFER) {
        // Check if failure is within buffer range (Often it's by 1 tinybar) as network gasprice calculation can change slightly.
        // e.g gasPrice=1450000000000, requiredGasPrice=1460000000000, in which case we should allow users to go through and let the network check
        const txGasPriceWithBuffer = txGasPrice.add(ethers.BigNumber.from(constants.GAS_PRICE_TINY_BAR_BUFFER));
        if (txGasPriceWithBuffer.gte(minGasPrice)) {
          return;
        }
      }

      this.logger.trace(`${requestIdPrefix} Failed gas price precheck for sendRawTransaction(transaction=%s, gasPrice=%s, requiredGasPrice=%s)`, JSON.stringify(tx), txGasPrice, minGasPrice);
      throw predefined.GAS_PRICE_TOO_LOW(txGasPrice, minGasPrice);
    }
  }

  /**
   * @param tx
   * @param callerName
   */
  async balance(tx: Transaction, account: any, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const result = {
      passes: false,
      error: predefined.INSUFFICIENT_ACCOUNT_BALANCE
    };
    const txGas = tx.gasPrice || tx.maxFeePerGas!.add(tx.maxPriorityFeePerGas!);
    const txTotalValue = tx.value.add(txGas.mul(tx.gasLimit));
    let tinybars: BigNumber;

    if (account == null) {
      this.logger.trace(`${requestIdPrefix} Failed to retrieve account details from mirror node on balance precheck for sendRawTransaction(transaction=${JSON.stringify(tx)}, totalValue=${txTotalValue})`);
      throw predefined.RESOURCE_NOT_FOUND(`tx.from '${tx.from}'.`);
    }

    try {
      tinybars = ethers.BigNumber.from(account.balance.balance.toString()).mul(constants.TINYBAR_TO_WEIBAR_COEF);
      result.passes = tinybars.gte(txTotalValue);
    } catch (error: any) {
      this.logger.trace(`${requestIdPrefix} Error on balance precheck for sendRawTransaction(transaction=%s, totalValue=%s, error=%s)`, JSON.stringify(tx), txTotalValue, error.message);
      if (error instanceof JsonRpcError) {
        // preserve original error
        throw error;
      } else {
        throw predefined.INTERNAL_ERROR(`balance precheck: ${error.message}`);
      }
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
      throw predefined.GAS_LIMIT_TOO_HIGH(gasLimit, constants.BLOCK_GAS_LIMIT);
    } else if (gasLimit < intrinsicGasCost) {
      this.logger.trace(`${requestIdPrefix} ${failBaseLog} Gas Limit was too low: %s, intrinsic gas cost: %s`, JSON.stringify(tx), gasLimit, intrinsicGasCost);
      throw predefined.GAS_LIMIT_TOO_LOW(gasLimit, intrinsicGasCost);
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
