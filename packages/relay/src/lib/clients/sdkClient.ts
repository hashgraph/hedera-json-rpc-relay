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

import {
  AccountBalance,
  AccountBalanceQuery,
  AccountId,
  AccountInfo,
  AccountInfoQuery,
  Client,
  ContractByteCodeQuery,
  ContractCallQuery,
  ContractFunctionResult,
  ContractId,
  EthereumTransaction,
  EthereumTransactionData,
  ExchangeRates,
  FeeComponents,
  FeeSchedules,
  FileAppendTransaction,
  FileContentsQuery,
  FileCreateTransaction,
  FileDeleteTransaction,
  FileId,
  FileInfoQuery,
  Hbar,
  HbarUnit,
  PrecheckStatusError,
  Query,
  Status,
  Transaction,
  TransactionId,
  TransactionRecord,
  TransactionRecordQuery,
  TransactionResponse,
} from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from 'pino';
import { formatRequestIdMessage } from '../../formatters';
import HbarLimit from '../hbarlimiter';
import constants from './../constants';
import { SDKClientError } from './../errors/SDKClientError';
import { JsonRpcError, predefined } from './../errors/JsonRpcError';
import { CacheService } from '../services/cacheService/cacheService';
import { Histogram } from 'prom-client';

const _ = require('lodash');
const LRU = require('lru-cache');

export class SDKClient {
  static transactionMode = 'TRANSACTION';
  static queryMode = 'QUERY';
  static recordMode = 'RECORD';
  /**
   * The client to use for connecting to the main consensus network. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private readonly clientMain: Client;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * This limiter tracks hbar expenses and limits.
   * @private
   */
  private readonly hbarLimiter: HbarLimit;

  /**
   * LRU cache container.
   * @private
   */
  private readonly cacheService: CacheService;

  /**
   * Histogram for capturing the cost of transactions and queries.
   * @private
   */
  private readonly consensusNodeClientHistogramCost: Histogram;

  /**
   * Histogram for capturing the gas fee of transactions and queries.
   * @private
   */
  private readonly consensusNodeClientHistogramGasFee: Histogram;

  /**
   * Maximum number of chunks for file append transaction.
   * @private
   */
  private readonly maxChunks: number;

  /**
   * Size of each chunk for file append transaction.
   * @private
   */
  private readonly fileAppendChunkSize: number;

  // populate with consensus node requests via SDK
  constructor(clientMain: Client, logger: Logger, hbarLimiter: HbarLimit, metrics: any, cacheService: CacheService) {
    this.clientMain = clientMain;

    if (process.env.CONSENSUS_MAX_EXECUTION_TIME) {
      // sets the maximum time in ms for the SDK to wait when submitting
      // a transaction/query before throwing a TIMEOUT error
      this.clientMain = clientMain.setMaxExecutionTime(Number(process.env.CONSENSUS_MAX_EXECUTION_TIME));
    }

    this.logger = logger;
    this.consensusNodeClientHistogramCost = metrics.costHistogram;
    this.consensusNodeClientHistogramGasFee = metrics.gasHistogram;
    this.hbarLimiter = hbarLimiter;
    this.cacheService = cacheService;
    this.maxChunks = Number(process.env.FILE_APPEND_MAX_CHUNKS) || 20;
    this.fileAppendChunkSize = Number(process.env.FILE_APPEND_CHUNK_SIZE) || 5120;
  }

  async getAccountBalance(account: string, callerName: string, requestId?: string): Promise<AccountBalance> {
    return this.executeQuery(
      new AccountBalanceQuery().setAccountId(AccountId.fromString(account)),
      this.clientMain,
      callerName,
      account,
      requestId,
    );
  }

  async getAccountBalanceInTinyBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getAccountBalance(account, callerName, requestId);
    return balance.hbars.to(HbarUnit.Tinybar);
  }

  async getAccountBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getAccountBalance(account, callerName, requestId);
    return SDKClient.HbarToWeiBar(balance);
  }

  async getAccountInfo(address: string, callerName: string, requestId?: string): Promise<AccountInfo> {
    return this.executeQuery(
      new AccountInfoQuery().setAccountId(AccountId.fromString(address)),
      this.clientMain,
      callerName,
      address,
      requestId,
    );
  }

  async getContractByteCode(
    shard: number | Long,
    realm: number | Long,
    address: string,
    callerName: string,
    requestId?: string,
  ): Promise<Uint8Array> {
    const contractByteCodeQuery = new ContractByteCodeQuery().setContractId(
      ContractId.fromEvmAddress(shard, realm, address),
    );
    const cost = await contractByteCodeQuery.getCost(this.clientMain);

    return this.executeQuery(
      contractByteCodeQuery.setQueryPayment(cost),
      this.clientMain,
      callerName,
      address,
      requestId,
    );
  }

  async getContractBalance(contract: string, callerName: string, requestId?: string): Promise<AccountBalance> {
    return this.executeQuery(
      new AccountBalanceQuery().setContractId(ContractId.fromString(contract)),
      this.clientMain,
      callerName,
      contract,
      requestId,
    );
  }

  async getContractBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getContractBalance(account, callerName, requestId);
    return SDKClient.HbarToWeiBar(balance);
  }

  async getExchangeRate(callerName: string, requestId?: string): Promise<ExchangeRates> {
    const exchangeFileBytes = await this.getFileIdBytes(constants.EXCHANGE_RATE_FILE_ID, callerName, requestId);

    return ExchangeRates.fromBytes(exchangeFileBytes);
  }

  async getFeeSchedule(callerName: string, requestId?: string): Promise<FeeSchedules> {
    const feeSchedulesFileBytes = await this.getFileIdBytes(constants.FEE_SCHEDULE_FILE_ID, callerName, requestId);
    return FeeSchedules.fromBytes(feeSchedulesFileBytes);
  }

  async getTinyBarGasFee(callerName: string, requestId?: string): Promise<number> {
    const cachedResponse: number | undefined = this.cacheService.get(
      constants.CACHE_KEY.GET_TINYBAR_GAS_FEE,
      callerName,
      requestId,
    );
    if (cachedResponse) {
      return cachedResponse;
    }

    const feeSchedules = await this.getFeeSchedule(callerName, requestId);
    if (_.isNil(feeSchedules.current) || feeSchedules.current?.transactionFeeSchedule === undefined) {
      throw new SDKClientError({}, 'Invalid FeeSchedules proto format');
    }

    for (const schedule of feeSchedules.current?.transactionFeeSchedule) {
      if (schedule.hederaFunctionality?._code === constants.ETH_FUNCTIONALITY_CODE && schedule.fees !== undefined) {
        // get exchange rate & convert to tiny bar
        const exchangeRates = await this.getExchangeRate(callerName, requestId);
        const tinyBars = this.convertGasPriceToTinyBars(schedule.fees[0].servicedata, exchangeRates);

        this.cacheService.set(constants.CACHE_KEY.GET_TINYBAR_GAS_FEE, tinyBars, callerName, undefined, requestId);
        return tinyBars;
      }
    }

    throw new SDKClientError({}, `${constants.ETH_FUNCTIONALITY_CODE} code not found in feeSchedule`);
  }

  async getFileIdBytes(address: string, callerName: string, requestId?: string): Promise<Uint8Array> {
    return this.executeQuery(
      new FileContentsQuery().setFileId(address),
      this.clientMain,
      callerName,
      address,
      requestId,
    );
  }

  async getRecord(transactionResponse: TransactionResponse) {
    return transactionResponse.getRecord(this.clientMain);
  }

  async submitEthereumTransaction(
    transactionBuffer: Uint8Array,
    callerName: string,
    requestId: string,
  ): Promise<{ txResponse: TransactionResponse; fileId: FileId | null }> {
    const ethereumTransactionData: EthereumTransactionData = EthereumTransactionData.fromBytes(transactionBuffer);
    const ethereumTransaction = new EthereumTransaction();
    const interactingEntity = ethereumTransactionData.toJSON()['to'].toString();
    let fileId: FileId | null = null;
    const requestIdPrefix = formatRequestIdMessage(requestId);

    // if callData's size is greater than `fileAppendChunkSize` => employ HFS to create new file to carry the rest of the contents of callData
    if (ethereumTransactionData.callData.length <= this.fileAppendChunkSize) {
      ethereumTransaction.setEthereumData(ethereumTransactionData.toBytes());
    } else {
      // notice: this solution is temporary and subject to change.
      const isPreemtiveCheckOn = process.env.HBAR_RATE_LIMIT_PREEMTIVE_CHECK
        ? process.env.HBAR_RATE_LIMIT_PREEMTIVE_CHECK === 'true'
        : false;

      if (isPreemtiveCheckOn) {
        const numFileCreateTxs = 1;
        const numFileAppendTxs = Math.ceil(ethereumTransactionData.callData.length / this.fileAppendChunkSize);
        const fileCreateFee = Number(process.env.HOT_FIX_FILE_CREATE_FEE || 100000000); // 1 hbar
        const fileAppendFee = Number(process.env.HOT_FIX_FILE_APPEND_FEE || 120000000); // 1.2 hbar

        const totalPreemtiveTransactionFee = numFileCreateTxs * fileCreateFee + numFileAppendTxs * fileAppendFee;

        const shouldPreemtivelyLimit = this.hbarLimiter.shouldPreemtivelyLimit(totalPreemtiveTransactionFee);
        if (shouldPreemtivelyLimit) {
          this.logger.trace(
            `${requestIdPrefix} The total preemptive transaction fee exceeds the current remaining HBAR budget due to an excessively large callData size.: numFileCreateTxs=${numFileCreateTxs}, numFileAppendTxs=${numFileAppendTxs}, totalPreemtiveTransactionFee=${totalPreemtiveTransactionFee}, callDataSize=${ethereumTransactionData.callData.length}`,
          );
          throw predefined.HBAR_RATE_LIMIT_PREEMTIVE_EXCEEDED;
        }
      }

      fileId = await this.createFile(
        ethereumTransactionData.callData,
        this.clientMain,
        requestId,
        callerName,
        interactingEntity,
      );
      if (!fileId) {
        throw new SDKClientError({}, `${requestIdPrefix} No fileId created for transaction. `);
      }
      ethereumTransactionData.callData = new Uint8Array();
      ethereumTransaction.setEthereumData(ethereumTransactionData.toBytes()).setCallDataFileId(fileId);
    }

    const tinybarsGasFee = await this.getTinyBarGasFee('eth_sendRawTransaction');
    ethereumTransaction.setMaxTransactionFee(Hbar.fromTinybars(Math.floor(tinybarsGasFee * constants.BLOCK_GAS_LIMIT)));

    return {
      fileId,
      txResponse: await this.executeTransaction(ethereumTransaction, callerName, interactingEntity, requestId, true),
    };
  }

  async submitContractCallQuery(
    to: string,
    data: string,
    gas: number,
    from: string,
    callerName: string,
    requestId?: string,
  ): Promise<ContractFunctionResult> {
    const contract = SDKClient.prune0x(to);
    const contractId = contract.startsWith('00000000000')
      ? ContractId.fromSolidityAddress(contract)
      : ContractId.fromEvmAddress(0, 0, contract);

    const contractCallQuery = new ContractCallQuery().setContractId(contractId).setGas(gas);

    // data is optional and can be omitted in which case fallback function will be employed
    if (data) {
      contractCallQuery.setFunctionParameters(Buffer.from(SDKClient.prune0x(data), 'hex'));
    }

    if (from) {
      contractCallQuery.setSenderAccountId(AccountId.fromEvmAddress(0, 0, from));
    }

    if (this.clientMain.operatorAccountId !== null) {
      contractCallQuery.setPaymentTransactionId(TransactionId.generate(this.clientMain.operatorAccountId));
    }

    return this.executeQuery(contractCallQuery, this.clientMain, callerName, to, requestId);
  }

  async submitContractCallQueryWithRetry(
    to: string,
    data: string,
    gas: number,
    from: string,
    callerName: string,
    requestId?: string,
  ): Promise<ContractFunctionResult> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    let retries = 0;
    let resp;
    while (parseInt(process.env.CONTRACT_QUERY_TIMEOUT_RETRIES || '1') > retries) {
      try {
        resp = await this.submitContractCallQuery(to, data, gas, from, callerName, requestId);
        return resp;
      } catch (e: any) {
        const sdkClientError = new SDKClientError(e, e.message);
        if (sdkClientError.isTimeoutExceeded()) {
          const delay = retries * 1000;
          this.logger.trace(
            `${requestIdPrefix} Contract call query failed with status ${sdkClientError.message}. Retrying again after ${delay} ms ...`,
          );
          retries++;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        if (e instanceof JsonRpcError) {
          throw e;
        }
        throw sdkClientError;
      }
    }
    return resp;
  }

  async increaseCostAndRetryExecution(
    query: Query<any>,
    baseCost: Hbar,
    client: Client,
    maxRetries: number,
    currentRetry: number,
    requestId?: string,
  ) {
    const baseMultiplier = constants.QUERY_COST_INCREMENTATION_STEP;
    const multiplier = Math.pow(baseMultiplier, currentRetry);

    const cost = Hbar.fromTinybars(baseCost._valueInTinybar.multipliedBy(multiplier).toFixed(0));

    try {
      const resp = await query.setQueryPayment(cost).execute(client);
      return { resp, cost };
    } catch (e: any) {
      const sdkClientError = new SDKClientError(e, e.message);
      if (maxRetries > currentRetry && sdkClientError.isInsufficientTxFee()) {
        const newRetry = currentRetry + 1;
        this.logger.info(`${requestId} Retrying query execution with increased cost, retry number: ${newRetry}`);
        return await this.increaseCostAndRetryExecution(query, baseCost, client, maxRetries, newRetry, requestId);
      }

      throw e;
    }
  }

  private convertGasPriceToTinyBars = (feeComponents: FeeComponents | undefined, exchangeRates: ExchangeRates) => {
    // gas -> tinCents:  gas / 1000
    // tinCents -> tinyBars: tinCents * exchangeRate (hbarEquiv/ centsEquiv)
    if (feeComponents === undefined || feeComponents.contractTransactionGas === undefined) {
      return constants.DEFAULT_TINY_BAR_GAS;
    }

    return Math.ceil(
      (feeComponents.contractTransactionGas.toNumber() / 1_000) *
        (exchangeRates.currentRate.hbars / exchangeRates.currentRate.cents),
    );
  };

  async executeQuery<T>(
    query: Query<T>,
    client: Client,
    callerName: string,
    interactingEntity: string,
    requestId?: string,
  ): Promise<T> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const currentDateNow = Date.now();
    try {
      const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.queryMode, callerName);
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }

      let resp, cost;
      if (query.paymentTransactionId) {
        const baseCost = await query.getCost(this.clientMain);
        const res = await this.increaseCostAndRetryExecution(query, baseCost, client, 3, 0, requestId);
        resp = res.resp;
        cost = res.cost.toTinybars().toNumber();
        this.hbarLimiter.addExpense(cost, currentDateNow);
      } else {
        resp = await query.execute(client);
        cost = query._queryPayment?.toTinybars().toNumber();
      }

      this.logger.info(
        `${requestIdPrefix} ${query.paymentTransactionId} ${callerName} ${query.constructor.name} status: ${Status.Success} (${Status.Success._code}), cost: ${query._queryPayment}`,
      );
      this.captureMetrics(
        SDKClient.queryMode,
        query.constructor.name,
        Status.Success,
        cost,
        0,
        callerName,
        interactingEntity,
      );
      return resp;
    } catch (e: any) {
      const cost = query._queryPayment?.toTinybars().toNumber();
      const sdkClientError = new SDKClientError(e, e.message);
      this.captureMetrics(
        SDKClient.queryMode,
        query.constructor.name,
        sdkClientError.status,
        cost,
        0,
        callerName,
        interactingEntity,
      );
      this.logger.trace(
        `${requestIdPrefix} ${query.paymentTransactionId} ${callerName} ${query.constructor.name} status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${query._queryPayment}`,
      );
      if (cost) {
        this.hbarLimiter.addExpense(cost, currentDateNow);
      }

      if (e instanceof PrecheckStatusError && e.contractFunctionResult?.errorMessage) {
        throw predefined.CONTRACT_REVERT(e.contractFunctionResult.errorMessage);
      }

      if (e instanceof JsonRpcError) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }

      if (sdkClientError.isGrpcTimeout()) {
        throw predefined.REQUEST_TIMEOUT;
      }
      throw sdkClientError;
    }
  }

  /**
   * Executes a single transaction, handling rate limits, logging, and metrics.
   * @param {Transaction} transaction - The transaction to be executed.
   * @param {string} callerName - The name of the caller executing the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} requestId - The request ID associated with the transaction.
   * @returns {Promise<TransactionResponse>} A promise that resolves to the transaction response.
   * @throws Will throw an error if the HBAR rate limit is exceeded, the transaction execution fails, or if a valid network error occurs.
   */
  async executeTransaction(
    transaction: Transaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
  ): Promise<TransactionResponse> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const transactionType = transaction.constructor.name;
    const currentDateNow = Date.now();
    let gasUsed: number = 0;
    let transactionFee: number = 0;
    let transactionResponse: TransactionResponse | null = null;

    // check hbar limit before executing transaction
    if (shouldThrowHbarLimit) {
      const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.transactionMode, callerName);
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }
    }

    try {
      // execute transaction
      this.logger.info(`${formattedRequestId} Execute ${transactionType} transaction`);
      transactionResponse = await transaction.execute(this.clientMain);

      // retrieve and capture transaction fee in metrics and rate limiter class
      const getRecordResult = await this.executeGetTransactionRecord(transactionResponse, callerName, requestId);
      gasUsed = getRecordResult.gasUsed;
      transactionFee = getRecordResult.transactionFee;

      this.logger.info(
        `${formattedRequestId} Successfully execute ${transactionType} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${Status.Success}(${Status.Success._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );
      return transactionResponse;
    } catch (e: any) {
      // declare main error as SDKClientError
      const sdkClientError = new SDKClientError(e, e.message);

      // if valid network error utilize transaction id to get transactionFee and gasUsed for metrics
      if (sdkClientError.isValidNetworkError()) {
        try {
          const transactionRecord = await new TransactionRecordQuery()
            .setTransactionId(transaction.transactionId!)
            .setNodeAccountIds(transaction.nodeAccountIds!)
            .setValidateReceiptStatus(false)
            .execute(this.clientMain);

          // extract gas and txFee
          // Note: In case of a FileAppendTransaction failure, complement transactionFee and gasUsed.
          transactionFee = transactionRecord.transactionFee.toTinybars().toNumber();
          gasUsed = transactionRecord.contractFunctionResult
            ? transactionRecord.contractFunctionResult.gasUsed.toNumber()
            : 0;
        } catch (err: any) {
          const recordQueryError = new SDKClientError(err, err.message);
          this.logger.error(
            recordQueryError,
            `${formattedRequestId} Error raised during TransactionRecordQuery for ${transaction.transactionId}`,
          );
        }
      }

      // log and throw
      this.logger.warn(
        `${formattedRequestId} Fail to execute ${transactionType} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${sdkClientError.status}(${sdkClientError.status._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );

      // Throw WRONG_NONCE error as more error handling logic for WRONG_NONCE is awaited in eth.sendRawTransactionErrorHandler(). Otherwise, move on and return transactionResponse eventually.
      if (e.status && e.status.toString() === constants.TRANSACTION_RESULT_STATUS.WRONG_NONCE) {
        throw sdkClientError;
      } else {
        if (!transactionResponse) {
          throw predefined.INTERNAL_ERROR(
            `${formattedRequestId} Transaction execution returns a null value for transaction ${transaction.transactionId}`,
          );
        }
        return transactionResponse;
      }
    } finally {
      /**
       * @note Capturing the charged transaction fees at the end of the flow ensures these fees are eventually
       *       captured in the metrics and rate limiter class, even if SDK transactions fail at any point.
       */
      if (transactionFee !== 0) {
        this.logger.trace(
          `${formattedRequestId} Capturing HBAR charged transaction fee: transactionId=${transaction.transactionId}, txConstructorName=${transactionType}, callerName=${callerName}, txChargedFee=${transactionFee} tinybars`,
        );
        this.hbarLimiter.addExpense(transactionFee, currentDateNow);
        this.captureMetrics(
          SDKClient.transactionMode,
          transactionType,
          Status.Success,
          transactionFee,
          gasUsed,
          callerName,
          interactingEntity,
        );
      }
    }
  }

  /**
   * Executes all transactions of a given type, handling rate limits and logging the results.
   * @param {FileAppendTransaction} transaction - The transaction to be executed.
   * @param {string} callerName - The name of the caller executing the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} requestId - The request ID associated with the transaction.
   * @returns {Promise<void>} A promise that resolves when all transactions have been executed.
   * @throws Will throw an error if the HBAR rate limit is exceeded or if the transaction execution fails.
   */
  async executeAllTransaction(
    transaction: FileAppendTransaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
  ): Promise<void> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const transactionType = transaction.constructor.name;
    const currentDateNow = Date.now();
    let transactionResponses: TransactionResponse[] | null = null;

    // check hbar limit before executing transaction
    if (shouldThrowHbarLimit) {
      const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.transactionMode, callerName);
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }
    }

    try {
      // execute transaction
      this.logger.info(`${formattedRequestId} Execute ${transactionType} transaction`);

      transactionResponses = await transaction.executeAll(this.clientMain);

      for (let transactionResponse of transactionResponses) {
        let gasUsed: number = 0;
        let transactionFee: number = 0;

        // Since this is a loop, and it's unclear which transactionResponse might throw an error,
        // use a try/catch/finally block to ensure the loop completes even if an error is thrown, and all the metrics are recorded.
        try {
          // get gasUsed and transaction fee
          const getRecordResult = await this.executeGetTransactionRecord(transactionResponse, callerName, requestId);
          gasUsed = getRecordResult.gasUsed;
          transactionFee = getRecordResult.transactionFee;
          this.logger.info(
            `${requestId} Successfully execute ${transactionType} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${Status.Success}(${Status.Success._code}), cost=${getRecordResult.transactionFee} tinybars, gasUsed=${getRecordResult.gasUsed}`,
          );
        } catch (e: any) {
          try {
            const transactionRecord = await new TransactionRecordQuery()
              .setTransactionId(transactionResponse.transactionId)
              .setNodeAccountIds(transaction.nodeAccountIds!)
              .setValidateReceiptStatus(false)
              .execute(this.clientMain);

            // get gasUsed and transaction fee
            transactionFee = transactionRecord.transactionFee.toTinybars().toNumber();
            gasUsed = transactionRecord.contractFunctionResult
              ? transactionRecord.contractFunctionResult.gasUsed.toNumber()
              : 0;
          } catch (err: any) {
            const recordQueryError = new SDKClientError(err, err.message);
            this.logger.error(
              recordQueryError,
              `${formattedRequestId} Error raised during TransactionRecordQuery for ${transactionResponse.transactionId}`,
            );
          }
        } finally {
          if (transactionFee !== 0) {
            this.logger.trace(
              `${formattedRequestId} Capturing HBAR charged transaction fee: transactionId=${transactionResponse.transactionId}, txConstructorName=${transactionType}, callerName=${callerName}, txChargedFee=${transactionFee} tinybars`,
            );
            this.hbarLimiter.addExpense(transactionFee, currentDateNow);
            this.captureMetrics(
              SDKClient.transactionMode,
              transactionType,
              Status.Success,
              transactionFee,
              gasUsed,
              callerName,
              interactingEntity,
            );
          }
        }
      }
    } catch (e: any) {
      // declare main error as SDKClientError
      const sdkClientError = new SDKClientError(e, e.message);

      // log and throw
      this.logger.warn(
        `${formattedRequestId} Fail to executeAll for ${transactionType} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${sdkClientError.status}(${sdkClientError.status._code})`,
      );
      throw sdkClientError;
    }
  }

  async executeGetTransactionRecord(transactionResponse: TransactionResponse, callerName: string, requestId: string) {
    let gasUsed: any = 0;
    let transactionFee: number = 0;
    const formattedRequestId = formatRequestIdMessage(requestId);
    const transactionId: string = transactionResponse.transactionId.toString();

    try {
      if (!transactionResponse.getRecord) {
        throw new SDKClientError(
          {},
          `${formattedRequestId} Invalid response format, expected record availability: ${JSON.stringify(
            transactionResponse,
          )}`,
        );
      }

      // get transactionRecord
      this.logger.trace(`${formattedRequestId} Get transaction record: transactionId=${transactionId}`);
      const transactionRecord: TransactionRecord = await transactionResponse.getRecord(this.clientMain);

      // get transactionFee and gasUsed for metrics
      transactionFee = transactionRecord.transactionFee.toTinybars().toNumber();
      gasUsed = transactionRecord.contractFunctionResult
        ? transactionRecord.contractFunctionResult.gasUsed.toNumber()
        : 0;

      return { transactionFee, gasUsed };
    } catch (e: any) {
      // log error from getRecord
      const sdkClientError = new SDKClientError(e, e.message);
      this.logger.debug(
        `${formattedRequestId} Error raised during transactionResponse.getRecord: transactionId=${transactionId} callerName=${callerName} recordStatus=${sdkClientError.status} (${sdkClientError.status._code}), cost=${transactionFee}, gasUsed=${gasUsed}`,
      );
      throw sdkClientError;
    }
  }

  private captureMetrics = (mode, type, status, cost, gas, caller, interactingEntity) => {
    const resolvedCost = cost ? cost : 0;
    const resolvedGas = typeof gas === 'object' ? gas.toInt() : 0;
    this.consensusNodeClientHistogramCost.labels(mode, type, status, caller, interactingEntity).observe(resolvedCost);
    this.consensusNodeClientHistogramGasFee.labels(mode, type, status, caller, interactingEntity).observe(resolvedGas);
  };

  /**
   * Internal helper method that removes the leading 0x if there is one.
   * @param input
   * @private
   */
  private static prune0x(input: string): string {
    return input.startsWith('0x') ? input.substring(2) : input;
  }

  private static HbarToWeiBar(balance: AccountBalance): BigNumber {
    return balance.hbars.to(HbarUnit.Tinybar).multipliedBy(constants.TINYBAR_TO_WEIBAR_COEF);
  }

  async createFile(
    callData: Uint8Array,
    client: Client,
    requestId: string,
    callerName: string,
    interactingEntity: string,
  ): Promise<FileId | null> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const hexedCallData = Buffer.from(callData).toString('hex');

    // prepare fileCreateTx
    const fileCreateTx = new FileCreateTransaction()
      .setContents(hexedCallData.substring(0, this.fileAppendChunkSize))
      .setKeys(client.operatorPublicKey ? [client.operatorPublicKey] : []);

    // use executeTransaction() to execute fileCreateTx -> handle errors -> capture HBAR burned in metrics and hbar rate limit class
    const fileCreateTxResponse = await this.executeTransaction(
      fileCreateTx,
      callerName,
      interactingEntity,
      formattedRequestId,
      true,
    );

    const { fileId } = await fileCreateTxResponse.getReceipt(client);

    if (fileId && callData.length > this.fileAppendChunkSize) {
      const fileAppendTx = new FileAppendTransaction()
        .setFileId(fileId)
        .setContents(hexedCallData.substring(this.fileAppendChunkSize, hexedCallData.length))
        .setChunkSize(this.fileAppendChunkSize)
        .setMaxChunks(this.maxChunks);

      // use executeAllTransaction() to executeAll fileAppendTx -> handle errors -> capture HBAR burned in metrics and hbar rate limit class
      await this.executeAllTransaction(fileAppendTx, callerName, interactingEntity, formattedRequestId, true);
    }

    // Ensure that the calldata file is not empty
    if (fileId) {
      const fileSize = (await new FileInfoQuery().setFileId(fileId).execute(client)).size;

      if (fileSize.isZero()) {
        throw new SDKClientError({}, `${formattedRequestId} Created file is empty. `);
      }
      this.logger.trace(`${formattedRequestId} Created file with fileId: ${fileId} and file size ${fileSize}`);
    }

    return fileId;
  }

  /**
   * @dev Deletes `fileId` file from the Hedera Network utilizing Hashgraph SDK client
   * @param fileId
   * @param requestId
   * @param callerName
   * @param interactingEntity
   */
  async deleteFile(fileId: FileId, requestId: string, callerName: string, interactingEntity: string): Promise<void> {
    // format request ID msg
    const requestIdPrefix = formatRequestIdMessage(requestId);

    try {
      // Create fileDeleteTx
      const fileDeleteTx = new FileDeleteTransaction()
        .setFileId(fileId)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.clientMain);

      await this.executeTransaction(fileDeleteTx, callerName, interactingEntity, requestId, false);

      // ensure the file is deleted
      const fileInfo = await new FileInfoQuery().setFileId(fileId).execute(this.clientMain);

      if (fileInfo.isDeleted) {
        this.logger.trace(`${requestIdPrefix} Deleted file with fileId: ${fileId}`);
      } else {
        this.logger.warn(`${requestIdPrefix} Fail to delete file with fileId: ${fileId} `);
      }
    } catch (error: any) {
      this.logger.warn(`${requestIdPrefix} ${error['message']} `);
    }
  }
}
