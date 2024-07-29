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
  AccountInfoQuery,
  Client,
  ContractByteCodeQuery,
  ContractCallQuery,
  ExchangeRates,
  FeeSchedules,
  FileContentsQuery,
  ContractId,
  ContractFunctionResult,
  TransactionResponse,
  AccountInfo,
  HbarUnit,
  TransactionId,
  FeeComponents,
  Query,
  Transaction,
  TransactionRecord,
  Status,
  FileCreateTransaction,
  FileAppendTransaction,
  FileInfoQuery,
  EthereumTransaction,
  EthereumTransactionData,
  PrecheckStatusError,
  TransactionRecordQuery,
  Hbar,
  FileId,
  FileDeleteTransaction,
} from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from 'pino';
import { formatRequestIdMessage, getTransferAmountSumForAccount } from '../../formatters';
import HbarLimit from '../hbarlimiter';
import constants from './../constants';
import { SDKClientError } from './../errors/SDKClientError';
import { JsonRpcError, predefined } from './../errors/JsonRpcError';
import { CacheService } from '../services/cacheService/cacheService';

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

  private consensusNodeClientHistogramCost;
  private consensusNodeClientHistogramGasFee;
  private operatorAccountGauge;
  private maxChunks;
  private fileAppendChunkSize;

  // populate with consensusnode requests via SDK
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
    this.operatorAccountGauge = metrics.operatorGauge;

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
      txResponse: await this.executeTransaction(ethereumTransaction, callerName, interactingEntity, requestId),
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

  private executeQuery = async (
    query: Query<any>,
    client: Client,
    callerName: string,
    interactingEntity: string,
    requestId?: string,
  ) => {
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
  };

  private executeTransaction = async (
    transaction: Transaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
  ): Promise<TransactionResponse> => {
    const transactionType = transaction.constructor.name;
    const currentDateNow = Date.now();
    let gasUsed: number = 0;
    let transactionFee: number = 0;
    let transactionResponse: TransactionResponse | null = null;
    try {
      // check hbar limit before executing transaction
      if (this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.recordMode, callerName)) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }

      // execute transaction
      this.logger.info(`${requestId} Execute ${transactionType} transaction`);
      transactionResponse = await transaction.execute(this.clientMain);

      // retrieve and capture transaction fee in metrics and rate limiter class
      const getRecordResult = await this.executeGetTransactionRecord(transactionResponse, callerName, requestId);
      gasUsed = getRecordResult.gasUsed;
      transactionFee = getRecordResult.transactionFee;

      this.logger.info(
        `${requestId} Successfully execute ${transactionType} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${Status.Success}(${Status.Success._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );
      return transactionResponse;
    } catch (e: any) {
      // declare main error
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
          transactionFee = transactionRecord.transactionFee.toTinybars().toNumber();
          gasUsed = transactionRecord.contractFunctionResult
            ? transactionRecord.contractFunctionResult.gasUsed.toNumber()
            : 0;
        } catch (err: any) {
          const recordQueryError = new SDKClientError(err, err.message);
          this.logger.error(
            recordQueryError,
            `${requestId} Error raised during TransactionRecordQuery for ${transaction.transactionId}`,
          );
        }
      }

      // log and throw
      this.logger.debug(
        `${requestId} Fail to execute ${transactionType} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${sdkClientError.status}(${sdkClientError.status._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );

      // Throw WRONG_NONCE error as more error handling logic for WRONG_NONCE is awaited in eth.sendRawTransactionErrorHandler(). Otherwise, move on and return transactionResponse eventually.
      if (e.status && e.status.toString() === constants.TRANSACTION_RESULT_STATUS.WRONG_NONCE) {
        throw sdkClientError;
      } else {
        if (!transactionResponse) {
          throw predefined.INTERNAL_ERROR(
            `${requestId} Transaction execution returns a null value for transaction ${transaction.transactionId}`,
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
          `${requestId} Capturing HBAR charged transaction fee: transactionId=${transaction.transactionId}, txConstructorName=${transactionType}, callerName=${callerName}, txChargedFee=${transactionFee} tinybars`,
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
  };

  async executeGetTransactionRecord(transactionResponse: TransactionResponse, callerName: string, requestId: string) {
    const currentDateNow = Date.now();
    let gasUsed: any = 0;
    let transactionFee: number = 0;
    const transactionId: string = transactionResponse.transactionId.toString();

    const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.recordMode, callerName);
    if (shouldLimit) {
      throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
    }

    try {
      if (!transactionResponse.getRecord) {
        throw new SDKClientError(
          {},
          `${requestId} Invalid response format, expected record availability: ${JSON.stringify(transactionResponse)}`,
        );
      }

      // get transactionRecord
      const transactionRecord: TransactionRecord = await transactionResponse.getRecord(this.clientMain);

      // get transactionFee and gasUsed for metrics
      /**
       * @todo: Determine how to separate the fee charged exclusively by the operator because
       *        the transactionFee below includes the entire charges of the transaction,
       *        with some portions paid by tx.from, not the operator.
       */
      transactionFee = getTransferAmountSumForAccount(transactionRecord, this.clientMain.operatorAccountId!.toString());
      gasUsed = transactionRecord.contractFunctionResult
        ? transactionRecord.contractFunctionResult.gasUsed.toNumber()
        : 0;

      return { transactionFee, gasUsed };
    } catch (e: any) {
      // log error from getRecord
      const sdkClientError = new SDKClientError(e, e.message);
      this.logger.debug(
        `${requestId} Error raised during transactionResponse.getRecord: transactionId=${transactionId} callerName=${callerName} recordStatus=${sdkClientError.status} (${sdkClientError.status._code}), cost=${transactionFee}, gasUsed=${gasUsed}`,
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

  private createFile = async (
    callData: Uint8Array,
    client: Client,
    requestId: string,
    callerName: string,
    interactingEntity: string,
  ) => {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const hexedCallData = Buffer.from(callData).toString('hex');
    const currentDateNow = Date.now();
    let fileCreateTx, fileAppendTx;

    try {
      const shouldLimit = this.hbarLimiter.shouldLimit(currentDateNow, SDKClient.transactionMode, callerName);
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }

      fileCreateTx = await new FileCreateTransaction()
        .setContents(hexedCallData.substring(0, this.fileAppendChunkSize))
        .setKeys(client.operatorPublicKey ? [client.operatorPublicKey] : []);

      const fileCreateTxResponse = await fileCreateTx.execute(client);
      const { fileId } = await fileCreateTxResponse.getReceipt(client);

      // get transaction fee and add expense to limiter
      const createFileRecord = await fileCreateTxResponse.getRecord(this.clientMain);
      let transactionFee = createFileRecord.transactionFee as Hbar;
      this.hbarLimiter.addExpense(transactionFee.toTinybars().toNumber(), currentDateNow);

      this.captureMetrics(
        SDKClient.transactionMode,
        fileCreateTx.constructor.name,
        Status.Success,
        createFileRecord.transactionFee.toTinybars().toNumber(),
        createFileRecord?.contractFunctionResult?.gasUsed,
        callerName,
        interactingEntity,
      );

      if (fileId && callData.length > this.fileAppendChunkSize) {
        fileAppendTx = await new FileAppendTransaction()
          .setFileId(fileId)
          .setContents(hexedCallData.substring(this.fileAppendChunkSize, hexedCallData.length))
          .setChunkSize(this.fileAppendChunkSize)
          .setMaxChunks(this.maxChunks);
        const fileAppendTxResponses = await fileAppendTx.executeAll(client);

        for (let fileAppendTxResponse of fileAppendTxResponses) {
          // get transaction fee and add expense to limiter
          const appendFileRecord = await fileAppendTxResponse.getRecord(this.clientMain);
          const tinybarsCost = appendFileRecord.transactionFee.toTinybars().toNumber();

          this.captureMetrics(
            SDKClient.transactionMode,
            fileAppendTx.constructor.name,
            Status.Success,
            tinybarsCost,
            0,
            callerName,
            interactingEntity,
          );
          this.hbarLimiter.addExpense(tinybarsCost, currentDateNow);
        }
      }

      // Ensure that the calldata file is not empty
      if (fileId) {
        const fileSize = await (await new FileInfoQuery().setFileId(fileId).execute(client)).size;

        if (callData.length > 0 && fileSize.isZero()) {
          throw new SDKClientError({}, `${requestIdPrefix} Created file is empty. `);
        }
        this.logger.trace(`${requestIdPrefix} Created file with fileId: ${fileId} and file size ${fileSize}`);
      }

      return fileId;
    } catch (error: any) {
      const sdkClientError = new SDKClientError(error, error.message);
      let transactionFee: number | Hbar = 0;

      // if valid network error utilize transaction id
      if (sdkClientError.isValidNetworkError()) {
        try {
          const transactionCreateRecord = await new TransactionRecordQuery()
            .setTransactionId(fileCreateTx.transactionId!)
            .setNodeAccountIds(fileCreateTx.nodeAccountIds!)
            .setValidateReceiptStatus(false)
            .execute(this.clientMain);
          transactionFee = transactionCreateRecord.transactionFee;
          this.hbarLimiter.addExpense(transactionFee.toTinybars().toNumber(), currentDateNow);

          this.captureMetrics(
            SDKClient.transactionMode,
            fileCreateTx.constructor.name,
            sdkClientError.status,
            transactionFee.toTinybars().toNumber(),
            transactionCreateRecord?.contractFunctionResult?.gasUsed,
            callerName,
            interactingEntity,
          );

          this.logger.info(
            `${requestIdPrefix} ${fileCreateTx.transactionId} ${callerName} ${fileCreateTx.constructor.name} status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${transactionFee}`,
          );

          if (fileAppendTx) {
            const transactionAppendRecord = await new TransactionRecordQuery()
              .setTransactionId(fileAppendTx.transactionId!)
              .setNodeAccountIds(fileAppendTx.nodeAccountIds!)
              .setValidateReceiptStatus(false)
              .execute(this.clientMain);
            transactionFee = transactionAppendRecord.transactionFee;
            this.hbarLimiter.addExpense(transactionFee.toTinybars().toNumber(), currentDateNow);

            this.captureMetrics(
              SDKClient.transactionMode,
              fileCreateTx.constructor.name,
              sdkClientError.status,
              transactionFee.toTinybars().toNumber(),
              transactionCreateRecord?.contractFunctionResult?.gasUsed,
              callerName,
              interactingEntity,
            );

            this.logger.info(
              `${requestIdPrefix} ${fileAppendTx.transactionId} ${callerName} ${fileCreateTx.constructor.name} status: ${sdkClientError.status} (${sdkClientError.status._code}), cost: ${transactionFee}`,
            );
          }
        } catch (err: any) {
          const recordQueryError = new SDKClientError(err, err.message);
          this.logger.error(
            recordQueryError,
            `${requestIdPrefix} Error raised during TransactionRecordQuery for ${fileCreateTx.transactionId}`,
          );
        }
      }

      this.logger.info(`${requestIdPrefix} HBAR_RATE_LIMIT_EXCEEDED cost: ${transactionFee}`);

      if (error instanceof JsonRpcError) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }
      throw sdkClientError;
    }
  };

  /**
   * @dev Deletes `fileId` file from the Hedera Network utilizing Hashgraph SDK client
   * @param fileId
   * @param requestId
   * @param callerName
   * @param interactingEntity
   */
  public deleteFile = async (fileId: FileId, requestId?: string, callerName?: string, interactingEntity?: string) => {
    // format request ID msg
    const currentDateNow = Date.now();
    const requestIdPrefix = formatRequestIdMessage(requestId);

    try {
      // Create fileDeleteTx
      const fileDeleteTx = new FileDeleteTransaction()
        .setFileId(fileId)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.clientMain);

      // execute fileDeleteTx
      const fileDeleteTxResponse = await fileDeleteTx.execute(this.clientMain);

      // get fileDeleteTx's record
      const deleteFileRecord = await fileDeleteTxResponse.getRecord(this.clientMain);

      // capture transactionFee in metrics and HBAR limiter class
      this.hbarLimiter.addExpense(deleteFileRecord.transactionFee.toTinybars().toNumber(), currentDateNow);
      this.captureMetrics(
        SDKClient.transactionMode,
        fileDeleteTx.constructor.name,
        Status.Success,
        deleteFileRecord.transactionFee.toTinybars().toNumber(),
        deleteFileRecord?.contractFunctionResult?.gasUsed,
        callerName,
        interactingEntity,
      );

      // ensure the file is deleted
      const receipt = deleteFileRecord.receipt;
      const fileInfo = await new FileInfoQuery().setFileId(fileId).execute(this.clientMain);

      if (receipt.status === Status.Success && fileInfo.isDeleted) {
        this.logger.trace(`${requestIdPrefix} Deleted file with fileId: ${fileId}`);
      } else {
        this.logger.warn(`${requestIdPrefix} Fail to delete file with fileId: ${fileId} `);
      }
    } catch (error: any) {
      this.logger.warn(`${requestIdPrefix} ${error['message']} `);
    }
  };
}
