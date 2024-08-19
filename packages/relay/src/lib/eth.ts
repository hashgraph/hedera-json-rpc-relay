/* -
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

import { Eth } from '../index';
import { FileId, Hbar, PrecheckStatusError } from '@hashgraph/sdk';
import { Logger } from 'pino';
import { Block, Log, Transaction, Transaction1559 } from './model';
import { MirrorNodeClient } from './clients';
import { JsonRpcError, predefined } from './errors/JsonRpcError';
import { SDKClientError } from './errors/SDKClientError';
import { MirrorNodeClientError } from './errors/MirrorNodeClientError';
import { Utils } from './../utils';
import { LogsBloomUtils } from './../logsBloomUtils';
import constants from './constants';
import { Precheck } from './precheck';
import {
  ASCIIToHex,
  formatContractResult,
  formatTransactionIdWithoutQueryParams,
  isHex,
  isValidEthereumAddress,
  nanOrNumberTo0x,
  nullableNumberTo0x,
  numberTo0x,
  parseNumericEnvVar,
  prepend0x,
  toHash32,
  trimPrecedingZeros,
  weibarHexToTinyBarInt,
} from '../formatters';
import crypto from 'crypto';
import HAPIService from './services/hapiService/hapiService';
import { Counter, Registry } from 'prom-client';
import { Transaction as EthersTransaction } from 'ethers';
import { CommonService, FilterService } from './services/ethService';
import { IFilterService } from './services/ethService/ethFilterService/IFilterService';
import { CacheService } from './services/cacheService/cacheService';
import { IDebugService } from './services/debugService/IDebugService';
import { DebugService } from './services/debugService';
import { IFeeHistory } from './types/IFeeHistory';
import { ITransactionReceipt } from './types/ITransactionReceipt';
import TransactionService from './services/transactionService/transactionService';
import { IContractCallRequest, IContractCallResponse } from './types/IMirrorNode';

const _ = require('lodash');
const createHash = require('keccak');
const asm = require('@ethersproject/asm');

interface LatestBlockNumberTimestamp {
  blockNumber: string | null;
  timeStampTo: string;
}

/**
 * Implementation of the "eth_" methods from the Ethereum JSON-RPC API.
 * Methods are implemented by delegating to the mirror node or to a
 * consensus node in the main network.
 *
 * FIXME: This class is a work in progress because everything we need is
 * not currently supported by the mirror nodes. As such, we have a lot
 * of fake stuff in this class for now for the purpose of demos and POC.
 */
