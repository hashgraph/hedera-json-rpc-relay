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

import { Eth } from '../index';
import { ContractId, Hbar, EthereumTransaction } from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from 'pino';
import { Block, Transaction, Log } from './model';
import { MirrorNodeClient, SDKClient } from './clients';
import { JsonRpcError, predefined } from './errors/JsonRpcError';
import { SDKClientError } from './errors/SDKClientError';
import { MirrorNodeClientError } from './errors/MirrorNodeClientError';
import constants from './constants';
import { Precheck } from './precheck';
import { formatRequestIdMessage } from '../formatters';

const _ = require('lodash');
const cache = require('js-cache');
const createHash = require('keccak');

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
  static zeroHex8Byte = '0x0000000000000000';
  static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
  static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  static zeroAddressHex = '0x0000000000000000000000000000000000000000';
  static emptyBloom = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  static defaultGas = EthImpl.numberTo0x(constants.TX_DEFAULT_GAS);
  static gasTxBaseCost = EthImpl.numberTo0x(constants.TX_BASE_COST);
  static ethTxType = 'EthereumTransaction';
  static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  static defaultGasUsedRatio = EthImpl.numberTo0x(0.5);
  static feeHistoryZeroBlockCountResponse = { gasUsedRatio: null, oldestBlock: EthImpl.zeroHex };
  static feeHistoryEmptyResponse = { baseFeePerGas: [], gasUsedRatio: [], reward: [], oldestBlock: EthImpl.zeroHex };
  static redirectBytecodePrefix = '6080604052348015600f57600080fd5b506000610167905077618dc65e';
  static redirectBytecodePostfix = '600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033';
  static iHTSAddress = '0x0000000000000000000000000000000000000167';
  static invalidEVMInstruction = '0xfe';

  // endpoint metric callerNames
  static ethCall = 'eth_call';
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

  /**
   * The sdk client use for connecting to both the consensus nodes and mirror node. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private readonly sdkClient: SDKClient;

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
   * Create a new Eth implementation.
   * @param nodeClient
   * @param mirrorNodeClient
   * @param logger
   * @param chain
   */
  constructor(
    nodeClient: SDKClient,
    mirrorNodeClient: MirrorNodeClient,
    logger: Logger,
    chain: string
  ) {
    this.sdkClient = nodeClient;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chain;
    this.precheck = new Precheck(mirrorNodeClient, nodeClient, logger, chain);
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

  /**
   * Gets the fee history.
   */
  async feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number> | null, requestId?: string) {
    const maxResults = Number(process.env.FEE_HISTORY_MAX_RESULTS) || constants.DEFAULT_FEE_HISTORY_MAX_RESULTS;

    const requestIdPrefix = formatRequestIdMessage(requestId);

    this.logger.trace(`${requestIdPrefix} feeHistory(blockCount=${blockCount}, newestBlock=${newestBlock}, rewardPercentiles=${rewardPercentiles})`);

    try {
      const latestBlockNumber = await this.translateBlockTag(EthImpl.blockLatest, requestId);
      const newestBlockNumber = await this.translateBlockTag(newestBlock, requestId);

      if (newestBlockNumber > latestBlockNumber) {
        return predefined.REQUEST_BEYOND_HEAD_BLOCK(newestBlockNumber, latestBlockNumber);
      }

      blockCount = blockCount > maxResults ? maxResults : blockCount;

      if (blockCount <= 0) {
        return EthImpl.feeHistoryZeroBlockCountResponse;
      }

      let feeHistory: object | undefined = cache.get(constants.CACHE_KEY.FEE_HISTORY);
      if (!feeHistory) {

        feeHistory = await this.getFeeHistory(blockCount, newestBlockNumber, latestBlockNumber, rewardPercentiles, requestId);

        this.logger.trace(`${requestIdPrefix} caching ${constants.CACHE_KEY.FEE_HISTORY} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
        cache.set(constants.CACHE_KEY.FEE_HISTORY, feeHistory, constants.CACHE_TTL.ONE_HOUR);
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

  private async getFeeHistory(blockCount: number, newestBlockNumber: number, latestBlockNumber: number, rewardPercentiles: Array<number> | null, requestId?: string) {
    // include newest block number in the total block count
    const oldestBlockNumber = Math.max(0, newestBlockNumber - blockCount + 1);
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;
    const feeHistory = {
      baseFeePerGas: [] as string[],
      gasUsedRatio: [] as string[],
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
            gas: await this.sdkClient.getTinyBarGasFee(callerName, requestId),
            'transaction_type': EthImpl.ethTxType
          }
        ]
      };
    }

    if (networkFees && Array.isArray(networkFees.fees)) {
      const txFee = networkFees.fees.find(({ transaction_type }) => transaction_type === EthImpl.ethTxType);
      if (txFee && txFee.gas) {
        // convert tinyBars into weiBars
        const weibars = Hbar
          .fromTinybars(txFee.gas)
          .toTinybars()
          .multiply(constants.TINYBAR_TO_WEIBAR_COEF);

        return weibars.toNumber();
      }
    }

    throw new Error('Error encountered estimating the gas price');
  }

  /**
   * Gets the most recent block number.
   */
  async blockNumber(requestId?: string): Promise<string> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} blockNumber()`);

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestId);
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      return EthImpl.numberTo0x(blocks[0].number);
    }

    throw new Error(`Error encountered retrieving latest block`);
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
    this.logger.trace(`${requestIdPrefix} estimateGas()`);
    if (!transaction || !transaction.data || transaction.data === '0x') {
      return EthImpl.gasTxBaseCost;
    } else {
      return EthImpl.defaultGas;
    }
  }

  /**
   * Gets the current gas price of the network.
   */
  async gasPrice(requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} gasPrice()`);
    try {
      let gasPrice: number | undefined = cache.get(constants.CACHE_KEY.GAS_PRICE);

      if (!gasPrice) {
        gasPrice = await this.getFeeWeibars(EthImpl.ethGasPrice, requestId);

        this.logger.trace(`${requestIdPrefix} caching ${constants.CACHE_KEY.GAS_PRICE} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
        cache.set(constants.CACHE_KEY.GAS_PRICE, gasPrice, constants.CACHE_TTL.ONE_HOUR);
      }

      return EthImpl.numberTo0x(gasPrice);
    } catch (error) {
      this.logger.error(error, `${requestIdPrefix} Failed to retrieve gasPrice`);
      throw error;
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
    let result = EthImpl.zeroHex32Byte; // if contract or slot not found then return 32 byte 0
    const blockResponse  = await this.getHistoricalBlockResponse(blockNumberOrTag, false);

    // To save a request to the mirror node for `latest` and `pending` blocks, we directly return null from `getHistoricalBlockResponse`
    // But if a block number or `earliest` tag is passed and the mirror node returns `null`, we should throw an error.
    if(!EthImpl.blockTagIsLatestOrPending(blockNumberOrTag) && blockResponse == null) {
      throw predefined.RESOURCE_NOT_FOUND(`block '${blockNumberOrTag}'.`);
    }

    const blockEndTimestamp = blockResponse?.timestamp?.to;
    const contractResult = await this.mirrorNodeClient.getLatestContractResultsByAddress(address, blockEndTimestamp, 1);

    if (contractResult?.results?.length > 0) {
      // retrieve the contract result details
      await this.mirrorNodeClient.getContractResultsDetails(address, contractResult.results[0].timestamp)
        .then(contractResultDetails => {
          if(contractResultDetails?.state_changes != null) {
            // filter the state changes to match slot and return value
            const stateChange = contractResultDetails.state_changes.find(stateChange => stateChange.slot === slot);
            result = stateChange.value_written;
          } else {
            throw predefined.RESOURCE_NOT_FOUND(`Contract result details for contract address ${address} at timestamp=${contractResult.results[0].timestamp}`);
          }
        })
        .catch((e: any) => {
          this.logger.error(
            e,
            `${requestIdPrefix} Failed to retrieve contract result details for contract address ${address} at timestamp=${contractResult.results[0].timestamp}`,
          );

          throw e;
        });
    }

    return result;
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
    this.logger.trace(`${requestIdPrefix} getBalance(account=${account}, blockNumberOrTag=${blockNumberOrTag})`);

    // Cache is only set for `not found` balances
    const cachedLabel = `getBalance.${account}.${blockNumberOrTag}`;
    const cachedResponse: string | undefined = cache.get(cachedLabel);
    if (cachedResponse != undefined) {
      return cachedResponse;
    }
    let blockNumber = null;
    let balanceFound = false;
    let weibars: BigNumber | number = 0;
    const mirrorAccount = await this.mirrorNodeClient.getAccount(account, requestId);

    try {
      if (!EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
        const block = await this.getHistoricalBlockResponse(blockNumberOrTag, true, requestId);
        if (block) {
          blockNumber = block.number;

          // A blockNumberOrTag has been provided. If it is `latest` or `pending` retrieve the balance from /accounts/{account.id}
          if (mirrorAccount) {
            const latestBlock = await this.getHistoricalBlockResponse(EthImpl.blockLatest, true, requestId);

            // If the parsed blockNumber is the same as the one from the latest block retrieve the balance from /accounts/{account.id}
            if (latestBlock && block.number !== latestBlock.number) {
              const latestTimestamp = Number(latestBlock.timestamp.from.split('.')[0]);
              const blockTimestamp = Number(block.timestamp.from.split('.')[0]);
              const timeDiff = latestTimestamp - blockTimestamp;

              // The block is from the last 15 minutes, therefore the historical balance hasn't been imported in the Mirror Node yet
              if (timeDiff < constants.BALANCES_UPDATE_INTERVAL) {
                throw predefined.UNKNOWN_HISTORICAL_BALANCE;
              }

              // The block is NOT from the last 15 minutes, use /balances rest API
              else {
                const balance = await this.mirrorNodeClient.getBalanceAtTimestamp(mirrorAccount.account, block.timestamp.from, requestId);
                balanceFound = true;
                if (balance.balances?.length) {
                  weibars = balance.balances[0].balance * constants.TINYBAR_TO_WEIBAR_COEF;
                }
              }
            }
          }
        }
      }

      if (!balanceFound && mirrorAccount?.balance) {
        balanceFound = true;
        weibars = mirrorAccount.balance.balance * constants.TINYBAR_TO_WEIBAR_COEF;
      }

      if (!balanceFound) {
        this.logger.debug(`${requestIdPrefix} Unable to find account ${account} in block ${JSON.stringify(blockNumber)}(${blockNumberOrTag}), returning 0x0 balance`);
        cache.set(cachedLabel, EthImpl.zeroHex, constants.CACHE_TTL.ONE_HOUR);
        return EthImpl.zeroHex;
      }

      return EthImpl.numberTo0x(weibars);
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Error raised during getBalance for account ${account}`);
      throw e;
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
    // this also account for environments where system entitites were not yet exposed to the mirror node
    if (address === EthImpl.iHTSAddress) {
      this.logger.trace(`${requestIdPrefix} HTS precompile case, return ${EthImpl.invalidEVMInstruction} for byte code`);
      return EthImpl.invalidEVMInstruction;
    }

    this.logger.trace(`${requestIdPrefix} getCode(address=${address}, blockNumber=${blockNumber})`);

    const cachedLabel = `getCode.${address}.${blockNumber}`;
    const cachedResponse: string | undefined = cache.get(cachedLabel);
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    try {
      const result = await this.mirrorNodeClient.resolveEntityType(address, requestId);
      if (result) {
        if (result?.type === constants.TYPE_TOKEN) {
          this.logger.trace(`${requestIdPrefix} Token redirect case, return redirectBytecode`);
          return EthImpl.redirectBytecodeAddressReplace(address);
        }
        else if (result?.type === constants.TYPE_CONTRACT) {
          if (result?.entity.runtime_bytecode !== EthImpl.emptyHex) {
              return result?.entity.runtime_bytecode;
          }
        }
      }

      const bytecode = await this.sdkClient.getContractByteCode(0, 0, address, EthImpl.ethGetCode, requestId);
      return EthImpl.prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      if(e instanceof SDKClientError) {
        // handle INVALID_CONTRACT_ID
        if (e.isInvalidContractId()) {
          this.logger.debug(`${requestIdPrefix} Unable to find code for contract ${address} in block "${blockNumber}", returning 0x0, err code: ${e.statusCode}`);
          cache.set(cachedLabel, EthImpl.emptyHex, constants.CACHE_TTL.ONE_HOUR);
          return EthImpl.emptyHex;
        }
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
    return this.getBlock(hash, showDetails, requestId).catch((e: any) => {
      this.logger.error(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
      throw predefined.INTERNAL_ERROR(e.message);
    });
  }

  /**
   * Gets the block by its block number.
   * @param blockNumOrTag
   * @param showDetails
   */
  async getBlockByNumber(blockNumOrTag: string, showDetails: boolean, requestId?: string): Promise<Block | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockByNumber(blockNum=${blockNumOrTag}, showDetails=${showDetails})`);
    return this.getBlock(blockNumOrTag, showDetails, requestId).catch((e: any) => {
      this.logger.error(e, `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNumOrTag}`);
      throw predefined.INTERNAL_ERROR(e.message);
    });
  }

  /**
   * Gets the number of transaction in a block by its block hash.
   *
   * @param hash
   */
  async getBlockTransactionCountByHash(hash: string, requestId?: string): Promise<string | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByHash(hash=${hash}, showDetails=%o)`);
    return this.mirrorNodeClient
      .getBlock(hash, requestId)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        this.logger.error(e, `${requestIdPrefix} Failed to retrieve block for hash ${hash}`);
        throw predefined.INTERNAL_ERROR(e.message);
      });
  }

  /**
   * Gets the number of transaction in a block by its block number.
   * @param blockNumOrTag
   */
  async getBlockTransactionCountByNumber(blockNumOrTag: string, requestId?: string): Promise<string | null> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getBlockTransactionCountByNumber(blockNum=${blockNumOrTag}, showDetails=%o)`);
    const blockNum = await this.translateBlockTag(blockNumOrTag, requestId);
    return this.mirrorNodeClient
      .getBlock(blockNum, requestId)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        this.logger.error(e, `${requestIdPrefix} Failed to retrieve block for blockNum ${blockNum}`, blockNum);
        throw predefined.INTERNAL_ERROR(e.message);
      });
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
      .catch((e: any) => {
        if(e instanceof JsonRpcError) {
          throw e;
        }

        this.logger.error(
          e,
          `${requestIdPrefix} Failed to retrieve contract result for blockHash ${blockHash} and index=${transactionIndex}`
        );

        throw predefined.INTERNAL_ERROR(e.message);
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
        if(e instanceof JsonRpcError) {
          throw e;
        }

        this.logger.error(
          e,
          `${requestIdPrefix} Failed to retrieve contract result for blockNum ${blockNum} and index=${transactionIndex}`
        );

        throw predefined.INTERNAL_ERROR(e.message);
      });
  }

  /**
   * Gets the number of transactions that have been executed for the given address.
   * This goes to the consensus nodes to determine the ethereumNonce.
   *
   * TODO Should it go against the mirror node instead? Less load on the network vs. latency...
   *
   * @param address
   * @param blockNumOrTag
   */
  async getTransactionCount(address: string, blockNumOrTag: string, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} getTransactionCount(address=${address}, blockNumOrTag=${blockNumOrTag})`);
    const blockNumber = await this.translateBlockTag(blockNumOrTag, requestId);
    if (blockNumber === 0) {
      return EthImpl.zeroHex;
    } else if (address && !blockNumOrTag) {
      // get latest ethereumNonce
      const mirrorAccount = await this.mirrorNodeClient.getAccount(address, requestId);
      if (mirrorAccount && mirrorAccount.ethereum_nonce) {
        return EthImpl.numberTo0x(mirrorAccount.ethereum_nonce);
      }
    }

    // check consensus node as back up
    try {
      const result = await this.mirrorNodeClient.resolveEntityType(address, requestId);
      if (result?.type === constants.TYPE_ACCOUNT) {
          const accountInfo = await this.sdkClient.getAccountInfo(result?.entity.account, EthImpl.ethGetTransactionCount, requestId);
          return EthImpl.numberTo0x(Number(accountInfo.ethereumNonce));
      }
      else if (result?.type === constants.TYPE_CONTRACT) {
        return EthImpl.numberTo0x(1);
      }

      return EthImpl.zeroHex;
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Error raised during getTransactionCount for address ${address}, block number or tag ${blockNumOrTag}`);
      if (e instanceof JsonRpcError) {
        return e;
      }
      return predefined.INTERNAL_ERROR();
    }
  }

  /**
   * Submits a transaction to the network for execution.
   *
   * @param transaction
   */
  async sendRawTransaction(transaction: string, requestId?: string): Promise<string | JsonRpcError> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} sendRawTransaction(transaction=${transaction})`);

    try {
      const gasPrice = await this.getFeeWeibars(EthImpl.ethSendRawTransaction, requestId);
      await this.precheck.sendRawTransactionCheck(transaction, gasPrice, requestId);
    } catch (e: any) {
      if (e instanceof JsonRpcError) {
        return e;
      }

      throw predefined.INTERNAL_ERROR();
    }

    const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction), 'hex');
    try {
      const contractExecuteResponse = await this.sdkClient.submitEthereumTransaction(transactionBuffer, EthImpl.ethSendRawTransaction, requestId);

      try {
        // Wait for the record from the execution.
        const record = await this.sdkClient.executeGetTransactionRecord(contractExecuteResponse, EthereumTransaction.name, EthImpl.ethSendRawTransaction, requestId);
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
      return predefined.INTERNAL_ERROR();
    }
  }

  /**
   * Execute a free contract call query.
   *
   * @param call
   * @param blockParam
   */
  async call(call: any, blockParam: string | null, requestId?: string): Promise<string | JsonRpcError> {
    // FIXME: In the future this will be implemented by making calls to the mirror node. For the
    //        time being we'll eat the cost and ask the main consensus nodes instead.
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} call(hash=${JSON.stringify(call)}, blockParam=${blockParam})`, call, blockParam);
    // The "to" address must always be 42 chars.
    if (call.to.length != 42) {
      throw new Error(requestIdPrefix+
        " Invalid Contract Address: '" + call.to + "'. Expected length of 42 chars but was" + call.to.length
      );
    }

    try {
      // Get a reasonable value for "gas" if it is not specified.
      let gas: number;
      if (typeof call.gas === 'string') {
        gas = Number(call.gas);
      } else {
        if (call.gas == null) {
          gas = 400_000;
        } else {
          gas = call.gas;
        }
      }

      // Gas limit for `eth_call` is 50_000_000, but the current Hedera network limit is 15_000_000
      // With values over the gas limit, the call will fail with BUSY error so we cap it at 15_000_000
      if (gas > constants.BLOCK_GAS_LIMIT) {
        this.logger.trace(`${requestIdPrefix} eth_call gas amount (${gas}) exceeds network limit, capping gas to ${constants.BLOCK_GAS_LIMIT}`);
        gas = constants.BLOCK_GAS_LIMIT;
      }

      // Execute the call and get the response
      this.logger.debug(`${requestIdPrefix} Making eth_call on contract ${call.to} with gas ${gas} and call data "${call.data}" from "${call.from}"`, call.to, gas, call.data, call.from);
      const contractCallResponse = await this.sdkClient.submitContractCallQuery(call.to, call.data, gas, call.from, EthImpl.ethCall, requestId);

      // FIXME Is this right? Maybe so?
      return EthImpl.prepend0x(Buffer.from(contractCallResponse.asBytes()).toString('hex'));
    } catch (e: any) {
      this.logger.error(e, `${requestIdPrefix} Failed to successfully submit contractCallQuery`);
      if (e instanceof JsonRpcError) {
        return e;
      }
      return predefined.INTERNAL_ERROR();
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
    const contractResult = await this.mirrorNodeClient.getContractResult(hash, requestId);
    if (contractResult === null || contractResult.hash === undefined) {
      return null;
    }

    let fromAddress;
    if(contractResult.from) {
      fromAddress = contractResult.from.substring(0, 42);
      const accountResult = await this.mirrorNodeClient.getAccount(fromAddress, requestId);
      if(accountResult && accountResult.evm_address && accountResult.evm_address.length > 0) {
        fromAddress = accountResult.evm_address.substring(0,42);
      }
    }

    const maxPriorityFee = contractResult.max_priority_fee_per_gas === EthImpl.emptyHex ? undefined : contractResult.max_priority_fee_per_gas;
    const maxFee = contractResult.max_fee_per_gas === EthImpl.emptyHex ? undefined : contractResult.max_fee_per_gas;
    const rSig = contractResult.r === null ? null : contractResult.r.substring(0, 66);
    const sSig = contractResult.s === null ? null : contractResult.s.substring(0, 66);

    return new Transaction({
      accessList: undefined, // we don't support access lists, so punt for now
      blockHash: contractResult.block_hash.substring(0, 66),
      blockNumber: EthImpl.numberTo0x(contractResult.block_number),
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
      transactionIndex: EthImpl.numberTo0x(contractResult.transaction_index),
      type: EthImpl.nullableNumberTo0x(contractResult.type),
      v: EthImpl.nullableNumberTo0x(contractResult.v),
      value: EthImpl.numberTo0x(contractResult.amount),
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
    const receiptResponse = await this.mirrorNodeClient.getContractResult(hash, requestId);
    if (receiptResponse === null || receiptResponse.hash === undefined) {
      this.logger.trace(`${requestIdPrefix} no receipt for ${hash}`);
      // block not found
      return null;
    } else {
      const effectiveGas =
        receiptResponse.max_fee_per_gas === undefined || receiptResponse.max_fee_per_gas == '0x'
          ? receiptResponse.gas_price
          : receiptResponse.max_fee_per_gas;
      const createdContract =
        receiptResponse.created_contract_ids.length > 0
          ? EthImpl.prepend0x(ContractId.fromString(receiptResponse.created_contract_ids[0]).toSolidityAddress())
          : undefined;


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
          transactionIndex: EthImpl.numberTo0x(receiptResponse.transaction_index)
        });
      });

      const receipt: any = {
        blockHash: EthImpl.toHash32(receiptResponse.block_hash),
        blockNumber: EthImpl.numberTo0x(receiptResponse.block_number),
        from: receiptResponse.from,
        to: receiptResponse.to,
        cumulativeGasUsed: EthImpl.numberTo0x(receiptResponse.block_gas_used),
        gasUsed: EthImpl.nanOrNumberTo0x(receiptResponse.gas_used),
        contractAddress: createdContract,
        logs: logs,
        logsBloom: receiptResponse.bloom === EthImpl.emptyHex ? EthImpl.emptyBloom : receiptResponse.bloom,
        transactionHash: EthImpl.toHash32(receiptResponse.hash),
        transactionIndex: EthImpl.numberTo0x(receiptResponse.transaction_index),
        effectiveGasPrice: EthImpl.nanOrNumberTo0x(Number.parseInt(effectiveGas) * 10_000_000_000),
        root: receiptResponse.root,
        status: receiptResponse.status,
      };

      if (receiptResponse.error_message) {
        receipt.revertReason = receiptResponse.error_message;
      }

      this.logger.trace(`${requestIdPrefix} receipt for ${hash} found in block ${receipt.blockNumber}`);
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

  static numberTo0x(input: number | BigNumber): string {
    return EthImpl.emptyHex + input.toString(16);
  }

  static nullableNumberTo0x(input: number | BigNumber): string | null {
    return input === null ? null : EthImpl.numberTo0x(input);
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
  }

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

  /**
   * Gets the block with the given hash.
   * Given an ethereum transaction hash, call the mirror node to get the block info.
   * Then using the block timerange get all contract results to get transaction details.
   * If showDetails is set to true subsequently call mirror node for additional transaction details
   *
   * TODO What do we return if we cannot find the block with that hash?
   * @param blockHashOrNumber
   * @param showDetails
   */
  private async getBlock(blockHashOrNumber: string, showDetails: boolean, requestId?: string ): Promise<Block | null> {
    const blockResponse = await this.getHistoricalBlockResponse(blockHashOrNumber, true);

    if(blockResponse == null) return null;

    const timestampRange = blockResponse.timestamp;
    const timestampRangeParams = [`gte:${timestampRange.from}`, `lte:${timestampRange.to}`];
    const contractResults = await this.mirrorNodeClient.getContractResults({ timestamp: timestampRangeParams },undefined, requestId);
    const maxGasLimit = constants.BLOCK_GAS_LIMIT;
    const gasUsed = blockResponse.gas_used;

    if (contractResults?.results == null) {
      // contract result not found
      return null;
    }

    // The consensus timestamp of the block, with the nanoseconds part omitted.
    const timestamp = timestampRange.from.substring(0, timestampRange.from.indexOf('.'));
    const transactionObjects: Transaction[] = [];
    const transactionHashes: string[] = [];

    for (const result of contractResults.results) {
      // depending on stage of contract execution revert the result.to value may be null
      if (!_.isNil(result.to)) {
        const transaction = await this.getTransactionFromContractResult(result.to, result.timestamp, requestId);
        if (transaction !== null) {
          showDetails ? transactionObjects.push(transaction) : transactionHashes.push(transaction.hash);
        }
      }
    }

    const blockHash = blockResponse.hash.substring(0, 66);
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
    let blockResponse: any;
    // Determine if the latest block should be returned and if not then just return null
    if (!returnLatest && EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
      return null;
    }

    if (blockNumberOrTag == null || EthImpl.blockTagIsLatestOrPending(blockNumberOrTag)) {
      const blockPromise = this.mirrorNodeClient.getLatestBlock(requestId);
      const blockAnswer = await blockPromise;
      blockResponse = blockAnswer.blocks[0];
    } else if (blockNumberOrTag == EthImpl.blockEarliest) {
      blockResponse = await this.mirrorNodeClient.getBlock(0, requestId);
    } else if (blockNumberOrTag.length < 32) {
      // anything less than 32 characters is treated as a number
      blockResponse = await this.mirrorNodeClient.getBlock(Number(blockNumberOrTag), requestId);
    } else {
      blockResponse = await this.mirrorNodeClient.getBlock(blockNumberOrTag, requestId);
    }

    return blockResponse;
  }

  private static getTransactionCountFromBlockResponse(block: any) {
    if (block === null || block.count === undefined) {
      // block not found
      return null;
    }

    return EthImpl.numberTo0x(block.count);
  }

  private getTransactionFromContractResults(contractResults: any, requestId?: string) {
    if (!contractResults || !contractResults.results || contractResults.results.length == 0) {
      // contract result not found
      return null;
    }

    const contractResult = contractResults.results[0];

    return this.getTransactionFromContractResult(contractResult.to, contractResult.timestamp, requestId);
  }

  private async getTransactionFromContractResult(to: string, timestamp: string, requestId?: string): Promise<Transaction | null> {
    // call mirror node by id and timestamp for further details
    const requestIdPrefix = formatRequestIdMessage(requestId);
    return this.mirrorNodeClient.getContractResultsByAddressAndTimestamp(to, timestamp, requestId)
      .then(contractResultDetails => {
        // 404 is allowed return code so it's possible for contractResultDetails to be null
        if(contractResultDetails == null) {
          return null;
        } else {
          const rSig = contractResultDetails.r === null ? null : contractResultDetails.r.substring(0, 66);
          const sSig = contractResultDetails.s === null ? null : contractResultDetails.s.substring(0, 66);
          return new Transaction({
            accessList: undefined, // we don't support access lists for now, so punt
            blockHash: contractResultDetails.block_hash.substring(0, 66),
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
            transactionIndex: EthImpl.numberTo0x(contractResultDetails.transaction_index),
            type: EthImpl.nullableNumberTo0x(contractResultDetails.type),
            v: EthImpl.nullableNumberTo0x(contractResultDetails.v),
            value: EthImpl.numberTo0x(contractResultDetails.amount),
          });
        }
      })
      .catch((e: any) => {
        this.logger.error(
          e,
          `${requestIdPrefix} Failed to retrieve contract result details for contract address ${to} at timestamp=${timestamp}`
        );

        throw predefined.INTERNAL_ERROR(e.message);
      });
  }

  async getLogs(blockHash: string | null, fromBlock: string | null, toBlock: string | null, address: string | null, topics: any[] | null, requestId?: string): Promise<Log[]> {
    const params: any = {};
    if (blockHash) {
      try {
        const block = await this.mirrorNodeClient.getBlock(blockHash, requestId);
        if (block) {
          params.timestamp = [
            `gte:${block.timestamp.from}`,
            `lte:${block.timestamp.to}`
          ];
        }
      }
      catch(e: any) {
        if (e instanceof MirrorNodeClientError && e.isNotFound()) {
          return [];
        }

        throw e;
      }
    } else {
      const blockRangeLimit = Number(process.env.ETH_GET_LOGS_BLOCK_RANGE_LIMIT) || constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT;
      let fromBlockNum = 0;
      let toBlockNum;

      if(!fromBlock && !toBlock) {
        const blockResponse = await this.getHistoricalBlockResponse("latest", true, requestId);
        fromBlockNum = parseInt(blockResponse.number);
        toBlockNum = parseInt(blockResponse.number);
        params.timestamp = [`gte:${blockResponse.timestamp.from}`, `lte:${blockResponse.timestamp.to}`];
      } else {
          params.timestamp = [];

          const fromBlockResponse = await this.getHistoricalBlockResponse(fromBlock || "latest", true, requestId);
          if(fromBlockResponse != null) {
            params.timestamp.push(`gte:${fromBlockResponse.timestamp.from}`);
            fromBlockNum = parseInt(fromBlockResponse.number);
          } else {
            return [];
          }

          const toBlockResponse = await this.getHistoricalBlockResponse(toBlock || "latest", true, requestId);
          if(toBlockResponse != null) {
            params.timestamp.push(`lte:${toBlockResponse.timestamp.to}`);
            toBlockNum = parseInt(toBlockResponse.number);
          }
      }

      if (fromBlockNum > toBlockNum) {
        return [];
      } else if((toBlockNum - fromBlockNum) > blockRangeLimit) {
        throw predefined.RANGE_TOO_LARGE(blockRangeLimit);
      }
    }

    if (topics) {
      for (let i = 0; i < topics.length; i++) {
        params[`topic${i}`] = topics[i];
      }
    }

    let result;
    if (address) {
      result = await this.mirrorNodeClient.getContractResultsLogsByAddress(address, params, undefined, requestId);
    }
    else {
      result = await this.mirrorNodeClient.getContractResultsLogs(params, undefined, requestId);
    }

    if (!result || !result.logs) {
      return [];
    }

    return result.logs.map(log => {
      return new Log({
        address: log.address,
        blockHash: EthImpl.toHash32(log.block_hash),
        blockNumber: EthImpl.numberTo0x(log.block_number),
        data: log.data,
        logIndex: EthImpl.numberTo0x(log.index),
        removed: false,
        topics: log.topics,
        transactionHash: EthImpl.toHash32(log.transaction_hash),
        transactionIndex: EthImpl.numberTo0x(log.transaction_index)
      });
    });
  }

  async maxPriorityFeePerGas(requestId?: string): Promise<string> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} maxPriorityFeePerGas()`);
    return EthImpl.zeroHex;
  }
}
