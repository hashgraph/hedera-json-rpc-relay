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
  Client,
  Status,
  FileId,
  HbarUnit,
  AccountId,
  ContractId,
  AccountInfo,
  Transaction,
  FeeSchedules,
  ExchangeRate,
  FileInfoQuery,
  TransactionId,
  ExchangeRates,
  FeeComponents,
  AccountBalance,
  AccountInfoQuery,
  ContractCallQuery,
  FileContentsQuery,
  TransactionRecord,
  AccountBalanceQuery,
  EthereumTransaction,
  PrecheckStatusError,
  TransactionResponse,
  FileAppendTransaction,
  FileCreateTransaction,
  FileDeleteTransaction,
  ContractByteCodeQuery,
  ContractFunctionResult,
  TransactionRecordQuery,
  EthereumTransactionData,
} from '@hashgraph/sdk';
import { Logger } from 'pino';
import { EventEmitter } from 'events';
import HbarLimit from '../hbarlimiter';
import constants from './../constants';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { SDKClientError } from './../errors/SDKClientError';
import { JsonRpcError, predefined } from './../errors/JsonRpcError';
import { CacheService } from '../services/cacheService/cacheService';
import { formatRequestIdMessage, weibarHexToTinyBarInt } from '../../formatters';
import { ITransactionRecordMetric, IExecuteQueryEventPayload, IExecuteTransactionEventPayload } from '../types';

const _ = require('lodash');
const LRU = require('lru-cache');

export class SDKClient {
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
   * An instance of EventEmitter used for emitting and handling events within the class.
   *
   * @private
   * @readonly
   * @type {EventEmitter}
   */
  private readonly eventEmitter: EventEmitter;

  /**
   * Constructs an instance of the SDKClient and initializes various services and settings.
   *
   * @param {Client} clientMain - The primary Hedera client instance used for executing transactions and queries.
   * @param {Logger} logger - The logger instance for logging information, warnings, and errors.
   * @param {HbarLimit} hbarLimiter - The Hbar rate limiter instance for managing Hbar transaction budgets.
   * @param {CacheService} cacheService - The cache service instance used for caching and retrieving data.
   * @param {EventEmitter} eventEmitter - The eventEmitter used for emitting and handling events within the class.
   */
  constructor(
    clientMain: Client,
    logger: Logger,
    hbarLimiter: HbarLimit,
    cacheService: CacheService,
    eventEmitter: EventEmitter,
  ) {
    this.clientMain = clientMain;

    if (process.env.CONSENSUS_MAX_EXECUTION_TIME) {
      // sets the maximum time in ms for the SDK to wait when submitting
      // a transaction/query before throwing a TIMEOUT error
      this.clientMain = clientMain.setMaxExecutionTime(Number(process.env.CONSENSUS_MAX_EXECUTION_TIME));
    }

    this.logger = logger;
    this.hbarLimiter = hbarLimiter;
    this.cacheService = cacheService;
    this.eventEmitter = eventEmitter;
    this.maxChunks = Number(process.env.FILE_APPEND_MAX_CHUNKS) || 20;
    this.fileAppendChunkSize = Number(process.env.FILE_APPEND_CHUNK_SIZE) || 5120;
  }

  /**
   * Return current main client instance
   * @returns Main Client
   */
  public getMainClientInstance() {
    return this.clientMain;
  }