export class EthImpl implements Eth {
  static emptyHex = '0x';
  static zeroHex = '0x0';
  static oneHex = '0x1';
  static twoHex = '0x2';
  static oneTwoThreeFourHex = '0x1234';
  static zeroHex8Byte = '0x0000000000000000';
  static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
  static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  static zeroAddressHex = '0x0000000000000000000000000000000000000000';
  static emptyBloom =
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  static defaultTxGas = numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT);
  static gasTxBaseCost = numberTo0x(constants.TX_BASE_COST);
  static gasTxHollowAccountCreation = numberTo0x(constants.TX_HOLLOW_ACCOUNT_CREATION_GAS);
  static ethTxType = 'EthereumTransaction';
  static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  static defaultGasUsedRatio = 0.5;
  static feeHistoryZeroBlockCountResponse: IFeeHistory = {
    gasUsedRatio: null,
    oldestBlock: EthImpl.zeroHex,
    baseFeePerGas: undefined,
  };
  static readonly feeHistoryEmptyResponse: IFeeHistory = {
    baseFeePerGas: [],
    gasUsedRatio: [],
    reward: [],
    oldestBlock: EthImpl.zeroHex,
  };
  static redirectBytecodePrefix = '6080604052348015600f57600080fd5b506000610167905077618dc65e';
  static redirectBytecodePostfix =
    '600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033';
  static iHTSAddress = '0x0000000000000000000000000000000000000167';
  static invalidEVMInstruction = '0xfe';
  static blockHashLength = 66;

  // endpoint callerNames
  static ethBlockByNumber = 'eth_blockNumber';
  static ethCall = 'eth_call';
  static ethEstimateGas = 'eth_estimateGas';
  static ethFeeHistory = 'eth_feeHistory';
  static ethGasPrice = 'eth_gasPrice';
  static ethGetBalance = 'eth_getBalance';
  static ethGetBlockByHash = 'eth_GetBlockByHash';
  static ethGetBlockByNumber = 'eth_GetBlockByNumber';
  static ethGetCode = 'eth_getCode';
  static ethGetTransactionByHash = 'eth_GetTransactionByHash';
  static ethGetTransactionCount = 'eth_getTransactionCount';
  static ethGetTransactionCountByHash = 'eth_GetTransactionCountByHash';
  static ethGetTransactionCountByNumber = 'eth_GetTransactionCountByNumber';
  static ethGetTransactionReceipt = 'eth_GetTransactionReceipt';
  static ethSendRawTransaction = 'eth_sendRawTransaction';
  static debugTraceTransaction = 'debug_traceTransaction';

  // block constants
  static blockLatest = 'latest';
  static blockEarliest = 'earliest';
  static blockPending = 'pending';
  static blockSafe = 'safe';
  static blockFinalized = 'finalized';

  // static response constants
  static accounts = [];

  /**
   * Overrideable options used when initializing.
   *
   * @private
   */
  private readonly defaultGas = numberTo0x(parseNumericEnvVar('TX_DEFAULT_GAS', 'TX_DEFAULT_GAS_DEFAULT'));
  private readonly contractCallAverageGas = numberTo0x(constants.TX_CONTRACT_CALL_AVERAGE_GAS);
  private readonly ethCallCacheTtl = parseNumericEnvVar('ETH_CALL_CACHE_TTL', 'ETH_CALL_CACHE_TTL_DEFAULT');
  private readonly ethBlockNumberCacheTtlMs = parseNumericEnvVar(
    'ETH_BLOCK_NUMBER_CACHE_TTL_MS',
    'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT',
  );
  private readonly ethGetBalanceCacheTtlMs = parseNumericEnvVar(
    'ETH_GET_BALANCE_CACHE_TTL_MS',
    'ETH_GET_BALANCE_CACHE_TTL_MS_DEFAULT',
  );
  private readonly maxBlockRange = parseNumericEnvVar('MAX_BLOCK_RANGE', 'MAX_BLOCK_RANGE');
  private readonly contractCallGasLimit = parseNumericEnvVar('CONTRACT_CALL_GAS_LIMIT', 'CONTRACT_CALL_GAS_LIMIT');
  private readonly ethGetTransactionCountMaxBlockRange = parseNumericEnvVar(
    'ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE',
    'ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE',
  );
  private readonly ethGetTransactionCountCacheTtl = parseNumericEnvVar(
    'ETH_GET_TRANSACTION_COUNT_CACHE_TTL',
    'ETH_GET_TRANSACTION_COUNT_CACHE_TTL',
  );
  private readonly MirrorNodeGetContractResultRetries = parseNumericEnvVar(
    'MIRROR_NODE_GET_CONTRACT_RESULTS_RETRIES',
    'MIRROR_NODE_GET_CONTRACT_RESULTS_DEFAULT_RETRIES',
  );
  private readonly estimateGasThrows = process.env.ESTIMATE_GAS_THROWS
    ? process.env.ESTIMATE_GAS_THROWS === 'true'
    : true;

  private readonly ethGasPRiceCacheTtlMs = parseNumericEnvVar(
    'ETH_GET_GAS_PRICE_CACHE_TTL_MS',
    'ETH_GET_GAS_PRICE_CACHE_TTL_MS_DEFAULT',
  );

  /**
   * Configurable options used when initializing the cache.
   *
   * @private
   */
  private readonly options = {
    //The maximum number (or size) of items that remain in the cache (assuming no TTL pruning or explicit deletions).
    max: constants.CACHE_MAX,
    // Max time to live in ms, for items before they are considered stale.
    ttl: constants.CACHE_TTL.ONE_HOUR,
  };

  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly cacheService: CacheService;

  /**
   * The client service which is responsible for client all logic related to initialization, reinitialization and error/transactions tracking.
   *
   * @private
   */
  private readonly hapiService: HAPIService;

  /**
   * The interface through which we interact with the mirror node
   * @private
   */
  private readonly mirrorNodeClient: MirrorNodeClient;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * The precheck class used for checking the fields like nonce before the tx execution.
   * @private
   */
  private readonly precheck: Precheck;

  /**
   * The ID of the chain, as a hex string, as it would be returned in a JSON-RPC call.
   * @private
   */
  private readonly chain: string;

  /**
   * The ethExecutionsCounter used to track the number of active contract execution requests.
   * @private
   */
  private readonly ethExecutionsCounter: Counter;

  /**
   * The Common Service implemntation that contains logic shared by other services.
   */
  private readonly common: CommonService;

  /**
   * The Filter Service implemntation that takes care of all filter API operations.
   */
  private readonly filterServiceImpl: FilterService;

  /**
   * The Debug Service implemntation that takes care of all filter API operations.
   */
  private readonly debugServiceImpl: DebugService;

  /**
   * Service for handling transactions.
   * @type {TransactionService}
   * @private
   * @readonly
   */
  private readonly transactionService: TransactionService;

  private previousAccountNonce: number = 0;
  private previousAccount: string = '';

  /**
   * Create a new Eth implementation.
   * @param hapiService
   * @param mirrorNodeClient
   * @param logger
   * @param chain
   * @param registry
   * @param cacheService
   */
  constructor(
    hapiService: HAPIService,
    mirrorNodeClient: MirrorNodeClient,
    logger: Logger,
    chain: string,
    registry: Registry,
    cacheService: CacheService,
  ) {
    this.hapiService = hapiService;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chain;
    this.precheck = new Precheck(mirrorNodeClient, logger, chain);
    this.cacheService = cacheService;

    this.ethExecutionsCounter = this.initEthExecutionCounter(registry);

    this.common = new CommonService(mirrorNodeClient, logger, cacheService);
    this.filterServiceImpl = new FilterService(mirrorNodeClient, logger, cacheService, this.common);
    this.debugServiceImpl = new DebugService(mirrorNodeClient, logger, this.common);

    this.transactionService = new TransactionService(logger, this.hapiService.getSDKClient(), mirrorNodeClient);
  }

  private shouldUseCacheForBalance(tag: string | null): boolean {
    // should only cache balance when is Not latest or pending and is not in dev mode
    return !CommonService.blockTagIsLatestOrPendingStrict(tag) && !CommonService.isDevMode;
  }

  private initEthExecutionCounter(register: Registry): Counter {
    const metricCounterName = 'rpc_relay_eth_executions';
    register.removeSingleMetric(metricCounterName);
    return new Counter({
      name: metricCounterName,
      help: `Relay ${metricCounterName} function`,
      labelNames: ['method', 'function'],
      registers: [register],
    });
  }

  filterService(): IFilterService {
    return this.filterServiceImpl;
  }

  debugService(): IDebugService {
    return this.debugServiceImpl;
  }

  /**
   * This method is implemented to always return an empty array. This is in alignment
   * with the behavior of Infura.
   */
  accounts(requestIdPrefix?: string): never[] {
    this.logger.trace(`${requestIdPrefix} accounts()`);
    return EthImpl.accounts;
  }

  private getEthFeeHistoryFixedFee(): boolean {
    if (process.env.ETH_FEE_HISTORY_FIXED === undefined) {
      return true;
    }
    return process.env.ETH_FEE_HISTORY_FIXED === 'true';
  }

  /**
   * Gets the fee history.
   */
  async feeHistory(
    blockCount: number,
    newestBlock: string,
    rewardPercentiles: Array<number> | null,
    requestIdPrefix?: string,
  ): Promise<IFeeHistory | JsonRpcError> {
    const maxResults =
      process.env.TEST === 'true'
        ? constants.DEFAULT_FEE_HISTORY_MAX_RESULTS
        : Number(process.env.FEE_HISTORY_MAX_RESULTS);

    this.logger.trace(
      `${requestIdPrefix} feeHistory(blockCount=${blockCount}, newestBlock=${newestBlock}, rewardPercentiles=${rewardPercentiles})`,
    );

    try {
      const latestBlockNumber = await this.translateBlockTag(EthImpl.blockLatest, requestIdPrefix);
      const newestBlockNumber =
        newestBlock == EthImpl.blockLatest || newestBlock == EthImpl.blockPending
          ? latestBlockNumber
          : await this.translateBlockTag(newestBlock, requestIdPrefix);

      if (newestBlockNumber > latestBlockNumber) {
        return predefined.REQUEST_BEYOND_HEAD_BLOCK(newestBlockNumber, latestBlockNumber);
      }
      blockCount = blockCount > maxResults ? maxResults : blockCount;

      if (blockCount <= 0) {
        return EthImpl.feeHistoryZeroBlockCountResponse;
      }
      let feeHistory: IFeeHistory;

      if (this.getEthFeeHistoryFixedFee()) {
        let oldestBlock = newestBlockNumber - blockCount + 1;
        if (oldestBlock <= 0) {
          blockCount = 1;
          oldestBlock = 1;
        }
        const gasPriceFee = await this.gasPrice(requestIdPrefix);
        feeHistory = this.getRepeatedFeeHistory(blockCount, oldestBlock, rewardPercentiles, gasPriceFee);
      } else {
        // once we finish testing and refining Fixed Fee method, we can remove this else block to clean up code
        const cacheKey = `${constants.CACHE_KEY.FEE_HISTORY}_${blockCount}_${newestBlock}_${rewardPercentiles?.join(
          '',
        )}`;
        const cachedFeeHistory = await this.cacheService.getAsync(cacheKey, EthImpl.ethFeeHistory, requestIdPrefix);

        if (cachedFeeHistory) {
          feeHistory = cachedFeeHistory;
        } else {
          feeHistory = await this.getFeeHistory(
            blockCount,
            newestBlockNumber,
            latestBlockNumber,
            rewardPercentiles,
            requestIdPrefix,
          );
        }
        if (newestBlock != EthImpl.blockLatest && newestBlock != EthImpl.blockPending) {
          await this.cacheService.set(cacheKey, feeHistory, EthImpl.ethFeeHistory, undefined, requestIdPrefix);
        }
      }

      return feeHistory;
    } catch (e) {
      this.logger.error(e, `${requestIdPrefix} Error constructing default feeHistory`);
      return EthImpl.feeHistoryEmptyResponse;
    }
  }

  private async getFeeByBlockNumber(blockNumber: number, requestIdPrefix?: string): Promise<string> {
    let fee = 0;
    try {
      const block = await this.mirrorNodeClient.getBlock(blockNumber, requestIdPrefix);
      fee = await this.getFeeWeibars(EthImpl.ethFeeHistory, requestIdPrefix, `lte:${block.timestamp.to}`);
    } catch (error) {
      this.logger.warn(
        error,
        `${requestIdPrefix} Fee history cannot retrieve block or fee. Returning ${fee} fee for block ${blockNumber}`,
      );
    }

    return numberTo0x(fee);
  }

  private getRepeatedFeeHistory(
    blockCount: number,
    oldestBlockNumber: number,
    rewardPercentiles: Array<number> | null,
    fee: string,
  ): IFeeHistory {
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;

    const feeHistory: IFeeHistory = {
      baseFeePerGas: Array(blockCount).fill(fee),
      gasUsedRatio: Array(blockCount).fill(EthImpl.defaultGasUsedRatio),
      oldestBlock: numberTo0x(oldestBlockNumber),
    };

    // next fee. Due to high block production rate and low fee change rate we add the next fee
    // since by the time a user utilizes the response there will be a next block likely with the same fee
    feeHistory.baseFeePerGas?.push(fee);

    if (shouldIncludeRewards) {
      feeHistory['reward'] = Array(blockCount).fill(Array(rewardPercentiles.length).fill(EthImpl.zeroHex));
    }

    return feeHistory;
  }

  private async getFeeHistory(
    blockCount: number,
    newestBlockNumber: number,
    latestBlockNumber: number,
    rewardPercentiles: Array<number> | null,
    requestIdPrefix?: string,
  ): Promise<IFeeHistory> {
    // include newest block number in the total block count
    const oldestBlockNumber = Math.max(0, newestBlockNumber - blockCount + 1);
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;
    const feeHistory: IFeeHistory = {
      baseFeePerGas: [] as string[],
      gasUsedRatio: [] as number[],
      oldestBlock: numberTo0x(oldestBlockNumber),
    };

    // get fees from oldest to newest blocks
    for (let blockNumber = oldestBlockNumber; blockNumber <= newestBlockNumber; blockNumber++) {
      const fee = await this.getFeeByBlockNumber(blockNumber, requestIdPrefix);

      feeHistory.baseFeePerGas?.push(fee);
      feeHistory.gasUsedRatio?.push(EthImpl.defaultGasUsedRatio);
    }

    // get latest block fee
    let nextBaseFeePerGas = _.last(feeHistory.baseFeePerGas);

    if (latestBlockNumber > newestBlockNumber) {
      // get next block fee if the newest block is not the latest
      nextBaseFeePerGas = await this.getFeeByBlockNumber(newestBlockNumber + 1, requestIdPrefix);
    }

    if (nextBaseFeePerGas) {
      feeHistory.baseFeePerGas?.push(nextBaseFeePerGas);
    }

    if (shouldIncludeRewards) {
      feeHistory['reward'] = Array(blockCount).fill(Array(rewardPercentiles.length).fill(EthImpl.zeroHex));
    }

    return feeHistory;
  }

  private async getFeeWeibars(callerName: string, requestIdPrefix?: string, timestamp?: string): Promise<number> {
    let networkFees;
    try {
      networkFees = await this.mirrorNodeClient.getNetworkFees(timestamp, undefined, requestIdPrefix);
      if (_.isNil(networkFees)) {
        this.logger.debug(`${requestIdPrefix} Mirror Node returned no fees. Fallback to network`);
      }
    } catch (e: any) {
      this.logger.warn(e, `${requestIdPrefix} Mirror Node threw an error retrieving fees. Fallback to network`);
    }

    if (_.isNil(networkFees)) {
      networkFees = {
        fees: [
          {
            gas: await this.hapiService.getSDKClient().getTinyBarGasFee(callerName, requestIdPrefix),
            transaction_type: EthImpl.ethTxType,
          },
        ],
      };
    }

    if (networkFees && Array.isArray(networkFees.fees)) {
      const txFee = networkFees.fees.find(({ transaction_type }) => transaction_type === EthImpl.ethTxType);
      if (txFee?.gas) {
        // convert tinyBars into weiBars
        const weibars = Hbar.fromTinybars(txFee.gas).toTinybars().multiply(constants.TINYBAR_TO_WEIBAR_COEF);

        return weibars.toNumber();
      }
    }

    throw predefined.COULD_NOT_ESTIMATE_GAS_PRICE;
  }

  /**
   * Gets the most recent block number.
   */
  async blockNumber(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} blockNumber()`);
    return await this.common.getLatestBlockNumber(requestIdPrefix);
  }

  /**
   * Gets the most recent block number and timestamp.to which represents the block finality.
   */
  async blockNumberTimestamp(caller: string, requestIdPrefix?: string): Promise<LatestBlockNumberTimestamp> {
    this.logger.trace(`${requestIdPrefix} blockNumber()`);

    const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestIdPrefix);
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const currentBlock = numberTo0x(blocks[0].number);
      const timestamp = blocks[0].timestamp.to;
      const blockTimeStamp: LatestBlockNumberTimestamp = { blockNumber: currentBlock, timeStampTo: timestamp };
      // save the latest block number in cache
      await this.cacheService.set(cacheKey, currentBlock, caller, this.ethBlockNumberCacheTtlMs, requestIdPrefix);

      return blockTimeStamp;
    }

    throw predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
  }

  /**
   * Gets the chain ID. This is a static value, in that it always returns
   * the same value. This can be specified via an environment variable
   * `CHAIN_ID`.
   */
  chainId(requestIdPrefix?: string): string {
    this.logger.trace(`${requestIdPrefix} chainId()`);
    return this.chain;
  }

  /**
   * Estimates the amount of gas to execute a call.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async estimateGas(
    transaction: IContractCallRequest,
    _blockParam: string | null,
    requestIdPrefix?: string,
  ): Promise<string | JsonRpcError> {
    const callData = transaction.data ? transaction.data : transaction.input;
    const callDataSize = callData ? callData.length : 0;

    if (callDataSize >= constants.FUNCTION_SELECTOR_CHAR_LENGTH) {
      this.ethExecutionsCounter
        .labels(EthImpl.ethEstimateGas, callData!.substring(0, constants.FUNCTION_SELECTOR_CHAR_LENGTH))
        .inc();
    }

    this.logger.trace(
      `${requestIdPrefix} estimateGas(transaction=${JSON.stringify(transaction)}, _blockParam=${_blockParam})`,
    );

    try {
      const response = await this.estimateGasFromMirrorNode(transaction, requestIdPrefix);
      if (response?.result) {
        this.logger.info(`${requestIdPrefix} Returning gas: ${response.result}`);
        return prepend0x(trimPrecedingZeros(response.result));
      } else {
        return this.predefinedGasForTransaction(transaction, requestIdPrefix);
      }
    } catch (e: any) {
      this.logger.error(
        `${requestIdPrefix} Error raised while fetching estimateGas from mirror-node: ${JSON.stringify(e)}`,
      );
      return this.predefinedGasForTransaction(transaction, requestIdPrefix, e);
    }
  }

  /**
   * Executes an estimate contract call gas request in the mirror node.
   *
   * @param {IContractCallRequest} transaction The transaction data for the contract call.
   * @param requestIdPrefix The prefix for the request ID.
   * @returns {Promise<IContractCallResponse>} the response from the mirror node
   */
  private async estimateGasFromMirrorNode(
    transaction: IContractCallRequest,
    requestIdPrefix?: string,
  ): Promise<IContractCallResponse | null> {
    this.contractCallFormat(transaction);
    const callData = { ...transaction, estimate: true };
    return this.mirrorNodeClient.postContractCall(callData, requestIdPrefix);
  }

  /**
   * Fallback calculations for the amount of gas to be used for a transaction.
   * This method is used when the mirror node fails to return a gas estimate.
   *
   * @param {IContractCallRequest} transaction The transaction data for the contract call.
   * @param {string} requestIdPrefix The prefix for the request ID.
   * @param error (Optional) received error from the mirror-node contract call request.
   * @returns {Promise<string | JsonRpcError>} the calculated gas cost for the transaction
   */
  private async predefinedGasForTransaction(
    transaction: IContractCallRequest,
    requestIdPrefix?: string,
    error?: any,
  ): Promise<string | JsonRpcError> {
    const isSimpleTransfer = !!transaction?.to && (!transaction.data || transaction.data === '0x');
    const isContractCall =
      !!transaction?.to && transaction?.data && transaction.data.length >= constants.FUNCTION_SELECTOR_CHAR_LENGTH;
    const isContractCreate = !transaction?.to && transaction?.data && transaction.data !== '0x';

    if (isSimpleTransfer) {
      // Handle Simple Transaction and Hollow Account creation
      const isNonZeroValue = Number(transaction.value) > 0;
      if (!isNonZeroValue) {
        return predefined.INVALID_PARAMETER(
          0,
          `Invalid 'value' field in transaction param. Value must be greater than 0`,
        );
      }
      // when account exists return default base gas
      if (await this.getAccount(transaction.to!, requestIdPrefix)) {
        this.logger.warn(`${requestIdPrefix} Returning predefined gas for simple transfer: ${EthImpl.gasTxBaseCost}`);
        return EthImpl.gasTxBaseCost;
      }
      // otherwise, return the minimum amount of gas for hollow account creation
      this.logger.warn(
        `${requestIdPrefix} Returning predefined gas for hollow account creation: ${EthImpl.gasTxHollowAccountCreation}`,
      );
      return EthImpl.gasTxHollowAccountCreation;
    } else if (isContractCreate) {
      // The size limit of the encoded contract posted to the mirror node can
      // cause contract deployment transactions to fail with a 400 response code.
      // The contract is actually deployed on the consensus node, so the contract will work.
      // In these cases, we don't want to return a CONTRACT_REVERT error.
      if (
        this.estimateGasThrows &&
        error?.isContractReverted() &&
        error?.message !== MirrorNodeClientError.messages.INVALID_HEX
      ) {
        return predefined.CONTRACT_REVERT(error.detail, error.data);
      }
      this.logger.warn(`${requestIdPrefix} Returning predefined gas for contract creation: ${EthImpl.gasTxBaseCost}`);
      return numberTo0x(Precheck.transactionIntrinsicGasCost(transaction.data!));
    } else if (isContractCall) {
      this.logger.warn(`${requestIdPrefix} Returning predefined gas for contract call: ${this.contractCallAverageGas}`);
      return this.contractCallAverageGas;
    } else {
      this.logger.warn(`${requestIdPrefix} Returning predefined gas for unknown transaction: ${this.defaultGas}`);
      return this.defaultGas;
    }
  }

  /**
   * Tries to get the account with the given address from the cache,
   * if not found, it fetches it from the mirror node.
   *
   * @param {string} address the address of the account
   * @param {string} requestIdPrefix the prefix for the request ID
   * @returns the account (if such exists for the given address)
   */
  private async getAccount(address: string, requestIdPrefix?: string) {
    const key = `${constants.CACHE_KEY.ACCOUNT}_${address}`;
    let account = await this.cacheService.getAsync(key, EthImpl.ethEstimateGas, requestIdPrefix);
    if (!account) {
      account = await this.mirrorNodeClient.getAccount(address, requestIdPrefix);
      await this.cacheService.set(key, account, EthImpl.ethEstimateGas, undefined, requestIdPrefix);
    }
    return account;
  }

  /**
   * Perform value format precheck before making contract call towards the mirror node
   * @param transaction
   */
  contractCallFormat(transaction: IContractCallRequest): void {
    if (transaction.value) {
      transaction.value = weibarHexToTinyBarInt(transaction.value);
    }
    if (transaction.gasPrice) {
      transaction.gasPrice = parseInt(transaction.gasPrice.toString());
    }
    if (transaction.gas) {
      transaction.gas = parseInt(transaction.gas.toString());
    }

    // Support either data or input. https://ethereum.github.io/execution-apis/api-documentation/ lists input but many EVM tools still use data.
    // We chose in the mirror node to use data field as the correct one, however for us to be able to support all tools,
    // we have to modify transaction object, so that it complies with the mirror node.
    // That means that, if input field is passed, but data is not, we have to copy value of input to the data to comply with mirror node.
    // The second scenario occurs when both the data and input fields are present but hold different values.
    // In this case, the value in the input field should be the one used for consensus based on this resource https://github.com/ethereum/execution-apis/blob/main/tests/eth_call/call-contract.io
    // Eventually, for optimization purposes, we can rid of the input property or replace it with empty string.
    if ((transaction.input && transaction.data === undefined) || (transaction.input && transaction.data)) {
      transaction.data = transaction.input;
      delete transaction.input;
    }
  }

  /**
   * Gets the current gas price of the network.
   */
  async gasPrice(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} gasPrice()`);
    try {
      let gasPrice: number | undefined = await this.cacheService.getAsync(
        constants.CACHE_KEY.GAS_PRICE,
        EthImpl.ethGasPrice,
        requestIdPrefix,
      );

      if (!gasPrice) {
        gasPrice = Utils.addPercentageBufferToGasPrice(await this.getFeeWeibars(EthImpl.ethGasPrice, requestIdPrefix));

        await this.cacheService.set(
          constants.CACHE_KEY.GAS_PRICE,
          gasPrice,
          EthImpl.ethGasPrice,
          this.ethGasPRiceCacheTtlMs,
          requestIdPrefix,
        );
      }

      return numberTo0x(gasPrice);
    } catch (error) {
      throw this.common.genericErrorHandler(error, `${requestIdPrefix} Failed to retrieve gasPrice`);
    }
  }

  /**
   * Gets whether this "Ethereum client" is a miner. We don't mine, so this always returns false.
   */
  async mining(requestIdPrefix?: string): Promise<boolean> {
    this.logger.trace(`${requestIdPrefix} mining()`);
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async submitWork(requestIdPrefix?: string): Promise<boolean> {
    this.logger.trace(`${requestIdPrefix} submitWork()`);
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async syncing(requestIdPrefix?: string): Promise<boolean> {
    this.logger.trace(`${requestIdPrefix} syncing()`);
    return false;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockHashAndIndex(requestIdPrefix?: string): Promise<null> {
    this.logger.trace(`${requestIdPrefix} getUncleByBlockHashAndIndex()`);
    return null;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockNumberAndIndex(requestIdPrefix?: string): Promise<null> {
    this.logger.trace(`${requestIdPrefix} getUncleByBlockNumberAndIndex()`);
    return null;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockHash(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} getUncleCountByBlockHash()`);
    return EthImpl.zeroHex;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockNumber(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} getUncleCountByBlockNumber()`);
    return EthImpl.zeroHex;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async hashrate(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} hashrate()`);
    return EthImpl.zeroHex;
  }

  /**
   * Always returns UNSUPPORTED_METHOD error.
   */
  getWork(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} getWork()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Unsupported methods always return UNSUPPORTED_METHOD error.
   */
  submitHashrate(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} submitHashrate()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  signTransaction(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} signTransaction()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  sign(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} sign()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  sendTransaction(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} sendTransaction()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  protocolVersion(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} protocolVersion()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  coinbase(requestIdPrefix?: string): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} coinbase()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Gets the value from a storage position at the given Ethereum address.
   *
   * @param address
   * @param slot
   * @param blockNumberOrTagOrHash
   * @param requestIdPrefix
   */
  async getStorageAt(
    address: string,
    slot: string,
    blockNumberOrTagOrHash?: string | null,
    requestIdPrefix?: string,
  ): Promise<string> {
    this.logger.trace(
      `${requestIdPrefix} getStorageAt(address=${address}, slot=${slot}, blockNumberOrOrHashTag=${blockNumberOrTagOrHash})`,
    );

    let result = EthImpl.zeroHex32Byte; // if contract or slot not found then return 32 byte 0

    const blockResponse = await this.common.getHistoricalBlockResponse(blockNumberOrTagOrHash, false, requestIdPrefix);
    // To save a request to the mirror node for `latest` and `pending` blocks, we directly return null from `getHistoricalBlockResponse`
    // But if a block number or `earliest` tag is passed and the mirror node returns `null`, we should throw an error.
    if (!this.common.blockTagIsLatestOrPending(blockNumberOrTagOrHash) && blockResponse == null) {
      throw predefined.RESOURCE_NOT_FOUND(`block '${blockNumberOrTagOrHash}'.`);
    }

    const blockEndTimestamp = blockResponse?.timestamp?.to;

    await this.mirrorNodeClient
      .getContractStateByAddressAndSlot(address, slot, blockEndTimestamp, requestIdPrefix)
      .then((response) => {
        if (response !== null && response.state.length > 0) {
          result = response.state[0].value;
        }
      })
      .catch((error: any) => {
        throw this.common.genericErrorHandler(
          error,
          `${requestIdPrefix} Failed to retrieve current contract state for address ${address} at slot=${slot}`,
        );
      });

    return result;
  }

  /**
   * Checks and return correct format from input.
   * @param input
   * @returns
   */
  private static toHex32Byte(input: string): string {
    return input.length === 66 ? input : EthImpl.emptyHex + this.prune0x(input).padStart(64, '0');
  }

  /**
   * Gets the balance of an account as of the given block from the mirror node.
   * Current implementation does not yet utilize blockNumber
   *
   * @param account
   * @param blockNumberOrTagOrHash
   * @param requestIdPrefix
   */
  async getBalance(account: string, blockNumberOrTagOrHash: string | null, requestIdPrefix?: string): Promise<string> {
    const latestBlockTolerance = 1;
    this.logger.trace(`${requestIdPrefix} getBalance(account=${account}, blockNumberOrTag=${blockNumberOrTagOrHash})`);

    let latestBlock: LatestBlockNumberTimestamp | null | undefined;
    // this check is required, because some tools like Metamask pass for parameter latest block, with a number (ex 0x30ea)
    // tolerance is needed, because there is a small delay between requesting latest block from blockNumber and passing it here
    if (!this.common.blockTagIsLatestOrPending(blockNumberOrTagOrHash)) {
      let blockHashNumber, isHash;
      const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;
      const blockNumberCached = await this.cacheService.getAsync(cacheKey, EthImpl.ethGetBalance, requestIdPrefix);

      if (blockNumberCached) {
        this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(blockNumberCached)}`);
        latestBlock = { blockNumber: blockNumberCached, timeStampTo: '0' };
      } else {
        latestBlock = await this.blockNumberTimestamp(EthImpl.ethGetBalance, requestIdPrefix);
      }

      if (blockNumberOrTagOrHash != null && blockNumberOrTagOrHash.length > 32) {
        isHash = true;
        blockHashNumber = await this.mirrorNodeClient.getBlock(blockNumberOrTagOrHash);
      }

      const currentBlockNumber = isHash ? Number(blockHashNumber.number) : Number(blockNumberOrTagOrHash);

      const blockDiff = Number(latestBlock.blockNumber) - currentBlockNumber;
      if (blockDiff <= latestBlockTolerance) {
        blockNumberOrTagOrHash = EthImpl.blockLatest;
      }

      // If ever we get the latest block from cache, and blockNumberOrTag is not latest, then we need to get the block timestamp
      // This should rarely happen.
      if (blockNumberOrTagOrHash !== EthImpl.blockLatest && latestBlock.timeStampTo === '0') {
        latestBlock = await this.blockNumberTimestamp(EthImpl.ethGetBalance, requestIdPrefix);
      }
    }

    // check cache first
    // create a key for the cache
    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BALANCE}-${account}-${blockNumberOrTagOrHash}`;
    let cachedBalance = await this.cacheService.getAsync(cacheKey, EthImpl.ethGetBalance, requestIdPrefix);
    if (cachedBalance && this.shouldUseCacheForBalance(blockNumberOrTagOrHash)) {
      this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(cachedBalance)}`);
      return cachedBalance;
    }

    let blockNumber = null;
    let balanceFound = false;
    let weibars = BigInt(0);
    let mirrorAccount;

    try {
      if (!this.common.blockTagIsLatestOrPending(blockNumberOrTagOrHash)) {
        const block = await this.common.getHistoricalBlockResponse(blockNumberOrTagOrHash, true, requestIdPrefix);
        if (block) {
          blockNumber = block.number;

          // A blockNumberOrTag has been provided. If it is `latest` or `pending` retrieve the balance from /accounts/{account.id}
          // If the parsed blockNumber is the same as the one from the latest block retrieve the balance from /accounts/{account.id}
          if (latestBlock && block.number !== latestBlock.blockNumber) {
            const latestTimestamp = Number(latestBlock.timeStampTo.split('.')[0]);
            const blockTimestamp = Number(block.timestamp.from.split('.')[0]);
            const timeDiff = latestTimestamp - blockTimestamp;
            // The block is NOT from the last 15 minutes, use /balances rest API
            if (timeDiff > constants.BALANCES_UPDATE_INTERVAL) {
              const balance = await this.mirrorNodeClient.getBalanceAtTimestamp(
                account,
                block.timestamp.from,
                requestIdPrefix,
              );
              balanceFound = true;
              if (balance?.balances?.length) {
                weibars = BigInt(balance.balances[0].balance) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
              }
            }
            // The block is from the last 15 minutes, therefore the historical balance hasn't been imported in the Mirror Node yet
            else {
              let currentBalance = 0;
              let balanceFromTxs = 0;
              mirrorAccount = await this.mirrorNodeClient.getAccountPageLimit(account, requestIdPrefix);
              if (mirrorAccount) {
                if (mirrorAccount.balance) {
                  currentBalance = mirrorAccount.balance.balance;
                }

                // The balance in the account is real time, so we simply subtract the transactions to the block.timestamp.to to get a block relevant balance.
                // needs to be updated below.
                const nextPage: string = mirrorAccount.links.next;

                if (nextPage) {
                  // If we have a pagination link that falls within the block.timestamp.to, we need to paginate to get the transactions for the block.timestamp.to
                  const nextPageParams = new URLSearchParams(nextPage.split('?')[1]);
                  const nextPageTimeMarker = nextPageParams.get('timestamp');
                  // If nextPageTimeMarker is greater than the block.timestamp.to, then we need to paginate to get the transactions for the block.timestamp.to
                  if (nextPageTimeMarker && nextPageTimeMarker?.split(':')[1] >= block.timestamp.to) {
                    const pagedTransactions = await this.mirrorNodeClient.getAccountPaginated(
                      nextPage,
                      requestIdPrefix,
                    );
                    mirrorAccount.transactions = mirrorAccount.transactions.concat(pagedTransactions);
                  }
                  // If nextPageTimeMarker is less than the block.timestamp.to, then just run the getBalanceAtBlockTimestamp function in this case as well.
                }

                balanceFromTxs = this.getBalanceAtBlockTimestamp(
                  mirrorAccount.account,
                  mirrorAccount.transactions,
                  block.timestamp.to,
                );

                balanceFound = true;
                weibars = BigInt(currentBalance - balanceFromTxs) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
              }
            }
          }
        }
      }

      if (!balanceFound && !mirrorAccount) {
        // If no balance and no account, then we need to make a request to the mirror node for the account.
        mirrorAccount = await this.mirrorNodeClient.getAccountPageLimit(account, requestIdPrefix);
        // Test if exists here
        if (mirrorAccount !== null && mirrorAccount !== undefined) {
          balanceFound = true;
          weibars = BigInt(mirrorAccount.balance.balance) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
        }
      }

      if (!balanceFound) {
        this.logger.debug(
          `${requestIdPrefix} Unable to find account ${account} in block ${JSON.stringify(
            blockNumber,
          )}(${blockNumberOrTagOrHash}), returning 0x0 balance`,
        );
        return EthImpl.zeroHex;
      }

      // save in cache the current balance for the account and blockNumberOrTag
      cachedBalance = numberTo0x(weibars);
      await this.cacheService.set(
        cacheKey,
        cachedBalance,
        EthImpl.ethGetBalance,
        this.ethGetBalanceCacheTtlMs,
        requestIdPrefix,
      );

      return cachedBalance;
    } catch (error: any) {
      throw this.common.genericErrorHandler(
        error,
        `${requestIdPrefix} Error raised during getBalance for account ${account}`,
      );
    }
  }

  /**
   * Gets the smart contract code for the contract at the given Ethereum address.
   *
   * @param address
   * @param blockNumber
   * @param requestIdPrefix
   */
  async getCode(address: string, blockNumber: string | null, requestIdPrefix?: string): Promise<any | string> {
    if (!EthImpl.isBlockParamValid(blockNumber)) {
      throw predefined.UNKNOWN_BLOCK(
        `The value passed is not a valid blockHash/blockNumber/blockTag value: ${blockNumber}`,
      );
    }
    this.logger.trace(`${requestIdPrefix} getCode(address=${address}, blockNumber=${blockNumber})`);

    // check for static precompile cases first before consulting nodes
    // this also account for environments where system entities were not yet exposed to the mirror node
    if (address === EthImpl.iHTSAddress) {
      this.logger.trace(
        `${requestIdPrefix} HTS precompile case, return ${EthImpl.invalidEVMInstruction} for byte code`,
      );
      return EthImpl.invalidEVMInstruction;
    }

    const cachedLabel = `getCode.${address}.${blockNumber}`;
    const cachedResponse: string | undefined = await this.cacheService.getAsync(
      cachedLabel,
      EthImpl.ethGetCode,
      requestIdPrefix,
    );
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    try {
      const result = await this.mirrorNodeClient.resolveEntityType(
        address,
        [constants.TYPE_CONTRACT, constants.TYPE_TOKEN],
        EthImpl.ethGetCode,
        requestIdPrefix,
      );
      if (result) {
        if (result?.type === constants.TYPE_TOKEN) {
          this.logger.trace(`${requestIdPrefix} Token redirect case, return redirectBytecode`);
          return EthImpl.redirectBytecodeAddressReplace(address);
        } else if (result?.type === constants.TYPE_CONTRACT) {
          if (result?.entity.runtime_bytecode !== EthImpl.emptyHex) {
            const prohibitedOpcodes = ['CALLCODE', 'DELEGATECALL', 'SELFDESTRUCT', 'SUICIDE'];
            const opcodes = asm.disassemble(result?.entity.runtime_bytecode);
            const hasProhibitedOpcode =
              opcodes.filter((opcode) => prohibitedOpcodes.indexOf(opcode.opcode.mnemonic) > -1).length > 0;
            if (!hasProhibitedOpcode) {
              await this.cacheService.set(
                cachedLabel,
                result?.entity.runtime_bytecode,
                EthImpl.ethGetCode,
                undefined,
                requestIdPrefix,
              );
              return result?.entity.runtime_bytecode;
            }
          }
        }
      }

      const bytecode = await this.hapiService
        .getSDKClient()
        .getContractByteCode(0, 0, address, EthImpl.ethGetCode, requestIdPrefix);
      return prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      if (e instanceof SDKClientError) {
        // handle INVALID_CONTRACT_ID or CONTRACT_DELETED
        if (e.isInvalidContractId() || e.isContractDeleted()) {
          this.logger.debug(
            `${requestIdPrefix} Unable to find code for contract ${address} in block "${blockNumber}", returning 0x0, err code: ${e.statusCode}`,
          );
          return EthImpl.emptyHex;
        }

        this.hapiService.decrementErrorCounter(e.statusCode);
        this.logger.error(
          e,
          `${requestIdPrefix} Error raised during getCode for address ${address}, err code: ${e.statusCode}`,
        );
      } else if (e instanceof PrecheckStatusError) {
        if (
          e.status._code === constants.PRECHECK_STATUS_ERROR_STATUS_CODES.INVALID_CONTRACT_ID ||
          e.status._code === constants.PRECHECK_STATUS_ERROR_STATUS_CODES.CONTRACT_DELETED
        ) {
          this.logger.debug(
            `${requestIdPrefix} Unable to find code for contract ${address} in block "${blockNumber}", returning 0x0, err code: ${e.message}`,
          );
          return EthImpl.emptyHex;
        }

        this.hapiService.decrementErrorCounter(e.status._code);
        this.logger.error(
          e,
          `${requestIdPrefix} Error raised during getCode for address ${address}, err code: ${e.status._code}`,
        );
      } else {
        this.logger.error(e, `${requestIdPrefix} Error raised during getCode for address ${address}`);
      }

      throw e;
    }
  }

  /**
   * Gets the block with the given hash.
   *
   * @param hash
   * @param showDetails
   * @param requestIdPrefix
   */
  async getBlockByHash(hash: string, showDetails: boolean, requestIdPrefix?: string): Promise<Block | null> {
    this.logger.trace(`${requestIdPrefix} getBlockByHash(hash=${hash}, showDetails=${showDetails})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BLOCK_BY_HASH}_${hash}_${showDetails}`;
    let block = await this.cacheService.getAsync(cacheKey, EthImpl.ethGetBlockByHash, requestIdPrefix);
    if (!block) {
      block = await this.getBlock(hash, showDetails, requestIdPrefix).catch((e: any) => {
        throw this.common.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
      });
      await this.cacheService.set(cacheKey, block, EthImpl.ethGetBlockByHash, undefined, requestIdPrefix);
    }

    return block;
  }

  /**
   * Gets the block by its block number.
   * @param blockNumOrTag Possible values are earliest/pending/latest or hex, and can't be null (validator check).
   * @param showDetails
   * @param requestIdPrefix
   */
  async getBlockByNumber(blockNumOrTag: string, showDetails: boolean, requestIdPrefix?: string): Promise<Block | null> {
    this.logger.trace(`${requestIdPrefix} getBlockByNumber(blockNum=${blockNumOrTag}, showDetails=${showDetails})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BLOCK_BY_NUMBER}_${blockNumOrTag}_${showDetails}`;
    let block = await this.cacheService.getAsync(cacheKey, EthImpl.ethGetBlockByNumber, requestIdPrefix);
    if (!block) {
      block = await this.getBlock(blockNumOrTag, showDetails, requestIdPrefix).catch((e: any) => {
        throw this.common.genericErrorHandler(
          e,
          `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNumOrTag}`,
        );
      });

      if (blockNumOrTag != EthImpl.blockLatest && blockNumOrTag != EthImpl.blockPending) {
        await this.cacheService.set(cacheKey, block, EthImpl.ethGetBlockByNumber, undefined, requestIdPrefix);
      }
    }

    return block;
  }

  /**
   * Gets the number of transaction in a block by its block hash.
   *
   * @param hash
   * @param requestIdPrefix
   */
  async getBlockTransactionCountByHash(hash: string, requestIdPrefix?: string): Promise<string | null> {
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByHash(hash=${hash}, showDetails=%o)`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_COUNT_BY_HASH}_${hash}`;
    const cachedResponse = await this.cacheService.getAsync(
      cacheKey,
      EthImpl.ethGetTransactionCountByHash,
      requestIdPrefix,
    );
    if (cachedResponse) {
      this.logger.debug(
        `${requestIdPrefix} getBlockTransactionCountByHash returned cached response: ${cachedResponse}`,
      );
      return cachedResponse;
    }

    const transactionCount = await this.mirrorNodeClient
      .getBlock(hash, requestIdPrefix)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        throw this.common.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
      });

    await this.cacheService.set(
      cacheKey,
      transactionCount,
      EthImpl.ethGetTransactionCountByHash,
      undefined,
      requestIdPrefix,
    );
    return transactionCount;
  }

  /**
   * Gets the number of transaction in a block by its block number.
   * @param blockNumOrTag
   * @param requestIdPrefix
   */
  async getBlockTransactionCountByNumber(blockNumOrTag: string, requestIdPrefix?: string): Promise<string | null> {
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByNumber(blockNum=${blockNumOrTag}, showDetails=%o)`);
    const blockNum = await this.translateBlockTag(blockNumOrTag, requestIdPrefix);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_COUNT_BY_NUMBER}_${blockNum}`;
    const cachedResponse = await this.cacheService.getAsync(
      cacheKey,
      EthImpl.ethGetTransactionCountByNumber,
      requestIdPrefix,
    );
    if (cachedResponse) {
      this.logger.debug(
        `${requestIdPrefix} getBlockTransactionCountByNumber returned cached response: ${cachedResponse}`,
      );
      return cachedResponse;
    }

    const transactionCount = await this.mirrorNodeClient
      .getBlock(blockNum, requestIdPrefix)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        throw this.common.genericErrorHandler(
          e,
          `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNum}`,
        );
      });

    await this.cacheService.set(
      cacheKey,
      transactionCount,
      EthImpl.ethGetTransactionCountByNumber,
      undefined,
      requestIdPrefix,
    );
    return transactionCount;
  }

  /**
   * Gets the transaction in a block by its block hash and transactions index.
   *
   * @param blockHash
   * @param transactionIndex
   * @param requestIdPrefix
   */
  async getTransactionByBlockHashAndIndex(
    blockHash: string,
    transactionIndex: string,
    requestIdPrefix?: string,
  ): Promise<Transaction | null> {
    this.logger.trace(
      `${requestIdPrefix} getTransactionByBlockHashAndIndex(hash=${blockHash}, index=${transactionIndex})`,
    );

    try {
      return await this.getTransactionByBlockHashOrBlockNumAndIndex(
        { title: 'blockHash', value: blockHash },
        transactionIndex,
        requestIdPrefix,
      );
    } catch (error) {
      throw this.common.genericErrorHandler(
        error,
        `${requestIdPrefix} Failed to retrieve contract result for blockHash ${blockHash} and index=${transactionIndex}`,
      );
    }
  }

  /**
   * Gets the transaction in a block by its block hash and transactions index.
   *
   * @param blockNumOrTag
   * @param transactionIndex
   * @param requestIdPrefix
   */
  async getTransactionByBlockNumberAndIndex(
    blockNumOrTag: string,
    transactionIndex: string,
    requestIdPrefix?: string,
  ): Promise<Transaction | null> {
    this.logger.trace(
      `${requestIdPrefix} getTransactionByBlockNumberAndIndex(blockNum=${blockNumOrTag}, index=${transactionIndex})`,
    );
    const blockNum = await this.translateBlockTag(blockNumOrTag, requestIdPrefix);

    try {
      return await this.getTransactionByBlockHashOrBlockNumAndIndex(
        { title: 'blockNumber', value: blockNum },
        transactionIndex,
        requestIdPrefix,
      );
    } catch (error) {
      throw this.common.genericErrorHandler(
        error,
        `${requestIdPrefix} Failed to retrieve contract result for blockNum ${blockNum} and index=${transactionIndex}`,
      );
    }
  }

  /**
   * Gets the number of transactions that have been executed for the given address.
   * This goes to the consensus nodes to determine the ethereumNonce.
   *
   * Queries mirror node for best effort and fallsback to consensus node for contracts until HIP 729 is implemented.
   *
   * @param address
   * @param blockNumOrTag
   * @param requestIdPrefix
   */
  async getTransactionCount(
    address: string,
    blockNumOrTag: string | null,
    requestIdPrefix?: string,
  ): Promise<string | JsonRpcError> {
    this.logger.trace(`${requestIdPrefix} getTransactionCount(address=${address}, blockNumOrTag=${blockNumOrTag})`);

    // cache considerations for high load
    const cacheKey = `eth_getTransactionCount_${address}_${blockNumOrTag}`;
    let nonceCount = await this.cacheService.getAsync(cacheKey, EthImpl.ethGetTransactionCount, requestIdPrefix);
    if (nonceCount) {
      this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(nonceCount)}`);
      return nonceCount;
    }

    const blockNum = Number(blockNumOrTag);
    if (blockNumOrTag) {
      if (blockNum === 0 || blockNum === 1) {
        // previewnet and testnet bug have a genesis blockNumber of 1 but non system account were yet to be created
        return EthImpl.zeroHex;
      } else if (this.common.blockTagIsLatestOrPending(blockNumOrTag)) {
        // if latest or pending, get latest ethereumNonce from mirror node account API
        nonceCount = await this.getAccountLatestEthereumNonce(address, requestIdPrefix);
      } else if (blockNumOrTag === EthImpl.blockEarliest) {
        nonceCount = await this.getAccountNonceForEarliestBlock(requestIdPrefix);
      } else if (!isNaN(blockNum) && blockNumOrTag.length != EthImpl.blockHashLength && blockNum > 0) {
        nonceCount = await this.getAccountNonceForHistoricBlock(address, blockNum, requestIdPrefix);
      } else if (blockNumOrTag.length == EthImpl.blockHashLength && blockNumOrTag.startsWith(EthImpl.emptyHex)) {
        nonceCount = await this.getAccountNonceForHistoricBlock(address, blockNumOrTag, requestIdPrefix);
      } else {
        // return a '-39001: Unknown block' error per api-spec
        throw predefined.UNKNOWN_BLOCK();
      }
    } else {
      // if no block consideration, get latest ethereumNonce from mirror node if account or from consensus node is contract until HIP 729 is implemented
      nonceCount = await this.getAccountLatestEthereumNonce(address, requestIdPrefix);
    }

    const cacheTtl =
      blockNumOrTag === EthImpl.blockEarliest || !isNaN(blockNum)
        ? constants.CACHE_TTL.ONE_DAY
        : this.ethGetTransactionCountCacheTtl; // cache historical values longer as they don't change
    await this.cacheService.set(cacheKey, nonceCount, EthImpl.ethGetTransactionCount, cacheTtl, requestIdPrefix);

    return nonceCount;
  }

  async parseRawTxAndPrecheck(transaction: string, requestIdPrefix?: string): Promise<EthersTransaction> {
    let interactingEntity = '';
    let originatingAddress = '';
    try {
      this.precheck.checkSize(transaction);
      const parsedTx = Precheck.parseTxIfNeeded(transaction);
      interactingEntity = parsedTx.to?.toString() || '';
      originatingAddress = parsedTx.from?.toString() || '';
      this.logger.trace(
        `${requestIdPrefix} sendRawTransaction(from=${originatingAddress}, to=${interactingEntity}, transaction=${transaction})`,
      );

      const gasPrice = Number(await this.gasPrice(requestIdPrefix));
      await this.precheck.sendRawTransactionCheck(parsedTx, gasPrice, requestIdPrefix);
      return parsedTx;
    } catch (e: any) {
      this.logger.warn(
        `${requestIdPrefix} Error on precheck sendRawTransaction(from=${originatingAddress}, to=${interactingEntity}, transaction=${transaction})`,
      );
      throw this.common.genericErrorHandler(e);
    }
  }

  async sendRawTransactionErrorHandler(
    e,
    transaction,
    transactionBuffer,
    txSubmitted,
    parsedTx,
    requestIdPrefix,
  ): Promise<string | JsonRpcError> {
    this.logger.error(
      e,
      `${requestIdPrefix} Failed to successfully submit sendRawTransaction for transaction ${transaction}`,
    );
    if (e instanceof JsonRpcError) {
      return e;
    }

    if (e instanceof SDKClientError) {
      this.hapiService.decrementErrorCounter(e.statusCode);
      if (e.status.toString() === constants.TRANSACTION_RESULT_STATUS.WRONG_NONCE) {
        // note: because this is a WRONG_NONCE error handler, the nonce of the account is expected to be different from the nonce of the parsedTx
        //       running a polling loop to give mirror node enough time to update account nonce
        let accountNonce: number | null = null;
        for (let i = 0; i < this.MirrorNodeGetContractResultRetries; i++) {
          const accountInfo = await this.mirrorNodeClient.getAccount(parsedTx.from!, requestIdPrefix);
          if (accountInfo.ethereum_nonce !== parsedTx.nonce) {
            accountNonce = accountInfo.ethereum_nonce;
            break;
          }

          this.logger.trace(
            `${requestIdPrefix} Repeating retry to poll for updated account nonce. Count ${i} of ${
              this.MirrorNodeGetContractResultRetries
            }. Waiting ${this.mirrorNodeClient.getMirrorNodeRetryDelay()} ms before initiating a new request`,
          );
          await new Promise((r) => setTimeout(r, this.mirrorNodeClient.getMirrorNodeRetryDelay()));
        }

        if (!accountNonce) {
          this.logger.warn(`${requestIdPrefix} Cannot find updated account nonce.`);
          throw predefined.INTERNAL_ERROR(`Cannot find updated account nonce for WRONT_NONCE error.`);
        }

        if (parsedTx.nonce > accountNonce) {
          return predefined.NONCE_TOO_HIGH(parsedTx.nonce, accountNonce);
        } else {
          return predefined.NONCE_TOO_LOW(parsedTx.nonce, accountNonce);
        }
      }
    }

    if (!txSubmitted) {
      return predefined.INTERNAL_ERROR(e.message.toString());
    }

    await this.mirrorNodeClient.getContractRevertReasonFromTransaction(e, requestIdPrefix);

    this.logger.error(
      e,
      `${requestIdPrefix} Failed sendRawTransaction during record retrieval for transaction ${transaction}, returning computed hash`,
    );
    //Return computed hash if unable to retrieve EthereumHash from record due to error
    return prepend0x(createHash('keccak256').update(transactionBuffer).digest('hex'));
  }

  /**
   * Submits a transaction to the network for execution.
   *
   * @param transaction
   * @param requestIdPrefix
   */
  async sendRawTransaction(transaction: string, requestIdPrefix: string): Promise<string | JsonRpcError> {
    if (transaction?.length >= constants.FUNCTION_SELECTOR_CHAR_LENGTH)
      this.ethExecutionsCounter
        .labels(EthImpl.ethSendRawTransaction, transaction.substring(0, constants.FUNCTION_SELECTOR_CHAR_LENGTH))
        .inc();

    const parsedTx = await this.parseRawTxAndPrecheck(transaction, requestIdPrefix);
    const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction), 'hex');
    let fileId: FileId | null = null;
    let txSubmitted = false;
    try {
      const sendRawTransactionResult = await this.hapiService
        .getSDKClient()
        .submitEthereumTransaction(
          transactionBuffer,
          EthImpl.ethSendRawTransaction,
          requestIdPrefix,
          this.transactionService,
        );

      txSubmitted = true;
      fileId = sendRawTransactionResult!.fileId;

      // Wait for the record from the execution.
      const txId = sendRawTransactionResult!.txResponse.transactionId.toString();
      const formattedId = formatTransactionIdWithoutQueryParams(txId);

      // handle formattedId being null
      if (!formattedId) {
        throw predefined.INTERNAL_ERROR(`Invalid transactionID: ${txId}`);
      }

      const contractResult = await this.mirrorNodeClient.repeatedRequest(
        this.mirrorNodeClient.getContractResult.name,
        [formattedId],
        this.MirrorNodeGetContractResultRetries,
        requestIdPrefix,
      );

      if (!contractResult) {
        this.logger.warn(`${requestIdPrefix} No record retrieved`);
        throw predefined.INTERNAL_ERROR(`No matching record found for transaction id ${txId}`);
      }

      if (contractResult.hash == null) {
        this.logger.error(
          `${requestIdPrefix} The ethereumHash can never be null for an ethereum transaction, and yet it was!!`,
        );
        throw predefined.INTERNAL_ERROR();
      }

      return contractResult.hash;
    } catch (e: any) {
      return this.sendRawTransactionErrorHandler(
        e,
        transaction,
        transactionBuffer,
        txSubmitted,
        parsedTx,
        requestIdPrefix,
      );
    } finally {
      /**
       *  For transactions of type CONTRACT_CREATE, if the contract's bytecode (calldata) exceeds 5120 bytes, HFS is employed to temporarily store the bytecode on the network.
       *  After transaction execution, whether successful or not, any entity associated with the 'fileId' should be removed from the Hedera network.
       */
      if (fileId) {
        this.hapiService
          .getSDKClient()
          .deleteFile(
            fileId,
            requestIdPrefix,
            EthImpl.ethSendRawTransaction,
            fileId.toString(),
            this.transactionService,
          );
      }
    }
  }

  /**
   * Execute a free contract call query.
   *
   * @param call {IContractCallRequest} The contract call request data.
   * @param blockParam either a string (blockNumber or blockTag) or an object (blockHash or blockNumber)
   * @param requestIdPrefix optional request ID prefix for logging.
   */
  async call(
    call: IContractCallRequest,
    blockParam: string | object | null,
    requestIdPrefix?: string,
  ): Promise<string | JsonRpcError> {
    const callData = call.data ? call.data : call.input;
    // log request
    this.logger.trace(
      `${requestIdPrefix} call({to=${call.to}, from=${call.from}, data=${callData}, gas=${call.gas}, gasPrice=${call.gasPrice} blockParam=${blockParam}, estimate=${call.estimate})`,
    );
    // log call data size
    const callDataSize = callData ? callData.length : 0;
    this.logger.trace(`${requestIdPrefix} call data size: ${callDataSize}`);
    // metrics for selector
    if (callDataSize >= constants.FUNCTION_SELECTOR_CHAR_LENGTH) {
      this.ethExecutionsCounter
        .labels(EthImpl.ethCall, callData!.substring(0, constants.FUNCTION_SELECTOR_CHAR_LENGTH))
        .inc();
    }

    const blockNumberOrTag = await this.extractBlockNumberOrTag(blockParam, requestIdPrefix);
    await this.performCallChecks(call);

    // Get a reasonable value for "gas" if it is not specified.
    const gas = this.getCappedBlockGasLimit(call.gas?.toString(), requestIdPrefix);

    this.contractCallFormat(call);

    let result: string | JsonRpcError = '';
    try {
      // ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = false enables the use of Mirror node
      if (
        process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE === undefined ||
        process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE == 'false'
      ) {
        //temporary workaround until precompiles are implemented in Mirror node evm module
        // Execute the call and get the response
        result = await this.callMirrorNode(call, gas, call.value, blockNumberOrTag, requestIdPrefix);
      } else {
        result = await this.callConsensusNode(call, gas, requestIdPrefix);
      }

      this.logger.debug(`${requestIdPrefix} eth_call response: ${JSON.stringify(result)}`);

      return result;
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Failed to successfully submit eth_call`);
      if (e instanceof JsonRpcError) {
        return e;
      }
      return predefined.INTERNAL_ERROR(e.message.toString());
    }
  }

  /**
   * Gets transactions by block hash or block number and index with resolved EVM addresses
   * @param blockParam
   * @param transactionIndex
   * @param requestIdPrefix
   * @returns Promise<Transaction | null>
   */
  private async getTransactionByBlockHashOrBlockNumAndIndex(
    blockParam: {
      title: 'blockHash' | 'blockNumber';
      value: string | number;
    },
    transactionIndex: string,
    requestIdPrefix?: string,
  ): Promise<Transaction | null> {
    const contractResults = await this.mirrorNodeClient.getContractResults(
      {
        [blockParam.title]: blockParam.value,
        transactionIndex: Number(transactionIndex),
      },
      undefined,
      requestIdPrefix,
    );

    if (!contractResults[0]) return null;

    const resolvedToAddress = await this.resolveEvmAddress(contractResults[0].to, requestIdPrefix);
    const resolvedFromAddress = await this.resolveEvmAddress(contractResults[0].from, requestIdPrefix, [
      constants.TYPE_ACCOUNT,
    ]);

    return formatContractResult({ ...contractResults[0], from: resolvedFromAddress, to: resolvedToAddress });
  }

  // according to EIP-1898 (https://eips.ethereum.org/EIPS/eip-1898) block param can either be a string (blockNumber or Block Tag) or an object (blockHash or blockNumber)
  private async extractBlockNumberOrTag(
    blockParam: string | object | null,
    requestIdPrefix: string | undefined,
  ): Promise<string | null> {
    if (!blockParam) {
      return null;
    }

    // is an object
    if (typeof blockParam === 'object') {
      // object has property blockNumber, example: { "blockNumber": "0x0" }
      if (blockParam['blockNumber'] != null) {
        return blockParam['blockNumber'];
      }

      if (blockParam['blockHash'] != null) {
        return await this.getBlockNumberFromHash(blockParam['blockHash'], requestIdPrefix);
      }

      // if is an object but doesn't have blockNumber or blockHash, then it's an invalid blockParam
      throw predefined.INVALID_ARGUMENTS('neither block nor hash specified');
    }

    // if blockParam is a string, could be a blockNumber or blockTag or blockHash
    if (typeof blockParam === 'string' && blockParam.length > 0) {
      // if string is a blockHash, we return its corresponding blockNumber
      if (EthImpl.isBlockHash(blockParam)) {
        return await this.getBlockNumberFromHash(blockParam, requestIdPrefix);
      } else {
        return blockParam;
      }
    }

    return null;
  }

  private async getBlockNumberFromHash(blockHash: string, requestIdPrefix: string | undefined): Promise<string> {
    const block = await this.getBlockByHash(blockHash, false, requestIdPrefix);
    if (block != null) {
      return block.number;
    } else {
      throw predefined.RESOURCE_NOT_FOUND(`Block Hash: '${blockHash}'`);
    }
  }

  async callMirrorNode(
    call: IContractCallRequest,
    gas: number | null,
    value: number | string | null | undefined,
    block: string | null,
    requestIdPrefix?: string,
  ): Promise<string | JsonRpcError> {
    let callData: IContractCallRequest = {};
    try {
      this.logger.debug(
        `${requestIdPrefix} Making eth_call on contract ${call.to} with gas ${gas} and call data "${call.data}" from "${call.from}" at blockBlockNumberOrTag: "${block}" using mirror-node.`,
        call.to,
        gas,
        call.data,
        call.from,
        block,
      );
      callData = {
        ...call,
        ...(gas !== null ? { gas } : {}), // Add gas only if it's not null
        ...(value !== null ? { value } : {}),
        estimate: false,
        ...(block !== null ? { block } : {}),
      };

      const contractCallResponse = await this.mirrorNodeClient.postContractCall(callData, requestIdPrefix);
      return contractCallResponse?.result ? prepend0x(contractCallResponse.result) : EthImpl.emptyHex;
    } catch (e: any) {
      if (e instanceof JsonRpcError) {
        return e;
      }

      if (e instanceof MirrorNodeClientError) {
        // Handles mirror node error for missing contract
        if (e.isFailInvalid() || e.isInvalidTransaction()) {
          return EthImpl.emptyHex;
        }

        if (e.isRateLimit()) {
          return predefined.IP_RATE_LIMIT_EXCEEDED(e.data || `Rate limit exceeded on ${EthImpl.ethCall}`);
        }

        if (e.isContractReverted()) {
          this.logger.trace(
            `${requestIdPrefix} mirror node eth_call request encountered contract revert. message: ${e.message}, details: ${e.detail}, data: ${e.data}`,
          );
          return predefined.CONTRACT_REVERT(e.detail || e.message, e.data);
        }

        // Temporary workaround until mirror node web3 module implements the support of precompiles
        // If mirror node throws, rerun eth_call and force it to go through the Consensus network
        if (e.isNotSupported() || e.isNotSupportedSystemContractOperaton()) {
          const errorTypeMessage =
            e.isNotSupported() || e.isNotSupportedSystemContractOperaton() ? 'Unsupported' : 'Unhandled';
          this.logger.trace(
            `${requestIdPrefix} ${errorTypeMessage} mirror node eth_call request, retrying with consensus node. details: ${JSON.stringify(
              callData,
            )} with error: "${e.message}"`,
          );
          return await this.callConsensusNode(call, gas, requestIdPrefix);
        }
      }

      this.logger.error(e, `${requestIdPrefix} Failed to successfully submit eth_call`);

      return predefined.INTERNAL_ERROR(e.message.toString());
    }
  }

  /**
   * Execute a contract call query to the consensus node
   *
   * @param call
   * @param gas
   * @param requestIdPrefix
   */
  async callConsensusNode(call: any, gas: number | null, requestIdPrefix?: string): Promise<string | JsonRpcError> {
    // Execute the call and get the response
    if (!gas) {
      gas = Number.parseInt(this.defaultGas);
    }

    this.logger.debug(
      `${requestIdPrefix} Making eth_call on contract ${call.to} with gas ${gas} and call data "${call.data}" from "${call.from}" using consensus-node.`,
      call.to,
      gas,
      call.data,
      call.from,
    );

    // If "From" is distinct from blank, we check is a valid account
    if (call.from) {
      if (!isValidEthereumAddress(call.from)) {
        throw predefined.NON_EXISTING_ACCOUNT(call.from);
      }
    }

    // Check "To" is a valid Contract or HTS Address
    if (!isValidEthereumAddress(call.to)) {
      throw predefined.INVALID_CONTRACT_ADDRESS(call.to);
    }

    try {
      let data = call.data;
      if (data) {
        data = crypto.createHash('sha1').update(call.data).digest('hex'); // NOSONAR
      }

      const cacheKey = `${constants.CACHE_KEY.ETH_CALL}:.${call.to}.${data}`;
      const cachedResponse = await this.cacheService.getAsync(cacheKey, EthImpl.ethCall, requestIdPrefix);

      if (cachedResponse != undefined) {
        this.logger.debug(`${requestIdPrefix} eth_call returned cached response: ${cachedResponse}`);
        return cachedResponse;
      }

      const contractCallResponse = await this.hapiService
        .getSDKClient()
        .submitContractCallQueryWithRetry(call.to, call.data, gas, call.from, EthImpl.ethCall, requestIdPrefix);
      if (contractCallResponse) {
        const formattedCallReponse = prepend0x(Buffer.from(contractCallResponse.asBytes()).toString('hex'));

        await this.cacheService.set(
          cacheKey,
          formattedCallReponse,
          EthImpl.ethCall,
          this.ethCallCacheTtl,
          requestIdPrefix,
        );
        return formattedCallReponse;
      }

      return predefined.INTERNAL_ERROR(
        `Invalid contractCallResponse from consensus-node: ${JSON.stringify(contractCallResponse)}`,
      );
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Failed to successfully submit contractCallQuery`);
      if (e instanceof JsonRpcError) {
        return e;
      }

      if (e instanceof SDKClientError) {
        this.hapiService.decrementErrorCounter(e.statusCode);
      }
      return predefined.INTERNAL_ERROR(e.message.toString());
    }
  }

  /**
   * Perform neccecery checks for the passed call object
   *
   * @param call
   */
  async performCallChecks(call: any): Promise<void> {
    // after this PR https://github.com/hashgraph/hedera-mirror-node/pull/8100 in mirror-node, call.to is allowed to be empty or null
    if (call.to && !isValidEthereumAddress(call.to)) {
      throw predefined.INVALID_CONTRACT_ADDRESS(call.to);
    }
  }

  async resolveEvmAddress(
    address: string,
    requestIdPrefix?: string,
    searchableTypes = [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
  ): Promise<string> {
    if (!address) return address;

    const entity = await this.mirrorNodeClient.resolveEntityType(
      address,
      searchableTypes,
      EthImpl.ethGetCode,
      requestIdPrefix,
      0,
    );
    let resolvedAddress = address;
    if (
      entity &&
      (entity.type === constants.TYPE_CONTRACT || entity.type === constants.TYPE_ACCOUNT) &&
      entity.entity?.evm_address
    ) {
      resolvedAddress = entity.entity.evm_address;
    }

    return resolvedAddress;
  }

  /**
   * Gets a transaction by the provided hash
   *
   * @param hash
   * @param requestIdPrefix
   */
  async getTransactionByHash(hash: string, requestIdPrefix?: string): Promise<Transaction | null> {
    this.logger.trace(`${requestIdPrefix} getTransactionByHash(hash=${hash})`, hash);

    const contractResult = await this.mirrorNodeClient.getContractResultWithRetry(hash, requestIdPrefix);
    if (contractResult === null || contractResult.hash === undefined) {
      // handle synthetic transactions
      const syntheticLogs = await this.common.getLogsWithParams(
        null,
        {
          'transaction.hash': hash,
        },
        requestIdPrefix,
      );

      // no tx found
      if (!syntheticLogs.length) {
        this.logger.trace(`${requestIdPrefix} no tx for ${hash}`);
        return null;
      }

      return this.createTransactionFromLog(syntheticLogs[0]);
    }

    if (!contractResult.block_number || (!contractResult.transaction_index && contractResult.transaction_index !== 0)) {
      this.logger.warn(
        `${requestIdPrefix} getTransactionByHash(hash=${hash}) mirror-node returned status 200 with missing properties in contract_results - block_number==${contractResult.block_number} and transaction_index==${contractResult.transaction_index}`,
      );
    }

    const fromAddress = await this.resolveEvmAddress(contractResult.from, requestIdPrefix, [constants.TYPE_ACCOUNT]);
    const toAddress = await this.resolveEvmAddress(contractResult.to, requestIdPrefix);
    contractResult.chain_id = contractResult.chain_id || this.chain;

    return formatContractResult({
      ...contractResult,
      from: fromAddress,
      to: toAddress,
    });
  }

  /**
   * Gets a receipt for a transaction that has already executed.
   *
   * @param hash
   * @param requestIdPrefix
   */
  async getTransactionReceipt(hash: string, requestIdPrefix?: string): Promise<any> {
    this.logger.trace(`${requestIdPrefix} getTransactionReceipt(${hash})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_RECEIPT}_${hash}`;
    const cachedResponse = await this.cacheService.getAsync(
      cacheKey,
      EthImpl.ethGetTransactionReceipt,
      requestIdPrefix,
    );
    if (cachedResponse) {
      this.logger.debug(
        `${requestIdPrefix} getTransactionReceipt returned cached response: ${JSON.stringify(cachedResponse)}`,
      );
      return cachedResponse;
    }

    const receiptResponse = await this.mirrorNodeClient.getContractResultWithRetry(hash, requestIdPrefix);
    if (receiptResponse === null || receiptResponse.hash === undefined) {
      // handle synthetic transactions
      const syntheticLogs = await this.common.getLogsWithParams(
        null,
        {
          'transaction.hash': hash,
        },
        requestIdPrefix,
      );

      // no tx found
      if (!syntheticLogs.length) {
        this.logger.trace(`${requestIdPrefix} no receipt for ${hash}`);
        return null;
      }

      const gasPriceForTimestamp = await this.getCurrentGasPriceForBlock(syntheticLogs[0].blockHash);
      const receipt: ITransactionReceipt = {
        blockHash: syntheticLogs[0].blockHash,
        blockNumber: syntheticLogs[0].blockNumber,
        contractAddress: syntheticLogs[0].address,
        cumulativeGasUsed: EthImpl.zeroHex,
        effectiveGasPrice: gasPriceForTimestamp,
        from: EthImpl.zeroAddressHex,
        gasUsed: EthImpl.zeroHex,
        logs: [syntheticLogs[0]],
        logsBloom: LogsBloomUtils.buildLogsBloom(syntheticLogs[0].address, syntheticLogs[0].topics),
        root: EthImpl.zeroHex32Byte,
        status: EthImpl.oneHex,
        to: syntheticLogs[0].address,
        transactionHash: syntheticLogs[0].transactionHash,
        transactionIndex: syntheticLogs[0].transactionIndex,
        type: null, // null from HAPI transactions
      };

      this.logger.trace(`${requestIdPrefix} receipt for ${hash} found in block ${receipt.blockNumber}`);

      await this.cacheService.set(
        cacheKey,
        receipt,
        EthImpl.ethGetTransactionReceipt,
        constants.CACHE_TTL.ONE_DAY,
        requestIdPrefix,
      );
      return receipt;
    } else {
      const effectiveGas = await this.getCurrentGasPriceForBlock(receiptResponse.blockHash);
      // support stricter go-eth client which requires the transaction hash property on logs
      const logs = receiptResponse.logs.map((log) => {
        return new Log({
          address: log.address,
          blockHash: toHash32(receiptResponse.block_hash),
          blockNumber: numberTo0x(receiptResponse.block_number),
          data: log.data,
          logIndex: numberTo0x(log.index),
          removed: false,
          topics: log.topics,
          transactionHash: toHash32(receiptResponse.hash),
          transactionIndex: nullableNumberTo0x(receiptResponse.transaction_index),
        });
      });

      const receipt: ITransactionReceipt = {
        blockHash: toHash32(receiptResponse.block_hash),
        blockNumber: numberTo0x(receiptResponse.block_number),
        from: await this.resolveEvmAddress(receiptResponse.from, requestIdPrefix),
        to: await this.resolveEvmAddress(receiptResponse.to, requestIdPrefix),
        cumulativeGasUsed: numberTo0x(receiptResponse.block_gas_used),
        gasUsed: nanOrNumberTo0x(receiptResponse.gas_used),
        contractAddress: receiptResponse.address,
        logs: logs,
        logsBloom: receiptResponse.bloom === EthImpl.emptyHex ? EthImpl.emptyBloom : receiptResponse.bloom,
        transactionHash: toHash32(receiptResponse.hash),
        transactionIndex: nullableNumberTo0x(receiptResponse.transaction_index),
        effectiveGasPrice: effectiveGas,
        root: receiptResponse.root,
        status: receiptResponse.status,
        type: nullableNumberTo0x(receiptResponse.type),
      };

      if (receiptResponse.error_message) {
        receipt.revertReason = isHex(prepend0x(receiptResponse.error_message))
          ? receiptResponse.error_message
          : prepend0x(ASCIIToHex(receiptResponse.error_message));
      }

      this.logger.trace(`${requestIdPrefix} receipt for ${hash} found in block ${receipt.blockNumber}`);

      await this.cacheService.set(
        cacheKey,
        receipt,
        EthImpl.ethGetTransactionReceipt,
        constants.CACHE_TTL.ONE_DAY,
        requestIdPrefix,
      );
      return receipt;
    }
  }

  private async getCurrentGasPriceForBlock(blockHash: string, requestIdPrefix?: string): Promise<string> {
    const block = await this.getBlockByHash(blockHash, false);
    const timestampDecimal = parseInt(block ? block.timestamp : '0', 16);
    const timestampDecimalString = timestampDecimal > 0 ? timestampDecimal.toString() : '';
    const gasPriceForTimestamp = await this.getFeeWeibars(
      EthImpl.ethGetTransactionReceipt,
      requestIdPrefix,
      timestampDecimalString,
    );

    return numberTo0x(gasPriceForTimestamp);
  }

  private static redirectBytecodeAddressReplace(address: string): string {
    return `${this.redirectBytecodePrefix}${address.slice(2)}${this.redirectBytecodePostfix}`;
  }

  private static prune0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex) ? input.substring(2) : input;
  }

  private static isBlockTagEarliest = (tag: string): boolean => {
    return tag === EthImpl.blockEarliest;
  };

  private static isBlockTagFinalized = (tag: string): boolean => {
    return (
      tag === EthImpl.blockFinalized ||
      tag === EthImpl.blockLatest ||
      tag === EthImpl.blockPending ||
      tag === EthImpl.blockSafe
    );
  };

  private static isBlockNumValid = (num: string) => {
    return /^0[xX]([1-9A-Fa-f]+[0-9A-Fa-f]{0,13}|0)$/.test(num) && Number.MAX_SAFE_INTEGER >= Number(num);
  };

  private static isBlockParamValid = (tag: string | null) => {
    return tag == null || this.isBlockTagEarliest(tag) || this.isBlockTagFinalized(tag) || this.isBlockNumValid(tag);
  };

  private static isBlockHash = (blockHash): boolean => {
    return new RegExp(constants.BLOCK_HASH_REGEX + '{64}$').test(blockHash);
  };

  /**
   * Translates a block tag into a number. 'latest', 'pending', and null are the
   * most recent block, 'earliest' is 0, numbers become numbers.
   *
   * @param tag null, a number, or 'latest', 'pending', or 'earliest'
   * @param requestIdPrefix
   * @private
   */
  private async translateBlockTag(tag: string | null, requestIdPrefix?: string): Promise<number> {
    if (this.common.blockTagIsLatestOrPending(tag)) {
      return Number(await this.blockNumber(requestIdPrefix));
    } else if (tag === EthImpl.blockEarliest) {
      return 0;
    } else {
      return Number(tag);
    }
  }

  private getCappedBlockGasLimit(gasString: string | undefined, requestIdPrefix?: string): number | null {
    if (!gasString) {
      // Return null and don't include in the mirror node call, as mirror is doing this estimation on the go.
      return null;
    }

    // Gas limit for `eth_call` is 50_000_000, but the current Hedera network limit is 15_000_000
    // With values over the gas limit, the call will fail with BUSY error so we cap it at 15_000_000
    const gas = Number.parseInt(gasString);
    if (gas > constants.BLOCK_GAS_LIMIT) {
      this.logger.trace(
        `${requestIdPrefix} eth_call gas amount (${gas}) exceeds network limit, capping gas to ${constants.BLOCK_GAS_LIMIT}`,
      );
      return constants.BLOCK_GAS_LIMIT;
    }

    return gas;
  }

  populateSyntheticTransactions(
    showDetails: boolean,
    logs: Log[],
    transactionsArray: Array<any>,
    requestIdPrefix?: string,
  ): Array<any> {
    let filteredLogs: Log[];
    if (showDetails) {
      filteredLogs = logs.filter(
        (log) => !transactionsArray.some((transaction) => transaction.hash === log.transactionHash),
      );
      filteredLogs.forEach((log) => {
        const transaction: Transaction1559 = this.createTransactionFromLog(log);
        transactionsArray.push(transaction);
      });
    } else {
      filteredLogs = logs.filter((log) => !transactionsArray.includes(log.transactionHash));
      filteredLogs.forEach((log) => {
        transactionsArray.push(log.transactionHash);
      });
    }

    this.logger.trace(`${requestIdPrefix} Synthetic transaction hashes will be populated in the block response`);

    return transactionsArray;
  }

  /**
   * Gets the block with the given hash.
   * Given an ethereum transaction hash, call the mirror node to get the block info.
   * Then using the block timerange get all contract results to get transaction details.
   * If showDetails is set to true subsequently call mirror node for additional transaction details
   *
   * @param blockHashOrNumber
   * @param showDetails
   * @param requestIdPrefix
   */
  private async getBlock(
    blockHashOrNumber: string,
    showDetails: boolean,
    requestIdPrefix?: string,
  ): Promise<Block | null> {
    const blockResponse = await this.common.getHistoricalBlockResponse(blockHashOrNumber, true, requestIdPrefix);

    if (blockResponse == null) return null;
    const timestampRange = blockResponse.timestamp;
    const timestampRangeParams = [`gte:${timestampRange.from}`, `lte:${timestampRange.to}`];
    const contractResults = await this.mirrorNodeClient.getContractResults(
      { timestamp: timestampRangeParams },
      undefined,
      requestIdPrefix,
    );
    const maxGasLimit = constants.BLOCK_GAS_LIMIT;
    const gasUsed = blockResponse.gas_used;
    const params = { timestamp: timestampRangeParams };

    // get contract results logs using block timestamp range
    const logs = await this.common.getLogsWithParams(null, params, requestIdPrefix);

    if (contractResults == null && logs.length == 0) {
      // contract result not found
      return null;
    }

    // The consensus timestamp of the block, with the nanoseconds part omitted.
    const timestamp = timestampRange.from.substring(0, timestampRange.from.indexOf('.'));
    if (showDetails && contractResults.length >= this.ethGetTransactionCountMaxBlockRange) {
      throw predefined.MAX_BLOCK_SIZE(blockResponse.count);
    }

    // prepare transactionArray
    let transactionArray: any[] = [];
    for (const contractResult of contractResults) {
      contractResult.from = await this.resolveEvmAddress(contractResult.from, requestIdPrefix, [
        constants.TYPE_ACCOUNT,
      ]);
      contractResult.to = await this.resolveEvmAddress(contractResult.to, requestIdPrefix);
      contractResult.chain_id = contractResult.chain_id || this.chain;

      transactionArray.push(showDetails ? formatContractResult(contractResult) : contractResult.hash);
    }

    transactionArray = this.populateSyntheticTransactions(showDetails, logs, transactionArray, requestIdPrefix);

    const blockHash = toHash32(blockResponse.hash);
    return new Block({
      baseFeePerGas: await this.gasPrice(requestIdPrefix),
      difficulty: EthImpl.zeroHex,
      extraData: EthImpl.emptyHex,
      gasLimit: numberTo0x(maxGasLimit),
      gasUsed: numberTo0x(gasUsed),
      hash: blockHash,
      logsBloom: blockResponse.logs_bloom === EthImpl.emptyHex ? EthImpl.emptyBloom : blockResponse.logs_bloom,
      miner: EthImpl.zeroAddressHex,
      mixHash: EthImpl.zeroHex32Byte,
      nonce: EthImpl.zeroHex8Byte,
      number: numberTo0x(blockResponse.number),
      parentHash: blockResponse.previous_hash.substring(0, 66),
      receiptsRoot: EthImpl.zeroHex32Byte,
      timestamp: numberTo0x(Number(timestamp)),
      sha3Uncles: EthImpl.emptyArrayHex,
      size: numberTo0x(blockResponse.size | 0),
      stateRoot: EthImpl.zeroHex32Byte,
      totalDifficulty: EthImpl.zeroHex,
      transactions: transactionArray,
      transactionsRoot: transactionArray.length == 0 ? EthImpl.ethEmptyTrie : blockHash,
      uncles: [],
    });
  }

  private createTransactionFromLog(log: Log): Transaction1559 {
    return new Transaction1559({
      accessList: undefined, // we don't support access lists for now
      blockHash: log.blockHash,
      blockNumber: log.blockNumber,
      chainId: this.chain,
      from: log.address,
      gas: EthImpl.defaultTxGas,
      gasPrice: EthImpl.invalidEVMInstruction,
      hash: log.transactionHash,
      input: EthImpl.zeroHex8Byte,
      maxPriorityFeePerGas: EthImpl.zeroHex,
      maxFeePerGas: EthImpl.zeroHex,
      nonce: nanOrNumberTo0x(0),
      r: EthImpl.zeroHex,
      s: EthImpl.zeroHex,
      to: log.address,
      transactionIndex: log.transactionIndex,
      type: EthImpl.twoHex, // 0x0 for legacy transactions, 0x1 for access list types, 0x2 for dynamic fees.
      v: EthImpl.zeroHex,
      value: EthImpl.oneTwoThreeFourHex,
    });
  }

  private static getTransactionCountFromBlockResponse(block: any): null | string {
    if (block === null || block.count === undefined) {
      // block not found
      return null;
    }

    return numberTo0x(block.count);
  }

  private async getAccountLatestEthereumNonce(address: string, requestId?: string): Promise<string> {
    let accountData = await this.mirrorNodeClient.getAccount(address, requestId);
    if (accountData) {
      // with HIP 729 ethereum_nonce should always be 0+ and null. Historical contracts may have a null value as the nonce was not tracked, return default EVM compliant 0x1 in this case
      let accountNonce = accountData.ethereum_nonce !== null ? numberTo0x(accountData.ethereum_nonce) : EthImpl.oneHex;
      if (this.previousAccount === address && this.previousAccountNonce === Number(accountNonce)) {
        while (this.previousAccount === address && this.previousAccountNonce === Number(accountNonce)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          accountData = await this.mirrorNodeClient.getAccount(address, requestId);
          accountNonce = accountData.ethereum_nonce !== null ? numberTo0x(accountData.ethereum_nonce) : EthImpl.oneHex;
        }
        return accountNonce;
      }
      this.previousAccountNonce = Number(accountNonce);
      this.previousAccount = address;
      return accountNonce;
    }

    return EthImpl.zeroHex;
  }

  /**
   * Returns the number of transactions sent from an address by searching for the ethereum transaction involving the address
   * Remove when https://github.com/hashgraph/hedera-mirror-node/issues/5862 is implemented
   *
   * @param address string
   * @param blockNumOrHash
   * @param requestIdPrefix
   * @returns string
   */
  private async getAcccountNonceFromContractResult(
    address: string,
    blockNumOrHash: any,
    requestIdPrefix: string | undefined,
  ): Promise<string> {
    // get block timestamp for blockNum
    const block = await this.mirrorNodeClient.getBlock(blockNumOrHash, requestIdPrefix); // consider caching error responses
    if (block == null) {
      throw predefined.UNKNOWN_BLOCK();
    }

    // get the latest 2 ethereum transactions for the account
    const ethereumTransactions = await this.mirrorNodeClient.getAccountLatestEthereumTransactionsByTimestamp(
      address,
      block.timestamp.to,
      2,
      requestIdPrefix,
    );
    if (ethereumTransactions == null || ethereumTransactions.transactions.length === 0) {
      return EthImpl.zeroHex;
    }

    // if only 1 transaction is returned when asking for 2, then the account has only sent 1 transaction
    // minor optimization to save a call to getContractResult as many accounts serve a single use
    if (ethereumTransactions.transactions.length === 1) {
      return EthImpl.oneHex;
    }

    // get the transaction result for the latest transaction
    const transactionResult = await this.mirrorNodeClient.getContractResult(
      ethereumTransactions.transactions[0].transaction_id,
      requestIdPrefix,
    );
    if (transactionResult == null) {
      throw predefined.RESOURCE_NOT_FOUND(
        `Failed to retrieve contract results for transaction ${ethereumTransactions.transactions[0].transaction_id}`,
      );
    }

    const accountResult = await this.mirrorNodeClient.getAccount(transactionResult.from);

    if (accountResult.evm_address !== address.toLowerCase()) {
      this.logger.warn(
        `${requestIdPrefix} eth_transactionCount for a historical block was requested where address: ${address} was not sender: ${transactionResult.address}, returning latest value as best effort.`,
      );
      return await this.getAccountLatestEthereumNonce(address, requestIdPrefix);
    }

    return numberTo0x(transactionResult.nonce + 1); // nonce is 0 indexed
  }

  private async getAccountNonceForEarliestBlock(requestIdPrefix?: string): Promise<string> {
    const block = await this.mirrorNodeClient.getEarliestBlock(requestIdPrefix);
    if (block == null) {
      throw predefined.INTERNAL_ERROR('No network blocks found');
    }

    if (block.number <= 1) {
      // if the earliest block is the genesis block or 1 , then the nonce is 0 as only system accounts are present
      return EthImpl.zeroHex;
    }

    // note the mirror node may be a partial one, in which case there may be a valid block with number greater 1.
    throw predefined.INTERNAL_ERROR(`Partial mirror node encountered, earliest block number is ${block.number}`);
  }

  private async getAccountNonceForHistoricBlock(
    address: string,
    blockNumOrHash: number | string,
    requestIdPrefix?: string,
  ): Promise<string> {
    let getBlock;
    const isParamBlockNum = typeof blockNumOrHash === 'number' ? true : false;

    if (isParamBlockNum && (blockNumOrHash as number) < 0) {
      throw predefined.UNKNOWN_BLOCK();
    }

    if (!isParamBlockNum) {
      getBlock = await this.mirrorNodeClient.getBlock(blockNumOrHash);
    }

    const blockNum = isParamBlockNum ? blockNumOrHash : getBlock.number;

    // check if on latest block, if so get latest ethereumNonce from mirror node account API
    const blockResponse = await this.mirrorNodeClient.getLatestBlock(requestIdPrefix); // consider caching error responses
    if (blockResponse == null || blockResponse.blocks.length === 0) {
      throw predefined.UNKNOWN_BLOCK();
    }

    if (blockResponse.blocks[0].number - blockNum <= this.maxBlockRange) {
      return this.getAccountLatestEthereumNonce(address, requestIdPrefix);
    }

    // if valid block number, get block timestamp
    return await this.getAcccountNonceFromContractResult(address, blockNum, requestIdPrefix);
  }

  async getLogs(
    blockHash: string | null,
    fromBlock: string | 'latest',
    toBlock: string | 'latest',
    address: string | string[] | null,
    topics: any[] | null,
    requestIdPrefix?: string,
  ): Promise<Log[]> {
    return this.common.getLogs(blockHash, fromBlock, toBlock, address, topics, requestIdPrefix);
  }

  async maxPriorityFeePerGas(requestIdPrefix?: string): Promise<string> {
    this.logger.trace(`${requestIdPrefix} maxPriorityFeePerGas()`);
    return EthImpl.zeroHex;
  }

  static isArrayNonEmpty(input: any): boolean {
    return Array.isArray(input) && input.length > 0;
  }

  /**************************************************
   * Returns the difference between the balance of  *
   * the account and the transactions summed up     *
   * to the block number queried.                   *
   *************************************************/
  getBalanceAtBlockTimestamp(account: string, transactions: any[], blockTimestamp: number) {
    return transactions
      .filter((transaction) => {
        return transaction.consensus_timestamp >= blockTimestamp;
      })
      .flatMap((transaction) => {
        return transaction.transfers.filter((transfer) => {
          return transfer.account === account && !transfer.is_approval;
        });
      })
      .map((transfer) => {
        return transfer.amount;
      })
      .reduce((total, amount) => {
        return total + amount;
      }, 0);
  }
}
