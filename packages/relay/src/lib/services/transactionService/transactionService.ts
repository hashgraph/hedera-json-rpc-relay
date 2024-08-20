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
import { MirrorNodeClient, SDKClient } from '../../clients';
import { SDKClientError } from '../../errors/SDKClientError';
import { Hbar, HbarUnit, Status, TransactionRecordQuery } from '@hashgraph/sdk';
import { IMirrorNodeTransactionRecord, MirrorNodeTransactionRecord } from '../../types/IMirrorNode';
import {
  parseNumericEnvVar,
  formatTransactionId,
  formatRequestIdMessage,
  getTransferAmountSumForAccount,
} from '../../../formatters';
import Constants from '../../constants';

export default class TransactionService {
  /**
   * Logger instance for logging information.
   * @type {Logger}
   * @private
   */
  private logger: Logger;

  /**
   * Main SDK client for executing queries.
   * @type {SDKClient}
   * @private
   */
  private sdkClient: SDKClient;

  /**
   * Main Mirror Node client for retrieving transaction records.
   * @type {MirrorNodeClient}
   * @private
   */
  private mirrorNodeClient: MirrorNodeClient;

  /**
   * Constructs an instance of the class.
   * @param {Logger} logger - The logger instance for logging information.
   * @param {Client} sdkClient - The main SDK client for executing queries.
   * @param {MirrorNodeClient} mirrorNodeClient - The main Mirror Node client for retrieving transaction records.
   */
  constructor(logger: Logger, sdkClient: SDKClient, mirrorNodeClient: MirrorNodeClient) {
    this.logger = logger;
    this.sdkClient = sdkClient;
    this.mirrorNodeClient = mirrorNodeClient;
  }

  /**
   * Retrieves the transaction status and metrics for a given transaction ID
   * by redirecting calls to either consensus node client or mirror node client based on default configuration.
   *
   * @param {string} transactionId - The ID of the transaction.
   * @param {string} callerName - The name of the entity calling the transaction.
   * @param {string} requestId - The request ID for logging purposes.
   * @param {string} txConstructorName - The name of the transaction constructor.
   * @param {string} operatorAccountId - The account ID of the operator.
   * @returns {Promise<{ transactionFee: number; gasUsed: number; transactionStatus: string; txRecordChargeAmount: number }>} - An object containing the transaction fee, gas used, transaction status, and transaction record charge amount.
   */
  public async getTransactionStatusAndMetrics(
    transactionId: string,
    callerName: string,
    requestId: string,
    txConstructorName: string,
    operatorAccountId: string,
  ): Promise<{ transactionFee: number; gasUsed: number; transactionStatus: string; txRecordChargeAmount: number }> {
    let gasUsed: number = 0;
    let transactionFee: number = 0;
    let txRecordChargeAmount: number = 0;
    let transactionStatus: string = Status.Unknown.toString();
    const formattedRequestId = formatRequestIdMessage(requestId);

    // check if calls are default to consensus node or not
    const defaultToConsensusNode = process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE === 'true';

    if (defaultToConsensusNode) {
      try {
        this.logger.trace(
          `${formattedRequestId} Get transaction record via consensus node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
        );

        // submit query and get transaction receipt
        const transactionRecord = await new TransactionRecordQuery()
          .setTransactionId(transactionId)
          .setValidateReceiptStatus(false)
          .execute(this.sdkClient.getMainClientInstance());

        const transactionReceipt = transactionRecord.receipt;

        // calculate transactionRecord fee
        const hbarToTinybar = Hbar.from(1, HbarUnit.Hbar).toTinybars().toNumber();
        const exchangeRateInCents = transactionReceipt.exchangeRate!.exchangeRateInCents;
        txRecordChargeAmount = Math.round(
          (Constants.TX_RECORD_QUERY_COST_IN_CENTS / exchangeRateInCents) * hbarToTinybar,
        );

        // get transactionStatus, transactionFee, and gasUsed
        transactionStatus = transactionReceipt.status.toString();
        transactionFee = getTransferAmountSumForAccount(transactionRecord, operatorAccountId);
        gasUsed = transactionRecord.contractFunctionResult?.gasUsed.toNumber() ?? 0;
      } catch (e: any) {
        // log error from TransactionRecordQuery
        const sdkClientError = new SDKClientError(e, e.message);
        this.logger.warn(
          e,
          `${formattedRequestId} Error raised during TransactionRecordQuery: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}, recordStatus=${sdkClientError.status} (${sdkClientError.status._code}), cost=${transactionFee}, gasUsed=${gasUsed}`,
        );
      }
    } else {
      this.logger.trace(
        `${formattedRequestId} Get transaction record via mirror node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
      );

      const mirrorNodeRetries = parseNumericEnvVar(
        'MIRROR_NODE_GET_CONTRACT_RESULTS_RETRIES',
        'MIRROR_NODE_GET_CONTRACT_RESULTS_DEFAULT_RETRIES',
      );

      // poll mirror node to get transaction record
      const transactionRecord = await this.mirrorNodeClient.repeatedRequest(
        this.mirrorNodeClient.getTransactionById.name,
        [transactionId, 0],
        mirrorNodeRetries,
        formattedRequestId,
      );

      if (!transactionRecord) {
        this.logger.warn(
          `${requestId} No transaction record retrieved: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
        );
      } else {
        const transactionReceipt: IMirrorNodeTransactionRecord = transactionRecord.transactions.find(
          (tx: any) => tx.transaction_id === formatTransactionId(transactionId),
        );

        const mirrorNodeTxRecord = new MirrorNodeTransactionRecord(transactionReceipt);

        // get transactionStatus, transactionFee
        transactionStatus = transactionReceipt.result;
        transactionFee = getTransferAmountSumForAccount(mirrorNodeTxRecord, operatorAccountId);
      }
    }

    return { transactionFee, gasUsed, transactionStatus, txRecordChargeAmount };
  }
}