  /**
   * Retrieves the balance of a specified Hedera account.
   *
   * @param {string} account - The account ID to retrieve the balance for.
   * @param {string} callerName - The name of the caller requesting the account balance.
   * @param {string} [requestId] - Optional request ID for tracking the request.
   * @returns {Promise<AccountBalance>} - A promise that resolves to the account balance.
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
   * Retrieves the gas fee in tinybars for Ethereum transactions using HAPI and caches the result to avoid repeated fee schedule queries.
   *
   * @note This method should be used as a fallback if retrieving the network gas price with MAPI fails.
   * MAPI does not incur any fees, while HAPI will incur a query fee.
   *
   * @param {string} callerName - The name of the caller, used for logging purposes.
   * @param {string} [requestId] - Optional request ID, used for logging purposes.
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
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @param {number} networkGasPriceInWeiBars - The predefined gas price of the network in weibar.
   * @param {number} currentNetworkExchangeRateInCents - The exchange rate in cents of the current network.
   * @param {string} requestId - The unique identifier for the request.
   * @returns {Promise<{ txResponse: TransactionResponse; fileId: FileId | null }>}
   * @throws {SDKClientError} Throws an error if no file ID is created or if the preemptive fee check fails.
   */
  async submitEthereumTransaction(
    transactionBuffer: Uint8Array,
    callerName: string,
    originalCallerAddress: string,
    networkGasPriceInWeiBars: number,
    currentNetworkExchangeRateInCents: number,
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
      const isPreemtiveCheckOn = process.env.HBAR_RATE_LIMIT_PREEMTIVE_CHECK === 'true';

      if (isPreemtiveCheckOn) {
        this.hbarLimiter.shouldPreemtivelyLimitFileTransactions(
          originalCallerAddress,
          ethereumTransactionData.toString().length,
          this.fileAppendChunkSize,
          currentNetworkExchangeRateInCents,
          requestId,
        );
      }

      fileId = await this.createFile(
        ethereumTransactionData.callData,
        this.clientMain,
        requestId,
        callerName,
        interactingEntity,
        originalCallerAddress,
      );
      if (!fileId) {
        throw new SDKClientError({}, `${requestIdPrefix} No fileId created for transaction. `);
      }
      ethereumTransactionData.callData = new Uint8Array();
      ethereumTransaction.setEthereumData(ethereumTransactionData.toBytes()).setCallDataFileId(fileId);
    }
    const networkGasPriceInTinyBars = weibarHexToTinyBarInt(networkGasPriceInWeiBars);

    ethereumTransaction.setMaxTransactionFee(
      Hbar.fromTinybars(Math.floor(networkGasPriceInTinyBars * constants.MAX_GAS_PER_SEC)),
    );

