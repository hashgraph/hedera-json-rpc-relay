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
  Hbar,
  Query,
  Status,
  Client,
  FileId,
  HbarUnit,
  AccountId,
  ContractId,
  Transaction,
  AccountInfo,
  FeeSchedules,
  TransactionId,
  ExchangeRates,
  FileInfoQuery,
  FeeComponents,
  AccountBalance,
  AccountInfoQuery,
  FileContentsQuery,
  ContractCallQuery,
  TransactionResponse,
  PrecheckStatusError,
  AccountBalanceQuery,
  EthereumTransaction,
  ContractByteCodeQuery,
  FileAppendTransaction,
  FileCreateTransaction,
  FileDeleteTransaction,
  ContractFunctionResult,
  EthereumTransactionData,
} from '@hashgraph/sdk';
import { Logger } from 'pino';
import HbarLimit from '../hbarlimiter';
import constants from './../constants';
import { Histogram } from 'prom-client';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { formatRequestIdMessage } from '../../formatters';
import { SDKClientError } from './../errors/SDKClientError';
import { JsonRpcError, predefined } from './../errors/JsonRpcError';
import { CacheService } from '../services/cacheService/cacheService';
import TransactionService from '../services/transactionService/transactionService';

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

  /**
   * Constructs an instance of the class with specified dependencies and configuration.
   * @param {Client} clientMain - The main client used for interacting with the network.
   * @param {Logger} logger - The logger used for logging information and errors.
   * @param {HbarLimit} hbarLimiter - The service used for limiting HBAR usage.
   * @param {any} metrics - The metrics object for tracking cost and gas usage.
   * @param {CacheService} cacheService - The cache service used for caching data.
   */
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

  /**
   * Retrieves the balance of an account.
   * @param {string} account - The account ID to query.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<AccountBalance>} The balance of the account.
   * @throws {SDKClientError} Throws an SDK client error if the balance retrieval fails.
   */
  async getAccountBalance(account: string, callerName: string, requestId?: string): Promise<AccountBalance> {
    return this.executeQuery(
      new AccountBalanceQuery().setAccountId(AccountId.fromString(account)),
      this.clientMain,
      callerName,
      account,
      requestId,
    );
  }

  /**
   * Retrieves the balance of an account in tinybars.
   * @param {string} account - The account ID to query.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<BigNumber>} The balance of the account in tinybars.
   * @throws {SDKClientError} Throws an SDK client error if the balance retrieval fails.
   */
  async getAccountBalanceInTinyBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getAccountBalance(account, callerName, requestId);
    return balance.hbars.to(HbarUnit.Tinybar);
  }

  /**
   * Retrieves the balance of an account in weiBars.
   * @param {string} account - The account ID to query.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<BigNumber>} The balance of the account in weiBars.
   * @throws {SDKClientError} Throws an SDK client error if the balance retrieval fails.
   */
  async getAccountBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getAccountBalance(account, callerName, requestId);
    return SDKClient.HbarToWeiBar(balance);
  }

  /**
   * Retrieves information about an account.
   * @param {string} address - The account ID to query.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<AccountInfo>} The information about the account.
   * @throws {SDKClientError} Throws an SDK client error if the account info retrieval fails.
   */
  async getAccountInfo(address: string, callerName: string, requestId?: string): Promise<AccountInfo> {
    return this.executeQuery(
      new AccountInfoQuery().setAccountId(AccountId.fromString(address)),
      this.clientMain,
      callerName,
      address,
      requestId,
    );
  }

  /**
   * Retrieves the bytecode of a contract.
   * @param {number | Long} shard - The shard number of the contract.
   * @param {number | Long} realm - The realm number of the contract.
   * @param {string} address - The address of the contract.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<Uint8Array>} The bytecode of the contract.
   * @throws {SDKClientError} Throws an SDK client error if the bytecode retrieval fails.
   */
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

  /**
   * Retrieves the balance of a contract.
   * @param {string} contract - The contract ID to query.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<AccountBalance>} The balance of the contract.
   * @throws {SDKClientError} Throws an SDK client error if the balance retrieval fails.
   */
  async getContractBalance(contract: string, callerName: string, requestId?: string): Promise<AccountBalance> {
    return this.executeQuery(
      new AccountBalanceQuery().setContractId(ContractId.fromString(contract)),
      this.clientMain,
      callerName,
      contract,
      requestId,
    );
  }

  /**
   * Retrieves the balance of a contract in weiBars.
   * Converts the balance from Hbar to weiBars using the `HbarToWeiBar` method.
   * @param {string} account - The account address of the contract.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<BigNumber>} The contract balance in weiBars.
   * @throws {SDKClientError} Throws an SDK client error if the balance retrieval fails.
   */
  async getContractBalanceInWeiBar(account: string, callerName: string, requestId?: string): Promise<BigNumber> {
    const balance = await this.getContractBalance(account, callerName, requestId);
    return SDKClient.HbarToWeiBar(balance);
  }

  /**
   * Retrieves the current exchange rates from a file.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<ExchangeRates>} The exchange rates.
   * @throws {SDKClientError} Throws an SDK client error if the exchange rates file retrieval or parsing fails.
   */
  async getExchangeRate(callerName: string, requestId?: string): Promise<ExchangeRates> {
    const exchangeFileBytes = await this.getFileIdBytes(constants.EXCHANGE_RATE_FILE_ID, callerName, requestId);

    return ExchangeRates.fromBytes(exchangeFileBytes);
  }

  /**
   * Retrieves the fee schedule from a file.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<FeeSchedules>} The fee schedules.
   * @throws {SDKClientError} Throws an SDK client error if the fee schedule file retrieval or parsing fails.
   */
  async getFeeSchedule(callerName: string, requestId?: string): Promise<FeeSchedules> {
    const feeSchedulesFileBytes = await this.getFileIdBytes(constants.FEE_SCHEDULE_FILE_ID, callerName, requestId);
    return FeeSchedules.fromBytes(feeSchedulesFileBytes);
  }

  /**
   * Retrieves the gas fee in tinybars for Ethereum transactions.
   * Caches the result to avoid repeated fee schedule queries.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<number>} The gas fee in tinybars.
   * @throws {SDKClientError} Throws an SDK client error if the fee schedules or exchange rates are invalid.
   */
  async getTinyBarGasFee(callerName: string, requestId?: string): Promise<number> {
    const cachedResponse: number | undefined = await this.cacheService.getAsync(
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

        await this.cacheService.set(
          constants.CACHE_KEY.GET_TINYBAR_GAS_FEE,
          tinyBars,
          callerName,
          undefined,
          requestId,
        );
        return tinyBars;
      }
    }

    throw new SDKClientError({}, `${constants.ETH_FUNCTIONALITY_CODE} code not found in feeSchedule`);
  }

  /**
   * Retrieves the contents of a file identified by its ID and returns them as a byte array.
   * @param {string} address - The file ID or address of the file to retrieve.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<Uint8Array>} The contents of the file as a byte array.
   * @throws {SDKClientError} Throws an SDK client error if the file query fails.
   */
  async getFileIdBytes(address: string, callerName: string, requestId?: string): Promise<Uint8Array> {
    return this.executeQuery(
      new FileContentsQuery().setFileId(address),
      this.clientMain,
      callerName,
      address,
      requestId,
    );
  }

  /**
   * Submits an Ethereum transaction and handles call data that exceeds the maximum chunk size.
   * If the call data is too large, it creates a file to store the excess data and updates the transaction accordingly.
   * Also calculates and sets the maximum transaction fee based on the current gas price.
   *
   * @param {Uint8Array} transactionBuffer - The transaction data in bytes.
   * @param {string} callerName - The name of the caller initiating the transaction.
   * @param {string} requestId - The unique identifier for the request.
   * @param {TransactionService} transactionService - The service responsible for handling transaction execution.
   * @returns {Promise<{ txResponse: TransactionResponse; fileId: FileId | null }>}
   * @throws {SDKClientError} Throws an error if no file ID is created or if the preemptive fee check fails.
   */
  async submitEthereumTransaction(
    transactionBuffer: Uint8Array,
    callerName: string,
    requestId: string,
    transactionService: TransactionService,
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
        transactionService,
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
      txResponse: await this.executeTransaction(
        ethereumTransaction,
        callerName,
        interactingEntity,
        requestId,
        true,
        transactionService,
      ),
    };
  }

  /**
   * Submits a contract call query to a smart contract on the Hedera network.
   * @param {string} to - The address of the contract to call, in either Solidity or EVM format.
   * @param {string} data - The encoded function parameters for the contract call, in hexadecimal format.
   * @param {number} gas - The amount of gas to use for the contract call.
   * @param {string} from - The address of the sender in EVM format.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - Optional request ID for logging purposes.
   * @returns {Promise<ContractFunctionResult>} The result of the contract function call.
   * @throws {SDKClientError} Throws an SDK client error if the contract call query fails.
   */
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

  /**
   * Submits a contract call query with retries in case of timeout errors.
   * @param {string} to - The address of the contract to call.
   * @param {string} data - The data to send with the contract call.
   * @param {number} gas - The amount of gas to use for the contract call.
   * @param {string} from - The address from which the contract call is made.
   * @param {string} callerName - The name of the caller for logging purposes.
   * @param {string} [requestId] - The request ID for logging purposes.
   * @returns {Promise<ContractFunctionResult>} The result of the contract function call.
   * @throws {JsonRpcError} Throws an error if the error is a JSON-RPC error.
   * @throws {SDKClientError} Throws an SDK client error if the error is not a timeout error or if the retries are exhausted.
   */
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

  /**
   * Increases the query cost and retries the query execution if the initial attempt fails due to insufficient transaction fees.
   * @param {Query<any>} query - The query to be executed.
   * @param {Hbar} baseCost - The base cost of the query.
   * @param {Client} client - The client to use for executing the query.
   * @param {number} maxRetries - The maximum number of retries allowed.
   * @param {number} currentRetry - The current retry attempt number.
   * @param {string} [requestId] - The request ID for logging purposes.
   * @returns {Promise<{resp: any, cost: Hbar}>} The response of the query execution and the cost used.
   * @throws Will throw an error if the maximum number of retries is exceeded or if the error is not due to insufficient transaction fees.
   */
  async increaseCostAndRetryExecution(
    query: Query<any>,
    baseCost: Hbar,
    client: Client,
    maxRetries: number,
    currentRetry: number,
    requestId?: string,
  ): Promise<{ resp: any; cost: Hbar }> {
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

  /**
   * Executes a Hedera query and handles potential errors.
   * @param {Query<T>} query - The Hedera query to execute.
   * @param {Client} client - The Hedera client to use for the query.
   * @param {string} callerName - The name of the caller executing the query.
   * @param {string} interactingEntity - The entity interacting with the query.
   * @param {string} [requestId] - The optional request ID for logging and tracking.
   * @returns {Promise<T>} A promise resolving to the query response.
   * @throws {Error} Throws an error if the query fails or if rate limits are exceeded.
   */
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
   *
   * @param {Transaction} transaction - The transaction to execute.
   * @param {string} callerName - The name of the caller requesting the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} requestId - The ID of the request.
   * @param {boolean} shouldThrowHbarLimit - Flag to indicate whether to check HBAR limits.
   * @param {TransactionService} transactionService - The service to handle transaction-related operations.
   * @returns {Promise<TransactionResponse>} - A promise that resolves to the transaction response.
   * @throws {SDKClientError} - Throws if an error occurs during transaction execution.
   */
  async executeTransaction(
    transaction: Transaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
    transactionService: TransactionService,
  ): Promise<TransactionResponse> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const transactionType = transaction.constructor.name;
    const currentDateNow = Date.now();
    let gasUsed: number = 0;
    let transactionFee: number = 0;
    let txRecordChargeAmount: number = 0;
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

      const getTxResultAndMetricsResult = await transactionService.getTransactionStatusAndMetrics(
        transactionResponse.transactionId.toString(),
        callerName,
        requestId,
        transaction.constructor.name,
        this.clientMain.operatorAccountId!.toString(),
      );
      const transactionStatus = getTxResultAndMetricsResult.transactionStatus;
      gasUsed = getTxResultAndMetricsResult.gasUsed;
      transactionFee = getTxResultAndMetricsResult.transactionFee;
      txRecordChargeAmount = getTxResultAndMetricsResult.txRecordChargeAmount;

      // Throw WRONG_NONCE error as more error handling logic for WRONG_NONCE is awaited in eth.sendRawTransactionErrorHandler().
      // Otherwise, move on and return transactionResponse eventually.
      if (transactionStatus === Status.WrongNonce.toString()) {
        const error = {
          status: Status.WrongNonce,
          message: `receipt for transaction ${transactionResponse.transactionId} contained error status WRONG_NONCE`,
        };

        throw new SDKClientError(error, error.message);
      }

      this.logger.info(
        `${formattedRequestId} Successfully execute ${transactionType} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${Status.Success}(${Status.Success._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );
      return transactionResponse;
    } catch (e: any) {
      // throw if JsonRpcError
      if (e instanceof JsonRpcError) {
        throw e;
      }

      // declare error as SDKClientError
      const sdkClientError = new SDKClientError(e, e.message);

      // Throw WRONG_NONCE error as more error handling logic for WRONG_NONCE is awaited in eth.sendRawTransactionErrorHandler().
      if (sdkClientError.status && sdkClientError.status === Status.WrongNonce) {
        throw sdkClientError;
      }

      // capture metrics in case .execute() fails and throw an error
      // if valid network error utilize transaction id to get transactionFee and gasUsed for metrics
      if (sdkClientError.isValidNetworkError()) {
        const getTxResultAndMetricsResult = await transactionService.getTransactionStatusAndMetrics(
          transaction.transactionId!.toString(),
          callerName,
          requestId,
          transaction.constructor.name,
          this.clientMain.operatorAccountId!.toString(),
        );
        transactionFee = getTxResultAndMetricsResult.transactionFee;
        txRecordChargeAmount = getTxResultAndMetricsResult.txRecordChargeAmount;
        gasUsed = getTxResultAndMetricsResult.gasUsed;
      }

      // log and throw
      this.logger.warn(
        sdkClientError,
        `${formattedRequestId} Fail to execute ${transactionType} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${sdkClientError.status}(${sdkClientError.status._code}), cost=${transactionFee} tinybars, gasUsed=${gasUsed}`,
      );

      if (!transactionResponse) {
        throw predefined.INTERNAL_ERROR(
          `${formattedRequestId} Transaction execution returns a null value for transaction ${transaction.transactionId}`,
        );
      }
      return transactionResponse;
    } finally {
      /**
       * @note Capturing the charged fees at the end of the flow ensures these fees are eventually
       *       captured in the metrics and rate limiter class, even if SDK transactions fail at any point.
       */
      if (transactionFee !== 0) {
        this.addExpenseAndCaptureMetrics(
          `TransactionExecution`,
          transaction.transactionId!,
          transactionType,
          callerName,
          transactionFee,
          gasUsed,
          interactingEntity,
          formattedRequestId,
        );
      }

      if (txRecordChargeAmount !== 0) {
        this.addExpenseAndCaptureMetrics(
          `TransactionRecordQuery`,
          transaction.transactionId!,
          transactionType,
          callerName,
          txRecordChargeAmount,
          gasUsed,
          interactingEntity,
          formattedRequestId,
        );
      }
    }
  }

  /**
   * Executes all transactions in a batch, checks HBAR limits, retrieves metrics, and captures expenses.
   *
   * @param {FileAppendTransaction} transaction - The batch transaction to execute.
   * @param {string} callerName - The name of the caller requesting the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} requestId - The ID of the request.
   * @param {boolean} shouldThrowHbarLimit - Flag to indicate whether to check HBAR limits.
   * @param {TransactionService} transactionService - The service to handle transaction-related operations.
   * @returns {Promise<void>} - A promise that resolves when the batch execution is complete.
   * @throws {SDKClientError} - Throws if an error occurs during batch transaction execution.
   */
  async executeAllTransaction(
    transaction: FileAppendTransaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
    transactionService: TransactionService,
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

      // loop through transactionResponses to retrieve metrics from each response
      for (let transactionResponse of transactionResponses) {
        let gasUsed: number = 0;
        let transactionFee: number = 0;
        let txRecordChargeAmount: number = 0;

        // retrieve transaction status and metrics (transaction fee & gasUsed).
        // transactionService.getTransactionStatusAndMetrics() will not throw an error when transactions contain error statuses.
        // Instead, it will return transaction records with statuses attached, ensuring the loop won't be broken.
        const getTxResultAndMetricsResult = await transactionService.getTransactionStatusAndMetrics(
          transactionResponse.transactionId.toString(),
          callerName,
          requestId,
          transaction.constructor.name,
          this.clientMain.operatorAccountId!.toString(),
        );

        this.logger.info(
          `${requestId} Successfully execute ${transactionType} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, transactionType=${transactionType}, status=${Status.Success}(${Status.Success._code}), cost=${getTxResultAndMetricsResult.transactionFee} tinybars, gasUsed=${getTxResultAndMetricsResult.gasUsed}`,
        );

        // extract metrics
        gasUsed = getTxResultAndMetricsResult.gasUsed;
        transactionFee = getTxResultAndMetricsResult.transactionFee;
        txRecordChargeAmount = getTxResultAndMetricsResult.txRecordChargeAmount;

        // capture metrics
        if (transactionFee !== 0) {
          this.addExpenseAndCaptureMetrics(
            `TransactionExecution`,
            transaction.transactionId!,
            transactionType,
            callerName,
            transactionFee,
            gasUsed,
            interactingEntity,
            formattedRequestId,
          );
        }

        if (txRecordChargeAmount !== 0) {
          this.addExpenseAndCaptureMetrics(
            `TransactionRecordQuery`,
            transaction.transactionId!,
            transactionType,
            callerName,
            txRecordChargeAmount,
            gasUsed,
            interactingEntity,
            formattedRequestId,
          );
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

  /**
   * Creates a file on the Hedera network using the provided call data.
   * @param {Uint8Array} callData - The data to be written to the file.
   * @param {Client} client - The Hedera client to use for the transaction.
   * @param {string} requestId - The request ID associated with the transaction.
   * @param {string} callerName - The name of the caller creating the file.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {TransactionService} transactionService - The service to handle transaction-related operations.
   * @returns {Promise<FileId | null>} A promise that resolves to the created file ID or null if the creation failed.
   * @throws Will throw an error if the created file is empty or if any transaction fails during execution.
   */
  async createFile(
    callData: Uint8Array,
    client: Client,
    requestId: string,
    callerName: string,
    interactingEntity: string,
    transactionService: TransactionService,
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
      transactionService,
    );

    const { fileId } = await fileCreateTxResponse.getReceipt(client);

    if (fileId && callData.length > this.fileAppendChunkSize) {
      const fileAppendTx = new FileAppendTransaction()
        .setFileId(fileId)
        .setContents(hexedCallData.substring(this.fileAppendChunkSize, hexedCallData.length))
        .setChunkSize(this.fileAppendChunkSize)
        .setMaxChunks(this.maxChunks);

      // use executeAllTransaction() to executeAll fileAppendTx -> handle errors -> capture HBAR burned in metrics and hbar rate limit class
      await this.executeAllTransaction(
        fileAppendTx,
        callerName,
        interactingEntity,
        formattedRequestId,
        true,
        transactionService,
      );
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
   * @param {TransactionService} transactionService - The service to handle transaction-related operations.
   */
  async deleteFile(
    fileId: FileId,
    requestId: string,
    callerName: string,
    interactingEntity: string,
    transactionService: TransactionService,
  ): Promise<void> {
    // format request ID msg
    const requestIdPrefix = formatRequestIdMessage(requestId);

    try {
      // Create fileDeleteTx
      const fileDeleteTx = new FileDeleteTransaction()
        .setFileId(fileId)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.clientMain);

      await this.executeTransaction(fileDeleteTx, callerName, interactingEntity, requestId, false, transactionService);

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

  /**
   * Converts the gas price to tinybars using the provided fee components and exchange rates.
   * @private
   *
   * @param {FeeComponents | undefined} feeComponents - The fee components to use for the conversion.
   * @param {ExchangeRates} exchangeRates - The exchange rates to use for the conversion.
   * @returns {number} The converted gas price in tinybars.
   */
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

  /**
   * Captures and records metrics for a transaction.
   * @private
   * @param {string} mode - The mode of the transaction (e.g., consensus mode).
   * @param {string} type - The type of the transaction.
   * @param {string} status - The status of the transaction.
   * @param {number} cost - The cost of the transaction in tinybars.
   * @param {number | object} gas - The gas used by the transaction.
   * @param {string} caller - The name of the caller executing the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   */
  private captureMetrics = (mode, type, status, cost, gas, caller, interactingEntity) => {
    const resolvedCost = cost ? cost : 0;
    const resolvedGas = typeof gas === 'object' ? gas.toInt() : 0;
    this.consensusNodeClientHistogramCost.labels(mode, type, status, caller, interactingEntity).observe(resolvedCost);
    this.consensusNodeClientHistogramGasFee.labels(mode, type, status, caller, interactingEntity).observe(resolvedGas);
  };

  /**
   * Removes the '0x' prefix from a string if it exists.
   * @private
   * @param {string} input - The input string to be pruned.
   * @returns {string} The input string without the '0x' prefix.
   */
  private static prune0x(input: string): string {
    return input.startsWith('0x') ? input.substring(2) : input;
  }

  /**
   * Converts an account balance from Hbars to WeiBars.
   * @private
   * @param {AccountBalance} balance - The account balance in Hbars.
   * @returns {BigNumber} The account balance converted to WeiBars.
   */
  private static HbarToWeiBar(balance: AccountBalance): BigNumber {
    return balance.hbars.to(HbarUnit.Tinybar).multipliedBy(constants.TINYBAR_TO_WEIBAR_COEF);
  }

  /**
   * Adds an expense and captures metrics related to the transaction execution.
   * @private
   * @param {string} executionType - The type of execution (e.g., transaction or query).
   * @param {string} transactionId - The ID of the transaction being executed.
   * @param {string} transactionType - The type of transaction (e.g., contract call, file create).
   * @param {string} callerName - The name of the entity calling the transaction.
   * @param {number} cost - The cost of the transaction in tinybars.
   * @param {number} gasUsed - The amount of gas used for the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} formattedRequestId - The formatted request ID for logging purposes.
   */
  private addExpenseAndCaptureMetrics = (
    executionType: string,
    transactionId: TransactionId,
    transactionType: string,
    callerName: string,
    cost: number,
    gasUsed: number,
    interactingEntity: string,
    formattedRequestId: string,
  ) => {
    const currentDateNow = Date.now();
    this.logger.trace(
      `${formattedRequestId} Capturing HBAR charged: executionType=${executionType} transactionId=${transactionId}, txConstructorName=${transactionType}, callerName=${callerName}, cost=${cost} tinybars`,
    );
    this.hbarLimiter.addExpense(cost, currentDateNow);
    this.captureMetrics(
      SDKClient.transactionMode,
      transactionType,
      Status.Success,
      cost,
      gasUsed,
      callerName,
      interactingEntity,
    );
  };
}
