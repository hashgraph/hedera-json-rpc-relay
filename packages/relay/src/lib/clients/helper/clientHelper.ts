/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import { Logger } from 'pino';
import { MirrorNodeClient } from '../mirrorNodeClient';
import { SDKClientError } from '../../errors/SDKClientError';
import { AccountBalanceQuery, Client, Status, TransactionRecordQuery } from '@hashgraph/sdk';
import {
  parseNumericEnvVar,
  formatTransactionId,
  formatRequestIdMessage,
  getTransferAmountSumForAccount,
} from '../../../formatters';

/**
 * Retrieves the status and metrics (transaction fee and gas used) for a given transaction ID using mirror node or consensus node.
 * @param {string} transactionId - The ID of the transaction to retrieve metrics for.
 * @param {string} callerName - The name of the caller executing the transaction.
 * @param {string} requestId - The request ID associated with the transaction.
 * @param {Logger} logger - The logger object for logging purposes.
 * @param {string} txConstructorName - The constructor name of the transaction.
 * @param {Client | MirrorNodeClient} clientMain - The main consensus node client or mirror node client to use for retrieving the transaction record.
 * @returns {Promise<{transactionFee: number, gasUsed: number, transactionStatus: string, txRecordChargeAmount: number}>} A promise that resolves to an object containing the transaction fee, gas used, and transaction status.
 */
export const getTransactionStatusAndMetrics = async (
  transactionId: string,
  callerName: string,
  requestId: string,
  logger: Logger,
  txConstructorName: string,
  clientMain: Client | MirrorNodeClient,
  operatorAccountId: string,
): Promise<{ transactionFee: number; gasUsed: number; transactionStatus: string; txRecordChargeAmount: number }> => {
  let gasUsed: number = 0;
  let transactionFee: number = 0;
  let txRecordChargeAmount: number = 0;
  let transactionStatus: string = Status.Unknown.toString();
  const formattedRequestId = formatRequestIdMessage(requestId);

  if (clientMain instanceof Client) {
    try {
      logger.trace(
        `${formattedRequestId} Get transaction record via consensus node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
      );

      // retrieve operaotr's balance before the execution
      const operatorBalanceBefore = await getBalanceInTinyBars(operatorAccountId, clientMain, 200);

      // submit query and get transaction receipt
      const transactionRecord = await new TransactionRecordQuery()
        .setTransactionId(transactionId)
        .setValidateReceiptStatus(false)
        .execute(clientMain);
      const transactionReceipt = transactionRecord.receipt;

      // retrieve operaotr's balance after the execution
      const operatorBalanceAfter = await getBalanceInTinyBars(operatorAccountId, clientMain, 200);

      // capture transactionRecord fee by comparing operator balance before and after the execution
      txRecordChargeAmount = operatorBalanceBefore - operatorBalanceAfter;

      // get transactionStatus, transactionFee, and gasUsed
      transactionStatus = transactionReceipt.status.toString();
      transactionFee = getTransferAmountSumForAccount(transactionRecord, operatorAccountId);
gasUsed = transactionRecord.contractFunctionResult?.gasUsed.toNumber() ?? 0;
    } catch (e: any) {
      // log error from TransactionRecordQuery
      const sdkClientError = new SDKClientError(e, e.message);
      logger.warn(
        e,
        `${formattedRequestId} Error raised during TransactionRecordQuery: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}, recordStatus=${sdkClientError.status} (${sdkClientError.status._code}), cost=${transactionFee}, gasUsed=${gasUsed}`,
      );
    }
  } else {
    logger.trace(
      `${formattedRequestId} Get transaction record via mirror node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
    );

    // poll mirror node to get transaction record
    const mirrorNodeRetries = parseNumericEnvVar(
      'MIRROR_NODE_GET_CONTRACT_RESULTS_RETRIES',
      'MIRROR_NODE_GET_CONTRACT_RESULTS_DEFAULT_RETRIES',
    );
    const transactionRecord = await clientMain.repeatedRequest(
      clientMain.getTransactionById.name,
      [transactionId, 0],
      mirrorNodeRetries,
      formattedRequestId,
    );

    if (!transactionRecord) {
      logger.warn(
        `${requestId} No transaction record retrieved: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
      );
    } else {
      const transactionReceipt = transactionRecord.transactions.find(
        (tx: any) => tx.transaction_id === formatTransactionId(transactionId),
      );

      // get transactionStatus, transactionFee
      transactionStatus = transactionReceipt.result;
      transactionFee = getTransferAmountSumForAccount(transactionReceipt, operatorAccountId);
    }
  }

  return { transactionFee, gasUsed, transactionStatus, txRecordChargeAmount };
};

/**
 * Retrieves the balance of an account in tinybars after a specified delay.
 * @param {string} accountId - The ID of the account to retrieve the balance for.
 * @param {Client} client - The client used to execute the balance query.
 * @param {number} ms - The delay in milliseconds before executing the query.
 * @returns {Promise<number>} - A promise that resolves to the account balance in tinybars.
 */
const getBalanceInTinyBars = async (accountId: string, client: Client, ms: number): Promise<number> => {
  await new Promise((r) => setTimeout(r, ms));
  const accountBalance = await new AccountBalanceQuery()
    .setAccountId(accountId)
    .execute(client);
  return accountBalance.hbars.toTinybars().toNumber();
};