    return {
      fileId,
      txResponse: await this.executeTransaction(
        ethereumTransaction,
        callerName,
        interactingEntity,
        requestId,
        true,
        originalCallerAddress,
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
    const queryConstructorName = query.constructor.name;
    let queryResponse: any = null;
    let queryCost: number | undefined = undefined;
    let status: string = '';

    this.logger.info(`${requestIdPrefix} Execute ${queryConstructorName} query.`);

    try {
      if (query.paymentTransactionId) {
        const baseCost = await query.getCost(this.clientMain);
        const res = await this.increaseCostAndRetryExecution(query, baseCost, client, 3, 0, requestId);
        queryResponse = res.resp;
        queryCost = res.cost.toTinybars().toNumber();
      } else {
        queryResponse = await query.execute(client);
        queryCost = query._queryPayment?.toTinybars().toNumber();
      }

      status = Status.Success.toString();

      this.logger.info(
        `${requestIdPrefix} Successfully execute ${queryConstructorName} query: paymentTransactionId=${query.paymentTransactionId}, callerName=${callerName}, cost=${queryCost} tinybars`,
      );
      return queryResponse;
    } catch (e: any) {
      const sdkClientError = new SDKClientError(e, e.message);

      queryCost = query._queryPayment?.toTinybars().toNumber();
      status = sdkClientError.status.toString();

      if (e instanceof PrecheckStatusError && e.contractFunctionResult?.errorMessage) {
        throw predefined.CONTRACT_REVERT(e.contractFunctionResult.errorMessage);
      }
      if (sdkClientError.isGrpcTimeout()) {
        throw predefined.REQUEST_TIMEOUT;
      }

      this.logger.debug(
        `${requestIdPrefix} Fail to execute ${queryConstructorName} query: paymentTransactionId=${query.paymentTransactionId}, callerName=${callerName}, status=${sdkClientError.status}(${sdkClientError.status._code}), cost=${queryCost} tinybars`,
      );

      throw sdkClientError;
    } finally {
      if (queryCost && queryCost !== 0) {
        this.eventEmitter.emit(constants.EVENTS.EXECUTE_QUERY, {
          executionMode: constants.EXECUTION_MODE.QUERY,
          transactionId: query.paymentTransactionId?.toString(),
          txConstructorName: queryConstructorName,
          callerName,
          cost: queryCost,
          gasUsed: 0,
          interactingEntity,
          status,
          requestId: requestIdPrefix,
        } as IExecuteQueryEventPayload);
      }
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
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @returns {Promise<TransactionResponse>} - A promise that resolves to the transaction response.
   * @throws {SDKClientError} - Throws if an error occurs during transaction execution.
   */
  async executeTransaction(
    transaction: Transaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
    originalCallerAddress: string,
  ): Promise<TransactionResponse> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const txConstructorName = transaction.constructor.name;
    let transactionId: string = '';
    let transactionResponse: TransactionResponse | null = null;

    if (shouldThrowHbarLimit) {
      const shouldLimit = this.hbarLimiter.shouldLimit(
        Date.now(),
        constants.EXECUTION_MODE.TRANSACTION,
        callerName,
        originalCallerAddress,
        requestId,
      );
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }
    }

    try {
      this.logger.info(`${formattedRequestId} Execute ${txConstructorName} transaction`);
      transactionResponse = await transaction.execute(this.clientMain);

      transactionId = transactionResponse.transactionId.toString();

      // .getReceipt() will throw an error if, in any case, the status !== 22 (SUCCESS).
      const transactionReceipt = await transactionResponse.getReceipt(this.clientMain);

      this.logger.info(
        `${formattedRequestId} Successfully execute ${txConstructorName} transaction: transactionId=${transactionResponse.transactionId}, callerName=${callerName}, status=${transactionReceipt.status}(${transactionReceipt.status._code})`,
      );
      return transactionResponse;
    } catch (e: any) {
      if (e instanceof JsonRpcError) {
        throw e;
      }

      const sdkClientError = new SDKClientError(e, e.message);

      // Throw WRONG_NONCE error as more error handling logic for WRONG_NONCE is awaited in eth.sendRawTransactionErrorHandler().
      if (sdkClientError.status && sdkClientError.status === Status.WrongNonce) {
        throw sdkClientError;
      }

      this.logger.warn(
        sdkClientError,
        `${formattedRequestId} Fail to execute ${txConstructorName} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, status=${sdkClientError.status}(${sdkClientError.status._code})`,
      );

      if (!transactionResponse) {
        throw predefined.INTERNAL_ERROR(
          `${formattedRequestId} Transaction execution returns a null value: transactionId=${transaction.transactionId}, callerName=${callerName}, txConstructorName=${txConstructorName}`,
        );
      }
      return transactionResponse;
    } finally {
      if (transactionId?.length) {
        this.eventEmitter.emit(constants.EVENTS.EXECUTE_TRANSACTION, {
          transactionId,
          callerName,
          requestId,
          txConstructorName,
          operatorAccountId: this.clientMain.operatorAccountId!.toString(),
          interactingEntity,
        } as IExecuteTransactionEventPayload);
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
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @returns {Promise<void>} - A promise that resolves when the batch execution is complete.
   * @throws {SDKClientError} - Throws if an error occurs during batch transaction execution.
   */
  async executeAllTransaction(
    transaction: FileAppendTransaction,
    callerName: string,
    interactingEntity: string,
    requestId: string,
    shouldThrowHbarLimit: boolean,
    originalCallerAddress: string,
  ): Promise<void> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const txConstructorName = transaction.constructor.name;
    let transactionResponses: TransactionResponse[] | null = null;

    if (shouldThrowHbarLimit) {
      const shouldLimit = this.hbarLimiter.shouldLimit(
        Date.now(),
        constants.EXECUTION_MODE.TRANSACTION,
        callerName,
        originalCallerAddress,
        requestId,
      );
      if (shouldLimit) {
        throw predefined.HBAR_RATE_LIMIT_EXCEEDED;
      }
    }

    try {
      this.logger.info(`${formattedRequestId} Execute ${txConstructorName} transaction`);
      transactionResponses = await transaction.executeAll(this.clientMain);

      this.logger.info(
        `${formattedRequestId} Successfully execute all ${transactionResponses.length} ${txConstructorName} transactions: callerName=${callerName}, status=${Status.Success}(${Status.Success._code})`,
      );
    } catch (e: any) {
      const sdkClientError = new SDKClientError(e, e.message);

      this.logger.warn(
        `${formattedRequestId} Fail to executeAll for ${txConstructorName} transaction: transactionId=${transaction.transactionId}, callerName=${callerName}, transactionType=${txConstructorName}, status=${sdkClientError.status}(${sdkClientError.status._code})`,
      );
      throw sdkClientError;
    } finally {
      if (transactionResponses) {
        for (const transactionResponse of transactionResponses) {
          if (transactionResponse.transactionId) {
            this.eventEmitter.emit(constants.EVENTS.EXECUTE_TRANSACTION, {
              transactionId: transactionResponse.transactionId.toString(),
              callerName,
              requestId,
              txConstructorName,
              operatorAccountId: this.clientMain.operatorAccountId!.toString(),
              interactingEntity,
            } as IExecuteTransactionEventPayload);
          }
        }
      }
    }
  }

  /**
   * Creates a file on the Hedera network using the provided call data.
   * @param {Uint8Array} callData - The data to be written to the file.
   * @param {Client} client - The Hedera client to use for the transaction.
   * @param {string} requestId - The request ID associated with the transaction.
   * @param {string} callerName - The name of the caller creating the file.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @returns {Promise<FileId | null>} A promise that resolves to the created file ID or null if the creation failed.
   * @throws Will throw an error if the created file is empty or if any transaction fails during execution.
   */
  async createFile(
    callData: Uint8Array,
    client: Client,
    requestId: string,
    callerName: string,
    interactingEntity: string,
    originalCallerAddress: string,
  ): Promise<FileId | null> {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const hexedCallData = Buffer.from(callData).toString('hex');

    const fileCreateTx = new FileCreateTransaction()
      .setContents(hexedCallData.substring(0, this.fileAppendChunkSize))
      .setKeys(client.operatorPublicKey ? [client.operatorPublicKey] : []);

    const fileCreateTxResponse = await this.executeTransaction(
      fileCreateTx,
      callerName,
      interactingEntity,
      formattedRequestId,
      true,
      originalCallerAddress,
    );

    const { fileId } = await fileCreateTxResponse.getReceipt(client);

    if (fileId && callData.length > this.fileAppendChunkSize) {
      const fileAppendTx = new FileAppendTransaction()
        .setFileId(fileId)
        .setContents(hexedCallData.substring(this.fileAppendChunkSize, hexedCallData.length))
        .setChunkSize(this.fileAppendChunkSize)
        .setMaxChunks(this.maxChunks);

      await this.executeAllTransaction(
        fileAppendTx,
        callerName,
        interactingEntity,
        formattedRequestId,
        true,
        originalCallerAddress,
      );
    }

    if (fileId) {
      const fileInfo = await this.executeQuery(
        new FileInfoQuery().setFileId(fileId),
        this.clientMain,
        callerName,
        interactingEntity,
        requestId,
      );

      if (fileInfo.size.isZero()) {
        this.logger.warn(`${requestId} File ${fileId} is empty.`);
        throw new SDKClientError({}, `${requestId} Created file is empty. `);
      }
      this.logger.trace(`${formattedRequestId} Created file with fileId: ${fileId} and file size ${fileInfo.size}`);
    }

    return fileId;
  }

  /**
   * Deletes a file on the Hedera network and verifies its deletion.
   *
   * @param {FileId} fileId - The ID of the file to be deleted.
   * @param {string} requestId - A unique identifier for the request.
   * @param {string} callerName - The name of the entity initiating the request.
   * @param {string} interactingEntity - The name of the interacting entity.
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {any} - Throws an error if the file deletion fails.
   */
  async deleteFile(
    fileId: FileId,
    requestId: string,
    callerName: string,
    interactingEntity: string,
    originalCallerAddress: string,
  ): Promise<void> {
    const requestIdPrefix = formatRequestIdMessage(requestId);

    try {
      const fileDeleteTx = new FileDeleteTransaction()
        .setFileId(fileId)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.clientMain);

      await this.executeTransaction(
        fileDeleteTx,
        callerName,
        interactingEntity,
        requestId,
        false,
        originalCallerAddress,
      );

      const fileInfo = await this.executeQuery(
        new FileInfoQuery().setFileId(fileId),
        this.clientMain,
        callerName,
        interactingEntity,
        requestId,
      );

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
  private convertGasPriceToTinyBars = (
    feeComponents: FeeComponents | undefined,
    exchangeRates: ExchangeRates,
  ): number => {
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
   * Retrieves transaction record metrics for a given transaction ID.
   *
   * @param {string} transactionId - The ID of the transaction to retrieve metrics for.
   * @param {string} callerName - The name of the caller requesting the transaction record.
   * @param {string} requestId - The request ID for tracking the request.
   * @param {string} txConstructorName - The name of the transaction constructor.
   * @param {string} operatorAccountId - The account ID of the operator.
   * @returns {Promise<ITransactionMetric>} - A promise that resolves to an object containing transaction metrics.
   * @throws {SDKClientError} - Throws an error if an issue occurs during the transaction record query.
   */
  public async getTransactionRecordMetrics(
    transactionId: string,
    callerName: string,
    requestId: string,
    txConstructorName: string,
    operatorAccountId: string,
  ): Promise<ITransactionRecordMetric> {
    let gasUsed: number = 0;
    let transactionFee: number = 0;
    let txRecordChargeAmount: number = 0;
    const formattedRequestId = formatRequestIdMessage(requestId);
    try {
      this.logger.trace(
        `${formattedRequestId} Get transaction record via consensus node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
      );

      const transactionRecord = await new TransactionRecordQuery()
        .setTransactionId(transactionId)
        .setValidateReceiptStatus(false)
        .execute(this.clientMain);

      const transactionReceipt = transactionRecord.receipt;
      const status = transactionReceipt.status.toString();

      txRecordChargeAmount = this.calculateTxRecordChargeAmount(transactionReceipt.exchangeRate!);

      transactionFee = this.getTransferAmountSumForAccount(transactionRecord, operatorAccountId);
      gasUsed = transactionRecord.contractFunctionResult?.gasUsed.toNumber() ?? 0;

      return { transactionFee, txRecordChargeAmount, gasUsed, status };
    } catch (e: any) {
      const sdkClientError = new SDKClientError(e, e.message);
      this.logger.warn(
        e,
        `${formattedRequestId} Error raised during TransactionRecordQuery: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}, recordStatus=${sdkClientError.status} (${sdkClientError.status._code}), cost=${transactionFee}, gasUsed=${gasUsed}`,
      );
      throw sdkClientError;
    }
  }

  /**
   * Calculates the total sum of transfer amounts for a specific account from a transaction record.
   * This method filters the transfers in the transaction record to match the specified account ID,
   * then sums up the amounts by subtracting each transfer's amount (converted to tinybars) from the accumulator.
   *
   * @param {TransactionRecord} transactionRecord - The transaction record containing transfer details.
   * @param {string} accountId - The ID of the account for which the transfer sum is to be calculated.
   * @returns {number} The total sum of transfer amounts for the specified account, in tinybars.
   */
  public getTransferAmountSumForAccount(transactionRecord: TransactionRecord, accountId: string): number {
    return transactionRecord.transfers
      .filter((transfer) => transfer.accountId.toString() === accountId)
      .reduce((acc, transfer) => {
        return acc - transfer.amount.toTinybars().toNumber();
      }, 0);
  }

  /**
   * Calculates the transaction record query cost in tinybars based on the given exchange rate in cents.
   *
   * @param {number} exchangeRate - The exchange rate in cents used to convert the transaction query cost.
   * @returns {number} - The transaction record query cost in tinybars.
   */
  public calculateTxRecordChargeAmount(exchangeRate: ExchangeRate): number {
    const exchangeRateInCents = exchangeRate.exchangeRateInCents;
    const hbarToTinybar = Hbar.from(1, HbarUnit.Hbar).toTinybars().toNumber();
    return Math.round((constants.NETWORK_FEES_IN_CENTS.TRANSACTION_GET_RECORD / exchangeRateInCents) * hbarToTinybar);
  }

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
}
