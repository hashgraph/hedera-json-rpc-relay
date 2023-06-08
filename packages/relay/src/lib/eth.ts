/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { Hbar, EthereumTransaction } from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import {BigNumber as BN} from "bignumber.js";
import { Logger } from 'pino';
import { Block, Transaction, Log } from './model';
import { MirrorNodeClient } from './clients';
import { JsonRpcError, predefined } from './errors/JsonRpcError';
import { SDKClientError } from './errors/SDKClientError';
import { MirrorNodeClientError } from './errors/MirrorNodeClientError';
import constants from './constants';
import { Precheck } from './precheck';
import { formatRequestIdMessage } from '../formatters';
import crypto from 'crypto';
import HAPIService from './services/hapiService/hapiService';
import {Counter, Registry} from "prom-client";

const LRU = require('lru-cache');
const _ = require('lodash');
const createHash = require('keccak');
const asm = require('@ethersproject/asm');
interface LatestBlockNumberTimestamp {
  blockNumber: string;
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
  static zeroHex8Byte = '0x0000000000000000';
  static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
  static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  static zeroAddressHex = '0x0000000000000000000000000000000000000000';
  static emptyBloom = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  static defaultTxGas = EthImpl.numberTo0x(constants.TX_DEFAULT_GAS_DEFAULT);
  static gasTxBaseCost = EthImpl.numberTo0x(constants.TX_BASE_COST);
  static gasTxHollowAccountCreation = EthImpl.numberTo0x(constants.TX_HOLLOW_ACCOUNT_CREATION_GAS);
  static ethTxType = 'EthereumTransaction';
  static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  static defaultGasUsedRatio = 0.5;
  static feeHistoryZeroBlockCountResponse = { gasUsedRatio: null, oldestBlock: EthImpl.zeroHex };
  static feeHistoryEmptyResponse = { baseFeePerGas: [], gasUsedRatio: [], reward: [], oldestBlock: EthImpl.zeroHex };
  static redirectBytecodePrefix = '6080604052348015600f57600080fd5b506000610167905077618dc65e';
  static redirectBytecodePostfix = '600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033';
  static iHTSAddress = '0x0000000000000000000000000000000000000167';
  static invalidEVMInstruction = '0xfe';

  // endpoint metric callerNames
  static ethCall = 'eth_call';
  static ethEstimateGas = 'eth_estimateGas';
  static ethGasPrice = 'eth_gasPrice';
  static ethGetBalance = 'eth_getBalance';
  static ethGetCode = 'eth_getCode';
  static ethFeeHistory = 'eth_feeHistory';
  static ethGetTransactionCount = 'eth_getTransactionCount';
  static ethSendRawTransaction = 'eth_sendRawTransaction';

  // block constants
  static blockLatest = 'latest';
  static blockEarliest = 'earliest';
  static blockPending = 'pending';
  static blockSafe = 'safe';
  static blockFinalized = 'finalized';
  
  /**
   * Overrideable options used when initializing.
   *
   * @private
   */
  private readonly defaultGas = EthImpl.numberTo0x(Number.parseInt(process.env.TX_DEFAULT_GAS ?? constants.TX_DEFAULT_GAS_DEFAULT.toString()));
  private readonly ethCallCacheTtl = Number.parseInt(process.env.ETH_CALL_CACHE_TTL ?? constants.ETH_CALL_CACHE_TTL_DEFAULT.toString());
  private readonly ethBlockNumberCacheTtlMs = Number.parseInt(process.env.ETH_BLOCK_NUMBER_CACHE_TTL_MS ?? constants.ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT.toString());
  private readonly ethGetBalanceCacheTtlMs = Number.parseInt(process.env.ETH_GET_BALANCE_CACHE_TTL_MS ?? constants.ETH_GET_BALANCE_CACHE_TTL_MS_DEFAULT.toString());
  private readonly maxBlockRange = Number.parseInt(process.env.MAX_BLOCK_RANGE ?? constants.MAX_BLOCK_RANGE.toString());
  private readonly contractCallGasLimit = Number.parseInt(process.env.CONTRACT_CALL_GAS_LIMIT ?? constants.CONTRACT_CALL_GAS_LIMIT.toString());
  private readonly ethGetTransactionCountCacheTtl = Number.parseInt(process.env.ETH_GET_TRANSACTION_COUNT_CACHE_TTL ?? constants.ETH_GET_TRANSACTION_COUNT_CACHE_TTL.toString());
  private readonly ethGetTransactionCountMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE ?? constants.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE.toString());

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
  private readonly cache;

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
   * The counter used to track the number of active contract execution requests.
   * @private
   */
  private counter: Counter;

  /**
   * Create a new Eth implementation.
   * @param nodeClient
   * @param mirrorNodeClient
   * @param logger
   * @param chain
   */
  constructor(
    hapiService: HAPIService,
    mirrorNodeClient: MirrorNodeClient,
    logger: Logger,
    chain: string,
    registry: Registry,
    cache?
  ) {
    this.hapiService = hapiService;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chain;
    this.precheck = new Precheck(mirrorNodeClient, this.hapiService, logger, chain);
    this.cache = cache;
    if (!cache) this.cache = new LRU(this.options);

    this.counter = this.initCounter(registry);
  }

  private initCounter(register: Registry) {
    const metricCounterName = 'rpc_relay_eth_executions';
    register.removeSingleMetric(metricCounterName);
    return new Counter({
      name: metricCounterName,
      help: `Relay ${metricCounterName} function`,
      labelNames: ['method', 'function'],
      registers: [register]
    });
  }

  /**
   * This method is implemented to always return an empty array. This is in alignment
   * with the behavior of Infura.
   */
  accounts(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} accounts()`);
    return [];
  }


  private getEthFeeHistoryFixedFee() {
    if(process.env.ETH_FEE_HISTORY_FIXED === undefined) {
        return true;
    }
    return process.env.ETH_FEE_HISTORY_FIXED === "true";
  }

  /**
   * Gets the fee history.
   */
  async feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number> | null, requestId?: string) {
    const maxResults = Number(process.env.FEE_HISTORY_MAX_RESULTS) || constants.DEFAULT_FEE_HISTORY_MAX_RESULTS;

    const requestIdPrefix = formatRequestIdMessage(requestId);

    this.logger.trace(`${requestIdPrefix} feeHistory(blockCount=${blockCount}, newestBlock=${newestBlock}, rewardPercentiles=${rewardPercentiles})`);

    try {
      let newestBlockNumber;
      let latestBlockNumber;
      if(this.getEthFeeHistoryFixedFee()) {
        newestBlockNumber = (newestBlock == EthImpl.blockLatest || newestBlock == EthImpl.blockPending)
            ? await this.translateBlockTag(EthImpl.blockLatest, requestId)
            : await this.translateBlockTag(newestBlock, requestId);
      } else { // once we finish testing and refining Fixed Fee method, we can remove this else block to clean up code
        latestBlockNumber = await this.translateBlockTag(EthImpl.blockLatest, requestId);
        newestBlockNumber = (newestBlock == EthImpl.blockLatest || newestBlock == EthImpl.blockPending)
            ? latestBlockNumber
            : await this.translateBlockTag(newestBlock, requestId);

        if (newestBlockNumber > latestBlockNumber) {
          return predefined.REQUEST_BEYOND_HEAD_BLOCK(newestBlockNumber, latestBlockNumber);
        }
      }

      blockCount = blockCount > maxResults ? maxResults : blockCount;

      if (blockCount <= 0) {
        return EthImpl.feeHistoryZeroBlockCountResponse;
      }
      let feeHistory: object | undefined;

      if(this.getEthFeeHistoryFixedFee()) {

        let oldestBlock = newestBlockNumber - blockCount + 1;
        if(oldestBlock <= 0) {
          blockCount = 1;
          oldestBlock = 1;
        }
        const gasPriceFee = await this.gasPrice(requestId);
        feeHistory = this.getRepeatedFeeHistory(blockCount, oldestBlock, rewardPercentiles, gasPriceFee);

      } else { // once we finish testing and refining Fixed Fee method, we can remove this else block to clean up code

        const cacheKey = `${constants.CACHE_KEY.FEE_HISTORY}_${blockCount}_${newestBlock}_${rewardPercentiles?.join('')}`;
        feeHistory = this.cache.get(cacheKey);
        if (!feeHistory) {
          feeHistory = await this.getFeeHistory(blockCount, newestBlockNumber, latestBlockNumber, rewardPercentiles, requestId);
          if (newestBlock != EthImpl.blockLatest && newestBlock != EthImpl.blockPending) {
            this.logger.trace(`${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(feeHistory)} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
            this.cache.set(cacheKey, feeHistory);
          }
        }
      }

      return feeHistory;
    } catch (e) {
      this.logger.error(e, `${requestIdPrefix} Error constructing default feeHistory`);
      return EthImpl.feeHistoryEmptyResponse;
    }
  }

  private async getFeeByBlockNumber(blockNumber: number, requestId?: string): Promise<string> {
    let fee = 0;
    const requestIdPrefix = formatRequestIdMessage(requestId);
    try {
      const block = await this.mirrorNodeClient.getBlock(blockNumber, requestId);
      fee = await this.getFeeWeibars(EthImpl.ethFeeHistory, requestId, `lte:${block.timestamp.to}`);
    } catch (error) {
      this.logger.warn(error, `${requestIdPrefix} Fee history cannot retrieve block or fee. Returning ${fee} fee for block ${blockNumber}`);
    }

    return EthImpl.numberTo0x(fee);
  }

  private getRepeatedFeeHistory(blockCount: number, oldestBlockNumber: number, rewardPercentiles: Array<number> | null, fee: string) {
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;

    const feeHistory = {
      baseFeePerGas: Array(blockCount).fill(fee),
      gasUsedRatio: Array(blockCount).fill(EthImpl.defaultGasUsedRatio),
      oldestBlock: EthImpl.numberTo0x(oldestBlockNumber),
    };

    // next fee. Due to high block production rate and low fee change rate we add the next fee
    // since by the time a user utilizes the response there will be a next block likely with the same fee
    feeHistory.baseFeePerGas.push(fee);

    if (shouldIncludeRewards) {
      feeHistory['reward'] = Array(blockCount).fill(Array(rewardPercentiles.length).fill(EthImpl.zeroHex));
    }

    return feeHistory;
  }

  private async getFeeHistory(blockCount: number, newestBlockNumber: number, latestBlockNumber: number, rewardPercentiles: Array<number> | null, requestId?: string) {
    // include newest block number in the total block count
    const oldestBlockNumber = Math.max(0, newestBlockNumber - blockCount + 1);
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;
    const feeHistory = {
      baseFeePerGas: [] as string[],
      gasUsedRatio: [] as number[],
      oldestBlock: EthImpl.numberTo0x(oldestBlockNumber),
    };

    // get fees from oldest to newest blocks
    for (let blockNumber = oldestBlockNumber; blockNumber <= newestBlockNumber; blockNumber++) {
      const fee = await this.getFeeByBlockNumber(blockNumber, requestId);

      feeHistory.baseFeePerGas.push(fee);
      feeHistory.gasUsedRatio.push(EthImpl.defaultGasUsedRatio);
    }

    // get latest block fee
    let nextBaseFeePerGas = _.last(feeHistory.baseFeePerGas);

    if (latestBlockNumber > newestBlockNumber) {
      // get next block fee if the newest block is not the latest
      nextBaseFeePerGas = await this.getFeeByBlockNumber(newestBlockNumber + 1, requestId);
    }

    if (nextBaseFeePerGas) {
      feeHistory.baseFeePerGas.push(nextBaseFeePerGas);
    }

    if (shouldIncludeRewards) {
      feeHistory['reward'] = Array(blockCount).fill(Array(rewardPercentiles.length).fill(EthImpl.zeroHex));
    }

    return feeHistory;
  }

  private async getFeeWeibars(callerName: string, requestId?: string, timestamp?: string) {
    let networkFees;
    const requestIdPrefix = formatRequestIdMessage(requestId);
    try {
      networkFees = await this.mirrorNodeClient.getNetworkFees(timestamp,undefined, requestId);
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
            gas: await this.hapiService.getSDKClient().getTinyBarGasFee(callerName, requestId),
            'transaction_type': EthImpl.ethTxType
          }
        ]
      };
    }

    if (networkFees && Array.isArray(networkFees.fees)) {
      const txFee = networkFees.fees.find(({ transaction_type }) => transaction_type === EthImpl.ethTxType);
      if (txFee?.gas) {
        // convert tinyBars into weiBars
        const weibars = Hbar
          .fromTinybars(txFee.gas)
          .toTinybars()
          .multiply(constants.TINYBAR_TO_WEIBAR_COEF);

        return weibars.toNumber();
      }
    }

    throw predefined.COULD_NOT_ESTIMATE_GAS_PRICE;
  }

  /**
   * Gets the most recent block number.
   */
  async blockNumber(requestId?: string): Promise<string> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} blockNumber()`);

    // check for cached value
    const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;
    const blockNumberCached = this.cache.get(cacheKey);

    if(blockNumberCached) {
      this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(blockNumberCached)}`);
      return blockNumberCached;
    }

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestId);
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const currentBlock = EthImpl.numberTo0x(blocks[0].number);
      // save the latest block number in cache
      this.cache.set(cacheKey, currentBlock, { ttl: this.ethBlockNumberCacheTtlMs });
      this.logger.trace(`${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(currentBlock)} for ${this.ethBlockNumberCacheTtlMs} ms`);

      return currentBlock;
    }

    throw predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
  }

  /**
   * Gets the most recent block number and timestamp.to which represents the block finality.
   */
  async blockNumberTimestamp(requestId?: string): Promise<LatestBlockNumberTimestamp> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} blockNumber()`);

    const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestId);
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const currentBlock = EthImpl.numberTo0x(blocks[0].number);
      const timestamp = blocks[0].timestamp.to;
      const blockTimeStamp: LatestBlockNumberTimestamp = { blockNumber: currentBlock, timeStampTo: timestamp };
      // save the latest block number in cache
      this.cache.set(cacheKey, currentBlock, { ttl: this.ethBlockNumberCacheTtlMs });
      this.logger.trace(
        `${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(currentBlock)}:${JSON.stringify(timestamp)} for ${
          this.ethBlockNumberCacheTtlMs
        } ms`
      );

      return blockTimeStamp;
    }

    throw predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
  }

  /**
   * Gets the chain ID. This is a static value, in that it always returns
   * the same value. This can be specified via an environment variable
   * `CHAIN_ID`.
   */
  chainId(requestId?: string): string {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} chainId()`);
    return this.chain;
  }

  /**
   * Estimates the amount of gas to execute a call.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async estimateGas(transaction: any, _blockParam: string | null, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} estimateGas(transaction=${JSON.stringify(transaction)}, _blockParam=${_blockParam})`);

    if ("data" in transaction){
      this.counter.labels(EthImpl.ethEstimateGas, transaction.data.substring(0,10)).inc();
    }

    let gas = EthImpl.gasTxBaseCost;
    try {
      const contractCallResponse = await this.mirrorNodeClient.postContractCall({
        ...transaction,
        estimate: true
      }, requestId);
      if (contractCallResponse?.result) {
        // Workaround until mirror-node bugfix applied, currently mirror-node returns 21k for contract creation, which is wrong
        if (!transaction.to && transaction.data !== '0x') {
          gas = this.defaultGas;
        } else {
          gas = EthImpl.prepend0x(contractCallResponse.result);
        }
      }
    } catch (e: any) {
      this.logger.error(`${requestIdPrefix} Error raised while fetching estimateGas from mirror-node: ${JSON.stringify(e)}`);

      // Handle Simple Transaction and Hollow account creation
      if (transaction && transaction.to && (!transaction.data || transaction.data === '0x')){
        const value = Number(transaction.value);
        if (value > 0) {
          const accountCacheKey = `${constants.CACHE_KEY.ACCOUNT}_${transaction.to}`;
          let toAccount: object | null = this.cache.get(accountCacheKey);
          if (!toAccount) {
            toAccount = await this.mirrorNodeClient.getAccount(transaction.to, requestId);
          }

          // when account exists return default base gas, otherwise return the minimum amount of gas to create an account entity
          if (toAccount) {
            this.logger.trace(`${requestIdPrefix} caching ${accountCacheKey}:${JSON.stringify(toAccount)} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
            this.cache.set(accountCacheKey, toAccount);

            gas = EthImpl.gasTxBaseCost;
          } else {
            gas = EthImpl.gasTxHollowAccountCreation;
          }
        } else {
          return predefined.INVALID_PARAMETER(0, `Invalid 'value' field in transaction param. Value must be greater than 0`);
        }
      } else {
        // Handle Contract Call or Contract Create
        gas = this.defaultGas;
      }
    }
    this.logger.error(`${requestIdPrefix} Returning predefined gas: ${gas}`);

    return gas;
  }

  /**
   * Gets the current gas price of the network.
   */
  async gasPrice(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} gasPrice()`);
    try {
      let gasPrice: number | undefined = this.cache.get(constants.CACHE_KEY.GAS_PRICE);

      if (!gasPrice) {
        gasPrice = await this.getFeeWeibars(EthImpl.ethGasPrice, requestId);
        // fees should not change so often we are safe with 1 day instead of 1 hour
        this.logger.trace(`${requestIdPrefix} caching ${constants.CACHE_KEY.GAS_PRICE}:${gasPrice} for ${constants.CACHE_TTL.ONE_DAY} ms`);
        this.cache.set(constants.CACHE_KEY.GAS_PRICE, gasPrice, {ttl: constants.CACHE_TTL.ONE_DAY});
      }

      return EthImpl.numberTo0x(gasPrice);
    } catch (error) {
      throw this.genericErrorHandler(error, `${requestIdPrefix} Failed to retrieve gasPrice`);
    }
  }

  /**
   * Gets whether this "Ethereum client" is a miner. We don't mine, so this always returns false.
   */
  async mining(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} mining()`);
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async submitWork(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} submitWork()`);
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async syncing(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} syncing()`);
    return false;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockHashAndIndex(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getUncleByBlockHashAndIndex()`);
    return null;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockNumberAndIndex(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getUncleByBlockNumberAndIndex()`);
    return null;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockHash(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getUncleCountByBlockHash()`);
    return EthImpl.zeroHex;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockNumber(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getUncleCountByBlockNumber()`);
    return EthImpl.zeroHex;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async hashrate(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} hashrate()`);
    return EthImpl.zeroHex;
  }

  /**
   * Always returns UNSUPPORTED_METHOD error.
   */
  getWork(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getWork()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Unsupported methods always return UNSUPPORTED_METHOD error.
   */
  submitHashrate(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} submitHashrate()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  signTransaction(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} signTransaction()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  sign(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} sign()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  sendTransaction(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} sendTransaction()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  protocolVersion(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} protocolVersion()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  coinbase(requestId?: string): JsonRpcError {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} coinbase()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Gets the value from a storage position at the given Ethereum address.
   *
   * @param address
   * @param slot
   * @param blockNumberOrTag
   */
  async getStorageAt(address: string, slot: string, blockNumberOrTag?: string | null, requestId?: string) : Promise<string> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getStorageAt(address=${address}, slot=${slot}, blockNumberOrTag=${blockNumberOrTag})`);

    let result = EthImpl.zeroHex32Byte; // if contract or slot not found then return 32 byte 0

    const blockResponse  = await this.getHistoricalBlockResponse(blockNumberOrTag, false, requestId);
    // To save a request to the mirror node for `latest` and `pending` blocks, we directly return null from `getHistoricalBlockResponse`
    // But if a block number or `earliest` tag is passed and the mirror node returns `null`, we should throw an error.
    if (!EthImpl.blockTagIsLatestOrPending(blockNumberOrTag) && blockResponse == null) {
      throw predefined.RESOURCE_NOT_FOUND(`block '${blockNumberOrTag}'.`);
    }

    const blockEndTimestamp = blockResponse?.timestamp?.to;

    await this.mirrorNodeClient.getContractStateByAddressAndSlot(address, slot, blockEndTimestamp, requestId)
    .then(response => {
      if(response === null) {
        throw predefined.RESOURCE_NOT_FOUND(`Cannot find current state for contract address ${address} at slot=${slot}`);
      }
      if (response.state.length > 0) {
        result = response.state[0].value;
      }
    })
    .catch((error: any) => {
      throw this.genericErrorHandler(error, `${requestIdPrefix} Failed to retrieve current contract state for address ${address} at slot=${slot}`);
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
   * @param blockNumberOrTag
   */
  async getBalance(account: string, blockNumberOrTag: string | null, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const latestBlockTolerance = 1;
    this.logger.trace(`${requestIdPrefix} getBalance(account=${account}, blockNumberOrTag=${blockNumberOrTag})`);

    let latestBlock: LatestBlockNumberTimestamp | null | undefined;
    // this check is required, because some tools like Metamask pass for parameter latest block, with a number (ex 0x30ea)
    // tolerance is needed, because there is a small delay between requesting latest block from blockNumber and passing it here
    if (!EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
      const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;
      const blockNumberCached = this.cache.get(cacheKey);

      if(blockNumberCached) {
        this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(blockNumberCached)}`);
        latestBlock = { blockNumber: blockNumberCached, timeStampTo: '0' };

      } else {
        latestBlock = await this.blockNumberTimestamp(requestId);
      }
      const blockDiff = Number(latestBlock.blockNumber) - Number(blockNumberOrTag);

      if (blockDiff <= latestBlockTolerance) {
        blockNumberOrTag = EthImpl.blockLatest;
      }

      // If ever we get the latest block from cache, and blockNumberOrTag is not latest, then we need to get the block timestamp
      // This should rarely happen.
      if((blockNumberOrTag !== EthImpl.blockLatest) && (latestBlock.timeStampTo === "0")) {
        latestBlock = await this.blockNumberTimestamp(requestId);
      }
    }

    // check cache first
    // create a key for the cache
    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BALANCE}-${account}-${blockNumberOrTag}`;
    const cachedBalance = this.cache.get(cacheKey);
    if (cachedBalance) {
      this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(cachedBalance)}`);
      return cachedBalance;
    }

    let blockNumber = null;
    let balanceFound = false;
    let weibars: BigInt = BigInt(0);
    const mirrorAccount = await this.mirrorNodeClient.getAccountPageLimit(account, requestId);

    try {
      if (!EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
        const block = await this.getHistoricalBlockResponse(blockNumberOrTag, true, requestId);
        if (block) {
          blockNumber = block.number;

          // A blockNumberOrTag has been provided. If it is `latest` or `pending` retrieve the balance from /accounts/{account.id}
          if (mirrorAccount) {
            // If the parsed blockNumber is the same as the one from the latest block retrieve the balance from /accounts/{account.id}
            if (latestBlock && block.number !== latestBlock.blockNumber) {
              const latestTimestamp = Number(latestBlock.timeStampTo.split('.')[0]);
              const blockTimestamp = Number(block.timestamp.from.split('.')[0]);
              const timeDiff = latestTimestamp - blockTimestamp;
              // The block is from the last 15 minutes, therefore the historical balance hasn't been imported in the Mirror Node yet
              if (timeDiff < constants.BALANCES_UPDATE_INTERVAL) {
                let currentBalance = 0;
                let balanceFromTxs = 0;
                if (mirrorAccount.balance) {
                  currentBalance = mirrorAccount.balance.balance;
                }

                // The balance in the account is real time, so we simply subtract the transactions to the block.timestamp.to to get a block relevant balance.
                // needs to be updated below.
                const nextPage: string = mirrorAccount.links.next;

                if(nextPage) {
                  // If we have a pagination link that falls within the block.timestamp.to, we need to paginate to get the transactions for the block.timestamp.to
                  const nextPageParams = new URLSearchParams(nextPage.split('?')[1]);
                  const nextPageTimeMarker = nextPageParams.get('timestamp');
                  if (nextPageTimeMarker && nextPageTimeMarker?.split(':')[1] >= block.timestamp.to) {
                    // If nextPageTimeMarker is greater than the block.timestamp.to, then we need to paginate to get the transactions for the block.timestamp.to
                    const pagedTransactions = await this.mirrorNodeClient.getAccountPaginated(nextPage, requestId);
                    mirrorAccount.transactions = mirrorAccount.transactions.concat(pagedTransactions);
                  }
                  // If nextPageTimeMarker is less than the block.timestamp.to, then just run the getBalanceAtBlockTimestamp function in this case as well.
                }

                balanceFromTxs = this.getBalanceAtBlockTimestamp(
                  mirrorAccount.account,
                  mirrorAccount.transactions,
                  block.timestamp.to
                );

                balanceFound = true;
                weibars = BigInt(currentBalance - balanceFromTxs) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
              }

              // The block is NOT from the last 15 minutes, use /balances rest API
              else {
                const balance = await this.mirrorNodeClient.getBalanceAtTimestamp(
                  mirrorAccount.account,
                  block.timestamp.from,
                  requestId
                );
                balanceFound = true;
                if (balance.balances?.length) {
                  weibars = BigInt(balance.balances[0].balance) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
                }
              }
            }
          }
        }
      }

      if (!balanceFound && mirrorAccount?.balance) {
        balanceFound = true;
        weibars = BigInt(mirrorAccount.balance.balance) * BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
      }

      if (!balanceFound) {
        this.logger.debug(
          `${requestIdPrefix} Unable to find account ${account} in block ${JSON.stringify(
            blockNumber
          )}(${blockNumberOrTag}), returning 0x0 balance`
        );
        return EthImpl.zeroHex;
      }

      // save in cache the current balance for the account and blockNumberOrTag
      this.cache.set(cacheKey, EthImpl.numberTo0x(weibars), { ttl: this.ethGetBalanceCacheTtlMs });
      this.logger.trace(
        `${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(cachedBalance)} for ${
          this.ethGetBalanceCacheTtlMs
        } ms`
      );

      return EthImpl.numberTo0x(weibars);
    } catch (error: any) {
      throw this.genericErrorHandler(error, `${requestIdPrefix} Error raised during getBalance for account ${account}`);
    }
  }

  /**
   * Gets the smart contract code for the contract at the given Ethereum address.
   *
   * @param address
   * @param blockNumber
   */
  async getCode(address: string, blockNumber: string | null, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);

    // check for static precompile cases first before consulting nodes
    // this also account for environments where system entities were not yet exposed to the mirror node
    if (address === EthImpl.iHTSAddress) {
      this.logger.trace(`${requestIdPrefix} HTS precompile case, return ${EthImpl.invalidEVMInstruction} for byte code`);
      return EthImpl.invalidEVMInstruction;
    }

    this.logger.trace(`${requestIdPrefix} getCode(address=${address}, blockNumber=${blockNumber})`);

    const cachedLabel = `getCode.${address}.${blockNumber}`;
    const cachedResponse: string | undefined = this.cache.get(cachedLabel);
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    try {
      const result = await this.mirrorNodeClient.resolveEntityType(address, [constants.TYPE_CONTRACT, constants.TYPE_TOKEN], requestId);
      if (result) {
        if (result?.type === constants.TYPE_TOKEN) {
          this.logger.trace(`${requestIdPrefix} Token redirect case, return redirectBytecode`);
          return EthImpl.redirectBytecodeAddressReplace(address);
        } else if (result?.type === constants.TYPE_CONTRACT) {
          if (result?.entity.runtime_bytecode !== EthImpl.emptyHex) {
            const prohibitedOpcodes = ['CALLCODE', 'DELEGATECALL', 'SELFDESTRUCT', 'SUICIDE'];
            const opcodes = asm.disassemble(result?.entity.runtime_bytecode);
            const hasProhibitedOpcode = opcodes.filter(opcode => prohibitedOpcodes.indexOf(opcode.opcode.mnemonic) > -1).length > 0;
            if (!hasProhibitedOpcode) {
              this.cache.set(cachedLabel, result?.entity.runtime_bytecode);
              return result?.entity.runtime_bytecode;
            }
          }
        }
      }

      const bytecode = await this.hapiService.getSDKClient().getContractByteCode(0, 0, address, EthImpl.ethGetCode, requestId);
      return EthImpl.prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      if (e instanceof SDKClientError) {
        // handle INVALID_CONTRACT_ID or CONTRACT_DELETED
        if (e.isInvalidContractId() || e.isContractDeleted()) {
          this.logger.debug(`${requestIdPrefix} Unable to find code for contract ${address} in block "${blockNumber}", returning 0x0, err code: ${e.statusCode}`);
          this.cache.set(cachedLabel, EthImpl.emptyHex);
          return EthImpl.emptyHex;
        }

        this.hapiService.decrementErrorCounter(e.statusCode);
        this.logger.error(e, `${requestIdPrefix} Error raised during getCode for address ${address}, err code: ${e.statusCode}`);
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
   */
  async getBlockByHash(hash: string, showDetails: boolean, requestId?: string): Promise<Block | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockByHash(hash=${hash}, showDetails=${showDetails})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BLOCK_BY_HASH}_${hash}_${showDetails}`;
    let block = this.cache.get(cacheKey);
    if (!block) {
      block = await this.getBlock(hash, showDetails, requestId).catch((e: any) => {
        throw this.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
      });
      this.cache.set(cacheKey, block);
    }

    return block;
  }

  /**
   * Gets the block by its block number.
   * @param blockNumOrTag Possible values are earliest/pending/latest or hex, and can't be null (validator check).
   * @param showDetails
   */
  async getBlockByNumber(blockNumOrTag: string, showDetails: boolean, requestId?: string): Promise<Block | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockByNumber(blockNum=${blockNumOrTag}, showDetails=${showDetails})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_BLOCK_BY_NUMBER}_${blockNumOrTag}_${showDetails}`;
    let block = this.cache.get(cacheKey);
    if (!block) {
      block = await this.getBlock(blockNumOrTag, showDetails, requestId).catch((e: any) => {
        throw this.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNumOrTag}`);
      });

      if (blockNumOrTag != EthImpl.blockLatest && blockNumOrTag != EthImpl.blockPending) {
        this.logger.trace(`${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(block)} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
        this.cache.set(cacheKey, block);
      }
    }

    return block;
  }

  /**
   * Gets the number of transaction in a block by its block hash.
   *
   * @param hash
   */
  async getBlockTransactionCountByHash(hash: string, requestId?: string): Promise<string | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByHash(hash=${hash}, showDetails=%o)`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_COUNT_BY_HASH}_${hash}`;
    let cachedResponse = this.cache.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`${requestIdPrefix} getBlockTransactionCountByHash returned cached response: ${cachedResponse}`);
      return cachedResponse;
    }

    const transactionCount = await this.mirrorNodeClient
      .getBlock(hash, requestId)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        throw this.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
      });

    this.cache.set(cacheKey, transactionCount);
    return transactionCount;
  }

  /**
   * Gets the number of transaction in a block by its block number.
   * @param blockNumOrTag
   */
  async getBlockTransactionCountByNumber(blockNumOrTag: string, requestId?: string): Promise<string | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByNumber(blockNum=${blockNumOrTag}, showDetails=%o)`);
    const blockNum = await this.translateBlockTag(blockNumOrTag, requestId);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_COUNT_BY_NUMBER}_${blockNum}`;
    let cachedResponse = this.cache.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`${requestIdPrefix} getBlockTransactionCountByNumber returned cached response: ${cachedResponse}`);
      return cachedResponse;
    }

    const transactionCount = await this.mirrorNodeClient
      .getBlock(blockNum, requestId)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        throw this.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNum}`);
      });

    this.cache.set(cacheKey, transactionCount);
    return transactionCount;
  }

  /**
   * Gets the transaction in a block by its block hash and transactions index.
   *
   * @param blockHash
   * @param transactionIndex
   */
  async getTransactionByBlockHashAndIndex(blockHash: string, transactionIndex: string, requestId?: string): Promise<Transaction | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionByBlockHashAndIndex(hash=${blockHash}, index=${transactionIndex})`);
    return this.mirrorNodeClient
      .getContractResults({ blockHash: blockHash, transactionIndex: Number(transactionIndex) }, undefined, requestId)
      .then((contractResults) => this.getTransactionFromContractResults(contractResults, requestId))
      .catch((error: any) => {
        throw this.genericErrorHandler(error, `${requestIdPrefix} Failed to retrieve contract result for blockHash ${blockHash} and index=${transactionIndex}`);
      });
  }

  /**
   * Gets the transaction in a block by its block hash and transactions index.
   *
   * @param blockNumOrTag
   * @param transactionIndex
   */
  async getTransactionByBlockNumberAndIndex(
    blockNumOrTag: string,
    transactionIndex: string,
    requestId?: string
  ): Promise<Transaction | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionByBlockNumberAndIndex(blockNum=${blockNumOrTag}, index=${transactionIndex})`);
    const blockNum = await this.translateBlockTag(blockNumOrTag, requestId);
    return this.mirrorNodeClient
      .getContractResults({ blockNumber: blockNum, transactionIndex: Number(transactionIndex) }, undefined, requestId)
      .then((contractResults) => this.getTransactionFromContractResults(contractResults, requestId))
      .catch((e: any) => {
        throw this.genericErrorHandler(e, `${requestIdPrefix} Failed to retrieve contract result for blockNum ${blockNum} and index=${transactionIndex}`);
      });
  }

  /**
   * Gets the number of transactions that have been executed for the given address.
   * This goes to the consensus nodes to determine the ethereumNonce.
   *
   * Queries mirror node for best effort and fallsback to consensus node for contracts until HIP 729 is implemented.
   *
   * @param address
   * @param blockNumOrTag
   */
  async getTransactionCount(address: string, blockNumOrTag: string | null, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionCount(address=${address}, blockNumOrTag=${blockNumOrTag})`);

    // cache considerations for high load
    const cacheKey = `eth_getTransactionCount_${address}_${blockNumOrTag}`;
    let nonceCount = this.cache.get(cacheKey);
    if (nonceCount) {
      this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(nonceCount)}`);
      return nonceCount;
    }

    const blockNum = Number(blockNumOrTag);
    if (blockNumOrTag) {
      if (blockNum === 0 || blockNum === 1) { // previewnet and testnet bug have a genesis blockNumber of 1 but non system account were yet to be created
        return EthImpl.zeroHex;
      } else if (EthImpl.blockTagIsLatestOrPending(blockNumOrTag)) {
        // if latest or pending, get latest ethereumNonce from mirror node account API
        nonceCount = await this.getAccountLatestEthereumNonce(address, requestId);
      } else if (blockNumOrTag === EthImpl.blockEarliest) {
        const block = await this.mirrorNodeClient.getEarliestBlock(requestId);
        if (block == null) {
          throw predefined.INTERNAL_ERROR('No network blocks found');
        }

        if (block.number <= 1) {
          // if the earliest block is the genesis block or 1 , then the nonce is 0 as only system accounts are present
          return EthImpl.zeroHex;
        } 
        
        // note the mirror node may be a partial one, in which case there may be a valid block with number greater 1.
        throw predefined.INTERNAL_ERROR(`Partial mirror node encountered, earliest block number is ${block.number}`);        
      } else if (!isNaN(blockNum)) {
        const contract = await this.mirrorNodeClient.isValidContract(address, requestId);
        if (contract) {
          // historical contract nonces unsupported until HIP 729 and mirror node historical account info is implemented
          this.logger.warn(`${requestIdPrefix} retrieval of unsupported historical contract account nonces: ${address}`);
          return EthImpl.zeroHex;
        }

        // if valid block number, get block timestamp
        nonceCount = await this.getAcccountNonceFromContractResult(address, blockNum, requestId);
      } else {
        // return a '-39001: Unknown block' error per api-spec
        return predefined.UNKNOWN_BLOCK;
      }
    } else {
      // if no block consideration, get latest ethereumNonce from mirror node if account or from concensus node is contract until HIP 729 is implemented
      nonceCount = await this.getAccountLatestEthereumNonce(address, requestId);
    }

    this.logger.trace(`${requestIdPrefix} caching ${cacheKey}:${nonceCount} for ${this.ethGetTransactionCountCacheTtl} ms`);
    const cacheTtl = blockNumOrTag === EthImpl.blockEarliest || !isNaN(blockNum) ? constants.CACHE_TTL.ONE_DAY : this.ethGetTransactionCountCacheTtl; // cache historical values longer as they don't change
    this.cache.set(cacheKey, nonceCount, { ttl: cacheTtl }); 
    return nonceCount;
  }

  /**
   * Submits a transaction to the network for execution.
   *
   * @param transaction
   */
  async sendRawTransaction(transaction: string, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.counter.labels(EthImpl.ethSendRawTransaction, transaction.substring(0,10)).inc();

    let interactingEntity = '';
    let originatingAddress = '';
    try {
      const parsedTx = Precheck.parseTxIfNeeded(transaction);
      interactingEntity = parsedTx.to ? parsedTx.to.toString() : '';
      originatingAddress = parsedTx.from ? parsedTx.from.toString() : '';
      this.logger.trace(`${requestIdPrefix} sendRawTransaction(from=${originatingAddress}, to=${interactingEntity}, transaction=${transaction})`);

      const gasPrice = Number(await this.gasPrice(requestId));
      await this.precheck.sendRawTransactionCheck(parsedTx, gasPrice, requestId);
    } catch (e: any) {
      this.logger.warn(`${requestIdPrefix} Error on precheck sendRawTransaction(from=${originatingAddress}, to=${interactingEntity}, transaction=${transaction})`);
      throw this.genericErrorHandler(e);
    }

    const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction), 'hex');
    try {
      const contractExecuteResponse = await this.hapiService.getSDKClient().submitEthereumTransaction(transactionBuffer, EthImpl.ethSendRawTransaction, requestId);

      try {
        // Wait for the record from the execution.
        const record = await this.hapiService.getSDKClient().executeGetTransactionRecord(contractExecuteResponse, EthereumTransaction.name, EthImpl.ethSendRawTransaction, interactingEntity, requestId);
        if (!record) {
          this.logger.warn(`${requestIdPrefix} No record retrieved`);
          throw predefined.INTERNAL_ERROR();
        }

        if (record.ethereumHash == null) {
          this.logger.error(`${requestIdPrefix} The ethereumHash can never be null for an ethereum transaction, and yet it was!!`);
          throw predefined.INTERNAL_ERROR();
        }

        return  EthImpl.prepend0x(Buffer.from(record.ethereumHash).toString('hex'));
      } catch (e) {

        await this.mirrorNodeClient.getContractRevertReasonFromTransaction(e, requestId, requestIdPrefix);

        this.logger.error(e,
          `${requestIdPrefix} Failed sendRawTransaction during record retrieval for transaction ${transaction}, returning computed hash`);
        //Return computed hash if unable to retrieve EthereumHash from record due to error
        return EthImpl.prepend0x(createHash('keccak256').update(transactionBuffer).digest('hex'));
      }
    } catch (e: any) {
      this.logger.error(e,
        `${requestIdPrefix} Failed to successfully submit sendRawTransaction for transaction ${transaction}`);
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
   * Execute a free contract call query.
   *
   * @param call
   * @param blockParam
   */
  async call(call: any, blockParam: string | null, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} call(hash=${JSON.stringify(call)}, blockParam=${blockParam})`, call, blockParam);

    if ("data" in call){
      this.counter.labels(EthImpl.ethCall, call.data.substring(0,10)).inc();
    }
    
    const to = await this.performCallChecks(call, blockParam, requestId);

    // Get a reasonable value for "gas" if it is not specified.
    const gas = this.getCappedBlockGasLimit(call.gas, requestId);
    const value: string | null = EthImpl.toNullableBigNumber(call.value);
    
    try {
      // ETH_CALL_DEFAULT_TO_CONSENSUS_NODE = false enables the use of Mirror node
      if ((process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE === 'undefined') || (process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE == 'false')) {
        //temporary workaround until precompiles are implemented in Mirror node evm module
        // Execute the call and get the response
        return await this.callMirrorNode(call, to, gas, value, requestId);
      }
      
      return await this.callConsensusNode(call, gas, requestId);
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Failed to successfully submit eth_call`);
      if (e instanceof JsonRpcError) {
        return e;
      }
      return predefined.INTERNAL_ERROR(e.message.toString());
    }
  }

  async callMirrorNode(call: any, to: any, gas: number, value: string | null, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    try {
      if (to?.type === constants.TYPE_CONTRACT && to?.entity.runtime_bytecode === EthImpl.emptyHex) {
        this.logger.trace(`${requestIdPrefix} Contract runtime_bytecode equals to 0x and mirror-node will return 0x as well, retrying with consensus node`);
        throw new MirrorNodeClientError({ message: "Empty Response" }, MirrorNodeClientError.statusCodes.NO_CONTENT);
      }

      this.logger.debug(`${requestIdPrefix} Making eth_call on contract ${call.to} with gas ${gas} and call data "${call.data}" from "${call.from}" using mirror-node.`, call.to, gas, call.data, call.from);
      const callData = {
        ...call,
        gas,
        value,
        estimate: false
      };

      const contractCallResponse = await this.mirrorNodeClient.postContractCall(callData, requestId);
      return contractCallResponse?.result ? EthImpl.prepend0x(contractCallResponse.result) : EthImpl.emptyHex;
    } catch (e: any) {
      if (e instanceof JsonRpcError) {
        return e;
      }

      if (e instanceof MirrorNodeClientError) {
        if (e.isRateLimit()) {
          return predefined.IP_RATE_LIMIT_EXCEEDED(e.errorMessage || `Rate limit exceeded on ${EthImpl.ethCall}`);
        }

        if (e.isContractReverted()) {
          return predefined.CONTRACT_REVERT(e.errorMessage);
        }

        // Temporary workaround until mirror node web3 module implements the support of precompiles
        // If mirror node throws, rerun eth_call and force it to go through the Consensus network
        if (e.isNotSupported() || e.isNotSupportedSystemContractOperaton()) {
          const errorTypeMessage = e.isNotSupported() || e.isNotSupportedSystemContractOperaton() ? 'Unsupported' : 'Unhandled';
          this.logger.trace(`${requestIdPrefix} ${errorTypeMessage} mirror node eth_call request, retrying with consensus node`);
          return await this.callConsensusNode(call, gas, requestId);
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
   * @param requestId
   */
  async callConsensusNode(call: any, gas: number, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    // Execute the call and get the response
    this.logger.debug(`${requestIdPrefix} Making eth_call on contract ${call.to} with gas ${gas} and call data "${call.data}" from "${call.from}" using consensus-node.`, call.to, gas, call.data, call.from);
    
    try {
      let data = call.data;
      if (data) {
        data = crypto.createHash('sha1').update(call.data).digest('hex'); // NOSONAR
      }

      const cacheKey = `${constants.CACHE_KEY.ETH_CALL}:.${call.to}.${data}`;
      const cachedResponse = this.cache.get(cacheKey);

      if (cachedResponse != undefined) {
        this.logger.debug(`${requestIdPrefix} eth_call returned cached response: ${cachedResponse}`);
        return cachedResponse;
      }

      const contractCallResponse = await this.hapiService.getSDKClient().submitContractCallQueryWithRetry(call.to, call.data, gas, call.from, EthImpl.ethCall, requestId);
      if (contractCallResponse) {
        const formattedCallReponse = EthImpl.prepend0x(Buffer.from(contractCallResponse.asBytes()).toString('hex'));

        this.cache.set(cacheKey, formattedCallReponse, { ttl: this.ethCallCacheTtl });
        return formattedCallReponse;
      }

      return predefined.INTERNAL_ERROR(`Invalid contractCallResponse from consensus-node: ${JSON.stringify(contractCallResponse)}`);
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
   * @param requestId
   */
  async performCallChecks(call: any, blockParam: string | null, requestId?: string) {
    // The "to" address must always be 42 chars.
    if (!call.to || call.to.length != 42) {
      throw predefined.INVALID_CONTRACT_ADDRESS(call.to);
    }

    // If "From" is distinct from blank, we check is a valid account
    if (call.from) {
      const fromEntityType = await this.mirrorNodeClient.resolveEntityType(call.from, [constants.TYPE_ACCOUNT], requestId);
      if (fromEntityType?.type !== constants.TYPE_ACCOUNT) {
        throw predefined.NON_EXISTING_ACCOUNT(call.from);
      }
    }

    // verify gas is withing the allowed range
    if (call.gas && call.gas > this.contractCallGasLimit) {
      throw predefined.GAS_LIMIT_TOO_HIGH(call.gas, constants.BLOCK_GAS_LIMIT);
    }

    // verify blockParam
    await this.performCallBlockParamChecks(blockParam, requestId);

    // Check "To" is a valid Contract or HTS Address
    const toEntityType = await this.mirrorNodeClient.resolveEntityType(call.to, [constants.TYPE_TOKEN, constants.TYPE_CONTRACT], requestId);
    if(!(toEntityType?.type === constants.TYPE_CONTRACT || toEntityType?.type === constants.TYPE_TOKEN)) {
      throw predefined.NON_EXISTING_CONTRACT(call.to);
    }

    return toEntityType;
  }

  async performCallBlockParamChecks(blockParam: string | null, requestId?: string) {
    if (!blockParam) {
      return;
    }

    // verify blockParam formats for a valid block number
    if (EthImpl.isBlockHash(blockParam)) {
      throw predefined.UNSUPPORTED_OPERATION(`BlockParam: ${blockParam} is not a supported eth_call block identifier`);
    }

    if (EthImpl.blockTagIsEarliest(blockParam)) {
      throw predefined.UNSUPPORTED_HISTORICAL_EXECUTION(blockParam);
    }
    
    // numerical block number considerations
    const blockNum = Number(blockParam);
    if (!isNaN(blockNum) && !EthImpl.blockTagIsFinalized(blockParam)) {
      if (blockNum === 0 || blockNum === 1) {
        throw predefined.UNSUPPORTED_HISTORICAL_EXECUTION(blockNum.toString());
      }

      const block = await this.mirrorNodeClient.getLatestBlock(requestId);
      if(!block) {
        throw predefined.RESOURCE_NOT_FOUND(`unable to retrieve latest block from mirror node`);
      }

      const trailingBlockCount = block.number - blockNum;
      if(trailingBlockCount > this.maxBlockRange) {
        this.logger.warn(`${formatRequestIdMessage(requestId)} referenced block '${blockParam}' trails latest by ${trailingBlockCount}, max trailing count is ${this.maxBlockRange}. Throwable UNSUPPORTED_HISTORICAL_EXECUTION scenario.`);
      }   
    }
  }

  /**
   * Gets a transaction by the provided hash
   *
   * @param hash
   */
  async getTransactionByHash(hash: string, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionByHash(hash=${hash})`, hash);
    const contractResult = await this.mirrorNodeClient.getContractResultWithRetry(hash, requestId);
    if (contractResult === null || contractResult.hash === undefined) {
      return null;
    }

    if (!contractResult.block_number || (!contractResult.transaction_index && contractResult.transaction_index !== 0)) {
      this.logger.warn(`${requestIdPrefix} getTransactionByHash(hash=${hash}) mirror-node returned status 200 with missing properties in contract_results - block_number==${contractResult.block_number} and transaction_index==${contractResult.transaction_index}`);
    }

    let fromAddress;
    if (contractResult.from) {
      fromAddress = contractResult.from.substring(0, 42);

      const accountCacheKey = `${constants.CACHE_KEY.ACCOUNT}_${fromAddress}`;
      let accountResult: any | null = this.cache.get(accountCacheKey);
      if (!accountResult) {
        accountResult = await this.mirrorNodeClient.getAccount(fromAddress, requestId);
        if (accountResult) {
          this.logger.trace(`${requestIdPrefix} caching ${accountCacheKey}:${JSON.stringify(accountResult)} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
          this.cache.set(accountCacheKey, accountResult);
        }
      }

      if (accountResult?.evm_address?.length > 0) {
        fromAddress = accountResult.evm_address.substring(0,42);
      }
    }

    const maxPriorityFee = contractResult.max_priority_fee_per_gas === EthImpl.emptyHex ? undefined : contractResult.max_priority_fee_per_gas;
    const maxFee = contractResult.max_fee_per_gas === EthImpl.emptyHex ? undefined : contractResult.max_fee_per_gas;
    const rSig = contractResult.r === null ? null : contractResult.r.substring(0, 66);
    const sSig = contractResult.s === null ? null : contractResult.s.substring(0, 66);

    if (process.env.DEV_MODE && process.env.DEV_MODE === 'true' && contractResult.result === 'CONTRACT_REVERT_EXECUTED') {
      const err = predefined.CONTRACT_REVERT(contractResult.error_message);
      throw err;
    }

    return new Transaction({
      accessList: undefined, // we don't support access lists, so punt for now
      blockHash: EthImpl.toHash32(contractResult.block_hash),
      blockNumber: EthImpl.nullableNumberTo0x(contractResult.block_number),
      chainId: contractResult.chain_id,
      from: fromAddress,
      gas: EthImpl.nanOrNumberTo0x(contractResult.gas_used),
      gasPrice: EthImpl.toNullIfEmptyHex(contractResult.gas_price),
      hash: contractResult.hash.substring(0, 66),
      input: contractResult.function_parameters,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFee,
      nonce: EthImpl.nanOrNumberTo0x(contractResult.nonce),
      r: rSig,
      s: sSig,
      to: contractResult.to?.substring(0, 42),
      transactionIndex: EthImpl.nullableNumberTo0x(contractResult.transaction_index),
      type: EthImpl.nullableNumberTo0x(contractResult.type),
      v: EthImpl.nanOrNumberTo0x(contractResult.v),
      value: EthImpl.nanOrNumberTo0x(contractResult.amount),
    });
  }

  /**
   * Gets a receipt for a transaction that has already executed.
   *
   * @param hash
   */
  async getTransactionReceipt(hash: string, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionReceipt(${hash})`);

    const cacheKey = `${constants.CACHE_KEY.ETH_GET_TRANSACTION_RECEIPT}_${hash}`;
    let cachedResponse = this.cache.get(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`${requestIdPrefix} getTransactionReceipt returned cached response: ${cachedResponse}`);
      return cachedResponse;
    }

    const receiptResponse = await this.mirrorNodeClient.getContractResultWithRetry(hash, requestId);
    if (receiptResponse === null || receiptResponse.hash === undefined) {
      this.logger.trace(`${requestIdPrefix} no receipt for ${hash}`);
      // block not found
      return null;
    } else {
      const effectiveGas =
        receiptResponse.max_fee_per_gas === undefined || receiptResponse.max_fee_per_gas == '0x'
          ? receiptResponse.gas_price
          : receiptResponse.max_fee_per_gas;

      // support stricter go-eth client which requires the transaction hash property on logs
      const logs = receiptResponse.logs.map(log => {
        return new Log({
          address: log.address,
          blockHash: EthImpl.toHash32(receiptResponse.block_hash),
          blockNumber: EthImpl.numberTo0x(receiptResponse.block_number),
          data: log.data,
          logIndex: EthImpl.numberTo0x(log.index),
          removed: false,
          topics: log.topics,
          transactionHash: EthImpl.toHash32(receiptResponse.hash),
          transactionIndex: EthImpl.nullableNumberTo0x(receiptResponse.transaction_index)
        });
      });

      const receipt: any = {
        blockHash: EthImpl.toHash32(receiptResponse.block_hash),
        blockNumber: EthImpl.numberTo0x(receiptResponse.block_number),
        from: receiptResponse.from,
        to: receiptResponse.to,
        cumulativeGasUsed: EthImpl.numberTo0x(receiptResponse.block_gas_used),
        gasUsed: EthImpl.nanOrNumberTo0x(receiptResponse.gas_used),
        contractAddress: receiptResponse.address,
        logs: logs,
        logsBloom: receiptResponse.bloom === EthImpl.emptyHex ? EthImpl.emptyBloom : receiptResponse.bloom,
        transactionHash: EthImpl.toHash32(receiptResponse.hash),
        transactionIndex: EthImpl.nullableNumberTo0x(receiptResponse.transaction_index),
        effectiveGasPrice: EthImpl.nanOrNumberTo0x(Number.parseInt(effectiveGas) * 10_000_000_000),
        root: receiptResponse.root,
        status: receiptResponse.status,
      };

      if (receiptResponse.error_message) {
        receipt.revertReason = receiptResponse.error_message;
      }

      this.logger.trace(`${requestIdPrefix} receipt for ${hash} found in block ${receipt.blockNumber}`);

      this.cache.set(cacheKey, receipt);
      return receipt;
    }
  }

  /**
   * Internal helper method that prepends a leading 0x if there isn't one.
   * @param input
   * @private
   */
  static prepend0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex) ? input : EthImpl.emptyHex + input;
  }

  static numberTo0x(input: number | BigNumber | BigInt): string {
    return EthImpl.emptyHex + input.toString(16);
  }

  static nullableNumberTo0x(input: number | BigNumber): string | null {
    return input == null ? null : EthImpl.numberTo0x(input);
  }

  static nanOrNumberTo0x(input: number | BigNumber): string {
    // input == null assures to check against both null and undefined.
    // A reliable way for ECMAScript code to test if a value X is a NaN is an expression of the form X !== X.
    // The result will be true if and only if X is a NaN.
    return input == null || input !== input ? EthImpl.numberTo0x(0) : EthImpl.numberTo0x(input);
  }

  static toHash32(value: string): string {
    return value.substring(0, 66);
  }

  static toNullableBigNumber(value: string): string | null {
    if (typeof value === 'string') {
      return (new BN(value)).toString();
    }

    return null;
  }

  private static toNullIfEmptyHex(value: string): string | null {
    return value === EthImpl.emptyHex ? null : value;
  }

  private static redirectBytecodeAddressReplace(address: string): string {
    return `${this.redirectBytecodePrefix}${address.slice(2)}${this.redirectBytecodePostfix}`;
  }

  /**
   * Internal helper method that removes the leading 0x if there is one.
   * @param input
   * @private
   */
  private static prune0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex) ? input.substring(2) : input;
  }

  private static blockTagIsLatestOrPending = (tag) => {
    return tag == null || tag === EthImpl.blockLatest || tag === EthImpl.blockPending;
  };

  private static blockTagIsEarliest = (tag) => {
    return tag === EthImpl.blockEarliest;
  };

  private static blockTagIsFinalized = (tag) => {
    return tag === EthImpl.blockFinalized || tag === EthImpl.blockLatest || tag === EthImpl.blockPending || tag === EthImpl.blockSafe;
  };

  private static isBlockHash = (blockHash) => {
    return new RegExp(constants.BLOCK_HASH_REGEX + '{64}$').test(blockHash);
  };   

  /**
   * Translates a block tag into a number. 'latest', 'pending', and null are the
   * most recent block, 'earliest' is 0, numbers become numbers.
   *
   * @param tag null, a number, or 'latest', 'pending', or 'earliest'
   * @private
   */
  private async translateBlockTag(tag: string | null, requestId?: string): Promise<number> {
    if (EthImpl.blockTagIsLatestOrPending(tag)) {
      return Number(await this.blockNumber(requestId));
    } else if (tag === EthImpl.blockEarliest) {
      return 0;
    } else {
      return Number(tag);
    }
  }

  private getCappedBlockGasLimit(gasString: string, requestIdPrefix?: string): number {
    if (!gasString) {
      return Number.parseInt(this.defaultGas);
    }

    // Gas limit for `eth_call` is 50_000_000, but the current Hedera network limit is 15_000_000
    // With values over the gas limit, the call will fail with BUSY error so we cap it at 15_000_000
    let gas = Number.parseInt(gasString);
    if (gas > constants.BLOCK_GAS_LIMIT) {
      this.logger.trace(`${requestIdPrefix} eth_call gas amount (${gas}) exceeds network limit, capping gas to ${constants.BLOCK_GAS_LIMIT}`);
      return constants.BLOCK_GAS_LIMIT;
    }

    return gas;
  }

  /**
   * Gets the block with the given hash.
   * Given an ethereum transaction hash, call the mirror node to get the block info.
   * Then using the block timerange get all contract results to get transaction details.
   * If showDetails is set to true subsequently call mirror node for additional transaction details
   *
   * @param blockHashOrNumber
   * @param showDetails
   */
  private async getBlock(blockHashOrNumber: string, showDetails: boolean, requestId?: string ): Promise<Block | null> {
    const blockResponse = await this.getHistoricalBlockResponse(blockHashOrNumber, true, requestId);

    if (blockResponse == null) return null;

    const timestampRange = blockResponse.timestamp;
    const timestampRangeParams = [`gte:${timestampRange.from}`, `lte:${timestampRange.to}`];
    const contractResults = await this.mirrorNodeClient.getContractResults({ timestamp: timestampRangeParams }, undefined, requestId);
    const maxGasLimit = constants.BLOCK_GAS_LIMIT;
    const gasUsed = blockResponse.gas_used;

    if (contractResults == null) {
      // contract result not found
      return null;
    }

    // The consensus timestamp of the block, with the nanoseconds part omitted.
    const timestamp = timestampRange.from.substring(0, timestampRange.from.indexOf('.'));
    const transactionObjects: Transaction[] = [];
    const transactionHashes: string[] = [];

    for (const result of contractResults) {
      // depending on stage of contract execution revert the result.to value may be null
      if (!_.isNil(result.to)) {
        if(showDetails) {
          const transaction = await this.getTransactionFromContractResult(result.to, result.timestamp, requestId);
          if (transaction !== null) {
            transactionObjects.push(transaction);
          }
        } else {
          transactionHashes.push(result.hash);
        }
      }
    }

    const blockHash = EthImpl.toHash32(blockResponse.hash);
    const transactionArray = showDetails ? transactionObjects : transactionHashes;
    return new Block({
      baseFeePerGas: await this.gasPrice(requestId),
      difficulty: EthImpl.zeroHex,
      extraData: EthImpl.emptyHex,
      gasLimit: EthImpl.numberTo0x(maxGasLimit),
      gasUsed: EthImpl.numberTo0x(gasUsed),
      hash: blockHash,
      logsBloom: EthImpl.emptyBloom, //TODO calculate full block boom in mirror node
      miner: EthImpl.zeroAddressHex,
      mixHash: EthImpl.zeroHex32Byte,
      nonce: EthImpl.zeroHex8Byte,
      number: EthImpl.numberTo0x(blockResponse.number),
      parentHash: blockResponse.previous_hash.substring(0, 66),
      receiptsRoot: EthImpl.zeroHex32Byte,
      timestamp: EthImpl.numberTo0x(Number(timestamp)),
      sha3Uncles: EthImpl.emptyArrayHex,
      size: EthImpl.numberTo0x(blockResponse.size | 0),
      stateRoot: EthImpl.zeroHex32Byte,
      totalDifficulty: EthImpl.zeroHex,
      transactions: transactionArray,
      transactionsRoot: transactionArray.length == 0 ? EthImpl.ethEmptyTrie : blockHash,
      uncles: [],
    });
  }

  /**
   * returns the block response
   * otherwise return undefined.
   *
   * @param blockNumberOrTag
   * @param returnLatest
   */
  private async getHistoricalBlockResponse(blockNumberOrTag?: string | null, returnLatest?: boolean, requestId?: string | undefined): Promise<any | null> {
    if (!returnLatest && EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
      return null;
    }
  
    const blockNumber = Number(blockNumberOrTag);
    if (blockNumberOrTag != null && blockNumberOrTag.length < 32 && !isNaN(blockNumber)) {
      const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestId);
      const latestBlock = latestBlockResponse.blocks[0];
      if (blockNumber > latestBlock.number + this.maxBlockRange) {
        return null;
      }
    }
  
    if (blockNumberOrTag == null || EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
      const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestId);
      return latestBlockResponse.blocks[0];
    }
  
    if (blockNumberOrTag == EthImpl.blockEarliest) {
      return await this.mirrorNodeClient.getBlock(0, requestId);
    }
  
    if (blockNumberOrTag.length < 32) {
      return await this.mirrorNodeClient.getBlock(Number(blockNumberOrTag), requestId);
    }
  
    return await this.mirrorNodeClient.getBlock(blockNumberOrTag, requestId);
  }
  

  private static getTransactionCountFromBlockResponse(block: any) {
    if (block === null || block.count === undefined) {
      // block not found
      return null;
    }

    return EthImpl.numberTo0x(block.count);
  }

  private getTransactionFromContractResults(contractResults: any, requestId?: string) {
    if (!contractResults || contractResults.length == 0) {
      // contract result not found
      return null;
    }

    const contractResult = contractResults[0];

    return this.getTransactionFromContractResult(contractResult.to, contractResult.timestamp, requestId);
  }

  private async getTransactionFromContractResult(to: string, timestamp: string, requestId?: string): Promise<Transaction | null> {
    // call mirror node by id and timestamp for further details
    const requestIdPrefix = formatRequestIdMessage(requestId);
    return this.mirrorNodeClient.getContractResultsByAddressAndTimestamp(to, timestamp, requestId)
      .then(contractResultDetails => {
        // 404 is allowed return code so it's possible for contractResultDetails to be null
        if (contractResultDetails == null) {
          return null;
        } else {
          const rSig = contractResultDetails.r === null ? null : contractResultDetails.r.substring(0, 66);
          const sSig = contractResultDetails.s === null ? null : contractResultDetails.s.substring(0, 66);
          return new Transaction({
            accessList: undefined, // we don't support access lists for now, so punt
            blockHash: EthImpl.toHash32(contractResultDetails.block_hash),
            blockNumber: EthImpl.numberTo0x(contractResultDetails.block_number),
            chainId: contractResultDetails.chain_id,
            from: contractResultDetails.from.substring(0, 42),
            gas: EthImpl.nanOrNumberTo0x(contractResultDetails.gas_used),
            gasPrice: EthImpl.toNullIfEmptyHex(contractResultDetails.gas_price),
            hash: contractResultDetails.hash.substring(0, 66),
            input: contractResultDetails.function_parameters,
            maxPriorityFeePerGas: EthImpl.toNullIfEmptyHex(contractResultDetails.max_priority_fee_per_gas),
            maxFeePerGas: EthImpl.toNullIfEmptyHex(contractResultDetails.max_fee_per_gas),
            nonce: EthImpl.nanOrNumberTo0x(contractResultDetails.nonce),
            r: rSig,
            s: sSig,
            to: contractResultDetails.to.substring(0, 42),
            transactionIndex: EthImpl.nullableNumberTo0x(contractResultDetails.transaction_index),
            type: EthImpl.nullableNumberTo0x(contractResultDetails.type),
            v: EthImpl.nanOrNumberTo0x(contractResultDetails.v),
            value: EthImpl.nanOrNumberTo0x(contractResultDetails.amount),
          });
        }
      })
      .catch((e: any) => {
        this.logger.error(
          e,
          `${requestIdPrefix} Failed to retrieve contract result details for contract address ${to} at timestamp=${timestamp}`
        );
        throw predefined.INTERNAL_ERROR(e.message.toString());
      });
  }

  private async validateBlockHashAndAddTimestampToParams(params: any, blockHash: string, requestId?: string) {
    try {
      const block = await this.mirrorNodeClient.getBlock(blockHash, requestId);
      if (block) {
        params.timestamp = [
          `gte:${block.timestamp.from}`,
          `lte:${block.timestamp.to}`
        ];
      } else {
        return false;
      }
    }
    catch(e: any) {
      if (e instanceof MirrorNodeClientError && e.isNotFound()) {
        return false;
      }

      throw e;
    }

    return true;
  }

  private async validateBlockRangeAndAddTimestampToParams(params: any, fromBlock: string | 'latest', toBlock: string | 'latest', requestId?: string) {
    const blockRangeLimit = Number(process.env.ETH_GET_LOGS_BLOCK_RANGE_LIMIT) || constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT;

    if (EthImpl.blockTagIsLatestOrPending(toBlock)) {
      toBlock = EthImpl.blockLatest;
    }

    // toBlock is a number and is less than the current block number and fromBlock is not defined
    if (Number(toBlock) < Number(await this.blockNumber(requestId)) && !fromBlock) {
      throw predefined.MISSING_FROM_BLOCK_PARAM;
    }

    if (EthImpl.blockTagIsLatestOrPending(fromBlock)) {
      fromBlock = EthImpl.blockLatest;
    }

    let fromBlockNum = 0;
    let toBlockNum;
    params.timestamp = [];

    const fromBlockResponse = await this.getHistoricalBlockResponse(fromBlock, true, requestId);
    if (!fromBlockResponse) {
      return false;
    }

    params.timestamp.push(`gte:${fromBlockResponse.timestamp.from}`);

    if (fromBlock === toBlock) {
      params.timestamp.push(`lte:${fromBlockResponse.timestamp.to}`);
    }
    else {
      fromBlockNum = parseInt(fromBlockResponse.number);
      const toBlockResponse = await this.getHistoricalBlockResponse(toBlock, true, requestId);
      if (toBlockResponse != null) {
        params.timestamp.push(`lte:${toBlockResponse.timestamp.to}`);
        toBlockNum = parseInt(toBlockResponse.number);
      }

      if (fromBlockNum > toBlockNum) {
        return false;
      } else if (toBlockNum - fromBlockNum > blockRangeLimit) {
        throw predefined.RANGE_TOO_LARGE(blockRangeLimit);
      }
    }

    return true;
  }

  private addTopicsToParams(params: any, topics: any[] | null) {
    if (topics) {
      for (let i = 0; i < topics.length; i++) {
        if (!_.isNil(topics[i])) {
          params[`topic${i}`] = topics[i];
        }
      }
    }
  }

  private async getLogsByAddress(address: string | [string], params: any, requestId) {
    const addresses = Array.isArray(address) ? address : [address];
    const logPromises = addresses.map(addr => this.mirrorNodeClient.getContractResultsLogsByAddress(addr, params, undefined, requestId));

    const logResults = await Promise.all(logPromises);
    const logs = logResults.flatMap(logResult => logResult ? logResult : [] );
    logs.sort((a: any, b: any) => {
      return a.timestamp >= b.timestamp ? 1 : -1;
    });

    return logs;
  }

  private async getAccountLatestEthereumNonce(address: string, requestId?: string) {
    // check if address is a valid contract then get ethereumNonce from consensus node until HIP 729 is implemented
    const validContract = await this.mirrorNodeClient.isValidContract(address, requestId);
    if (validContract)  {
      return EthImpl.oneHex;
    } 
    
    // get latest ethereumNonce from mirror node account API
    const mirrorAccount = await this.mirrorNodeClient.getAccount(address, requestId);
    if (mirrorAccount && mirrorAccount.ethereum_nonce) {
      return EthImpl.numberTo0x(mirrorAccount.ethereum_nonce);
    }

    return EthImpl.zeroHex;
  }

  /**
   * Returns the number of transactions sent from an address by searching for the ethereum transaction involving the address
   * Remove when https://github.com/hashgraph/hedera-mirror-node/issues/5862 is implemented
   * 
   * @param address string
   * @param blockNum string
   * @param requestId string
   * @returns string
   */
  private async getAcccountNonceFromContractResult(address: string, blockNum: any, requestId: string | undefined) {
    // get block timestamp for blockNum
    const block = await this.mirrorNodeClient.getBlock(blockNum, requestId); // consider caching error responses
    if (block == null) {
      throw predefined.UNKNOWN_BLOCK;
    }  

    // get the latest 2 ethereum transactions for the account
    let ethereumTransactions = await this.mirrorNodeClient.getAccountLatestEthereumTransactionsByTimestamp(address, block.timestamp.to, 2, requestId);
    if (ethereumTransactions == null || ethereumTransactions.transactions.length === 0) {
      return EthImpl.zeroHex;
    }

    // if only 1 transaction is returned when asking for 2, then the account has only sent 1 transaction
    // minor optimization to save a call to getContractResult as many accounts serve a single use
    if (ethereumTransactions.transactions.length === 1) {
      return EthImpl.oneHex;
    }

    // get the transaction result for the latest transaction
    const transactionResult = await this.mirrorNodeClient.getContractResult(ethereumTransactions.transactions[0].transaction_id, requestId);
    if (transactionResult == null) {
      throw predefined.RESOURCE_NOT_FOUND(`Failed to retrieve contract results for transaction ${ethereumTransactions.transactions[0].transaction_id}`);
    }

    return EthImpl.numberTo0x(transactionResult.nonce + 1); // nonce is 0 indexed
  }

  async getLogs(blockHash: string | null, fromBlock: string | 'latest', toBlock: string | 'latest', address: string | [string] | null, topics: any[] | null, requestId?: string): Promise<Log[]> {
    const EMPTY_RESPONSE = [];
    const params: any = {};

    if (blockHash) {
      if ( !(await this.validateBlockHashAndAddTimestampToParams(params, blockHash, requestId)) ) {
        return EMPTY_RESPONSE;
      }
    } else if ( !(await this.validateBlockRangeAndAddTimestampToParams(params, fromBlock, toBlock, requestId)) ) {
      return EMPTY_RESPONSE;
    }

    this.addTopicsToParams(params, topics);

    let logResults;
    if (address) {
      logResults = await this.getLogsByAddress(address, params, requestId);
    }
    else {
      logResults = await this.mirrorNodeClient.getContractResultsLogs(params, undefined, requestId);
    }

    if (!logResults) {
      return EMPTY_RESPONSE;
    }

    const logs: Log[] = [];
    for(const log of logResults) {
      logs.push(
        new Log({
          address: log.address,
          blockHash: EthImpl.toHash32(log.block_hash),
          blockNumber: EthImpl.numberTo0x(log.block_number),
          data: log.data,
          logIndex: EthImpl.nullableNumberTo0x(log.index),
          removed: false,
          topics: log.topics,
          transactionHash: EthImpl.toHash32(log.transaction_hash),
          transactionIndex: EthImpl.nullableNumberTo0x(log.transaction_index)
        })
      );
    }

    return logs;
  }

  async maxPriorityFeePerGas(requestId?: string): Promise<string> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} maxPriorityFeePerGas()`);
    return EthImpl.zeroHex;
  }

  static isArrayNonEmpty(input: any): boolean {
    return Array.isArray(input) && input.length > 0;
  }

  genericErrorHandler(error: any, logMessage?: string) {
    if (logMessage) {
      this.logger.error(error, logMessage);
    }
    else {
      this.logger.error(error);
    }

    if (error instanceof SDKClientError && error.isGrpcTimeout()) {
      throw predefined.REQUEST_TIMEOUT;
    }

    if (error instanceof JsonRpcError) {
      throw error;
    }
    return predefined.INTERNAL_ERROR(error.message.toString());
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
