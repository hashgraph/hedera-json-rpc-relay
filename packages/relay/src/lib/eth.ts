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
import { ContractId, Status, Hbar, EthereumTransaction } from '@hashgraph/sdk';
import { BigNumber } from '@hashgraph/sdk/lib/Transfer';
import { Logger } from 'pino';
import { Block, CachedBlock, Transaction, Log } from './model';
import { MirrorNode } from './mirrorNode';
import { MirrorNodeClient, SDKClient } from './clients';
import { JsonRpcError, predefined } from './errors';
import constants from './constants';
import { Precheck } from './precheck';

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
  static defaultGas = EthImpl.numberTo0x(400_000);
  static gasTxBaseCost = EthImpl.numberTo0x(21_000);
  static ethTxType = 'EthereumTransaction';
  static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
  static defaultGasUsedRatio = EthImpl.numberTo0x(0.5);
  static feeHistoryZeroBlockCountResponse = {gasUsedRatio:null, oldestBlock:EthImpl.zeroHex};
  static feeHistoryEmptyResponse = {baseFeePerGas:[], gasUsedRatio:[], reward:[], oldestBlock:EthImpl.zeroHex};
  /**
   * The sdk client use for connecting to both the consensus nodes and mirror node. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private readonly sdkClient: SDKClient;

  /**
   * The mirror node mock
   * @private
   */
  private readonly mirrorNode: MirrorNode;

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
   * @param mirrorNode
   * @param mirrorNodeClient
   * @param logger
   * @param chain
   */
  constructor(
    nodeClient: SDKClient,
    mirrorNode: MirrorNode,
    mirrorNodeClient: MirrorNodeClient,
    logger: Logger,
    chain: string
  ) {
    this.sdkClient = nodeClient;
    this.mirrorNode = mirrorNode;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chain;
    this.precheck = new Precheck(mirrorNodeClient, logger, chain);
  }

  /**
   * This method is implemented to always return an empty array. This is in alignment
   * with the behavior of Infura.
   */
  accounts() {
    this.logger.trace('accounts()');
    return [];
  }

  /**
   * Gets the fee history.
   */
  async feeHistory(blockCount: number, newestBlock: string, rewardPercentiles: Array<number> | null) {
    this.logger.trace(`feeHistory(blockCount=${blockCount}, newestBlock=${newestBlock}, rewardPercentiles=${rewardPercentiles})`);
    try {
      const latestBlockNumber = await this.translateBlockTag('latest');
      const newestBlockNumber = await this.translateBlockTag(newestBlock);

      if (newestBlockNumber > latestBlockNumber) {
        return predefined.REQUEST_BEYOND_HEAD_BLOCK(newestBlockNumber, latestBlockNumber);
      }

      blockCount = blockCount > constants.FEE_HISTORY_MAX_RESULTS ? constants.FEE_HISTORY_MAX_RESULTS : blockCount;

      if (blockCount <= 0) {
        return EthImpl.feeHistoryZeroBlockCountResponse;
      }

      let feeHistory: object | undefined = cache.get(constants.CACHE_KEY.FEE_HISTORY);
      if (!feeHistory) {

        feeHistory = await this.getFeeHistory(blockCount, newestBlockNumber, latestBlockNumber, rewardPercentiles); 

        this.logger.trace(`caching ${constants.CACHE_KEY.FEE_HISTORY} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
        cache.set(constants.CACHE_KEY.FEE_HISTORY, feeHistory, constants.CACHE_TTL.ONE_HOUR);
      }

      return feeHistory;
    } catch (e) {
      this.logger.error(e, 'Error constructing default feeHistory');
      return EthImpl.feeHistoryEmptyResponse;
    }
  }

  private async getFeeByBlockNumber(blockNumber: number): Promise<string> {
    let fee = 0;

    try {
      const block = await this.mirrorNodeClient.getBlock(blockNumber);
      fee = await this.getFeeWeibars(`lte:${block.timestamp.to}`);
    } catch (error) {
      this.logger.warn(error, `Fee history cannot retrieve block or fee. Returning ${fee} fee for block ${blockNumber}`);
    }

    return EthImpl.numberTo0x(fee);
  }

  private async getFeeHistory(blockCount: number, newestBlockNumber: number, latestBlockNumber: number, rewardPercentiles: Array<number> | null) {
    // include newest block number in the total block count
    const oldestBlockNumber = Math.max(0, newestBlockNumber - blockCount + 1);
    const shouldIncludeRewards = Array.isArray(rewardPercentiles) && rewardPercentiles.length > 0;
    const feeHistory = {
      baseFeePerGas: [] as string[],
      gasUsedRatio: [] as string[],
      oldestBlock: EthImpl.numberTo0x(oldestBlockNumber),
    };

    // get fees from oldest to newest blocks
    for(let blockNumber = oldestBlockNumber; blockNumber <= newestBlockNumber; blockNumber++) {
      const fee = await this.getFeeByBlockNumber(blockNumber);

      feeHistory.baseFeePerGas.push(fee);
      feeHistory.gasUsedRatio.push(EthImpl.defaultGasUsedRatio);
    }

    // get latest block fee
    let nextBaseFeePerGas = _.last(feeHistory.baseFeePerGas);

    if (latestBlockNumber > newestBlockNumber) {
      // get next block fee if the newest block is not the latest
      nextBaseFeePerGas = await this.getFeeByBlockNumber(newestBlockNumber + 1);
    }
    
    if (nextBaseFeePerGas) {
      feeHistory.baseFeePerGas.push(nextBaseFeePerGas);
    }
    
    if (shouldIncludeRewards) {
      feeHistory['reward'] = Array(blockCount).fill(Array(rewardPercentiles.length).fill(EthImpl.zeroHex));
    }

    return feeHistory;
  }

  private async getFeeWeibars(timestamp?: string) {
    let networkFees;

    try {
      networkFees = await this.mirrorNodeClient.getNetworkFees(timestamp);
      if (_.isNil(networkFees)) {
        this.logger.debug(`Mirror Node returned no fees. Fallback to network`);
      }
    } catch (e: any) {
      this.logger.warn(e, `Mirror Node threw an error retrieving fees. Fallback to network`);
    }

    if (_.isNil(networkFees)) {
      networkFees = {
        fees: [
          {
            gas: await this.sdkClient.getTinyBarGasFee(),
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
  async blockNumber(): Promise<string> {
    this.logger.trace('blockNumber()');

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock();
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      return EthImpl.numberTo0x(blocks[0].number);
    }

    throw new Error('Error encountered retrieving latest block');
  }

  /**
   * Gets the chain ID. This is a static value, in that it always returns
   * the same value. This can be specified via an environment variable
   * `CHAIN_ID`.
   */
  chainId(): string {
    this.logger.trace('chainId()');
    return this.chain;
  }

  /**
   * Estimates the amount of gas to execute a call.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async estimateGas(transaction: any, _blockParam: string | null) {
    this.logger.trace('estimateGas()');
    if (!transaction || !transaction.data || transaction.data === '0x') {
      return EthImpl.gasTxBaseCost;
    } else {
      return EthImpl.defaultGas;
    }
  }

  /**
   * Gets the current gas price of the network.
   */
  async gasPrice() {
    this.logger.trace('gasPrice()');
    try {
      let gasPrice: number | undefined = cache.get(constants.CACHE_KEY.GAS_PRICE);

      if (!gasPrice) {
        gasPrice = await this.getFeeWeibars();

        this.logger.trace(`caching ${constants.CACHE_KEY.GAS_PRICE} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
        cache.set(constants.CACHE_KEY.GAS_PRICE, gasPrice, constants.CACHE_TTL.ONE_HOUR);
      }

      return EthImpl.numberTo0x(gasPrice);
    } catch (error) {
      this.logger.trace(error);
      throw error;
    }
  }

  /**
   * Gets whether this "Ethereum client" is a miner. We don't mine, so this always returns false.
   */
  async mining() {
    this.logger.trace('mining()');
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async submitWork() {
    this.logger.trace('submitWork()');
    return false;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async syncing() {
    this.logger.trace('syncing()');
    return false;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockHashAndIndex() {
    this.logger.trace('getUncleByBlockHashAndIndex()');
    return null;
  }

  /**
   * Always returns null. There are no uncles in Hedera.
   */
  async getUncleByBlockNumberAndIndex() {
    this.logger.trace('getUncleByBlockNumberAndIndex()');
    return null;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockHash() {
    this.logger.trace('getUncleCountByBlockHash()');
    return EthImpl.zeroHex;
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockNumber() {
    this.logger.trace('getUncleCountByBlockNumber()');
    return EthImpl.zeroHex;
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async hashrate() {
    this.logger.trace('hashrate()');
    return EthImpl.zeroHex;
  }

  /**
   * Always returns UNSUPPORTED_METHOD error.
   */
  getWork(): JsonRpcError {
    this.logger.trace('getWork()');
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Unsupported methods always return UNSUPPORTED_METHOD error.
   */
  submitHashrate(): JsonRpcError {
    this.logger.trace('submitHashrate()');
    return predefined.UNSUPPORTED_METHOD;
  }

  signTransaction(): JsonRpcError {
    this.logger.trace('signTransaction()');
    return predefined.UNSUPPORTED_METHOD;
  }

  sign(): JsonRpcError {
    this.logger.trace('sign()');
    return predefined.UNSUPPORTED_METHOD;
  }

  sendTransaction(): JsonRpcError {
    this.logger.trace('sendTransaction()');
    return predefined.UNSUPPORTED_METHOD;
  }

  protocolVersion(): JsonRpcError {
    this.logger.trace('protocolVersion()');
    return predefined.UNSUPPORTED_METHOD;
  }

  coinbase(): JsonRpcError {
    this.logger.trace('coinbase()');
    return predefined.UNSUPPORTED_METHOD;
  }

  /**
   * Gets the balance of an account as of the given block.
   *
   * @param account
   * @param blockNumberOrTag
   */
  async getBalance(account: string, blockNumberOrTag: string | null) {
    // FIXME: This implementation should be replaced so that instead of going to the
    //        consensus nodes we go to the mirror nodes instead. The problem is that
    //        the mirror nodes need to have the ability to give me the **CURRENT**
    //        account balance *and* the account balance for any given block.
    this.logger.trace('getBalance(account=%s, blockNumberOrTag=%s)', account, blockNumberOrTag);
    const blockNumber = await this.translateBlockTag(blockNumberOrTag);
    try {
      let weibars: BigNumber | number = 0;
      const result = await this.mirrorNodeClient.resolveEntityType(account);
      if (result?.type === constants.TYPE_ACCOUNT) {
        weibars = await this.sdkClient.getAccountBalanceInWeiBar(result.entity.account);
      }
      else if (result?.type === constants.TYPE_CONTRACT) {
        weibars = await this.sdkClient.getContractBalanceInWeiBar(result.entity.contract_id);
      }

      return EthImpl.numberTo0x(weibars);
    } catch (e: any) {
      // handle INVALID_ACCOUNT_ID
      if (e?.status?._code === Status.InvalidAccountId._code) {
        this.logger.debug(`Unable to find account ${account} in block ${JSON.stringify(blockNumber)}(${blockNumberOrTag}), returning 0x0 balance`);
        return EthImpl.zeroHex;
      }

      this.logger.error(e, 'Error raised during getBalance for account %s', account);
      throw e;
    }
  }

  /**
   * Gets the smart contract code for the contract at the given Ethereum address.
   *
   * @param address
   * @param blockNumber
   */
  async getCode(address: string, blockNumber: string | null) {
    // FIXME: This has to be reimplemented to get the data from the mirror node.
    this.logger.trace('getCode(address=%s, blockNumber=%s)', address, blockNumber);
    try {
      const bytecode = await this.sdkClient.getContractByteCode(0, 0, address);
      return EthImpl.prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      // handle INVALID_CONTRACT_ID
      if (e?.status?._code === Status.InvalidContractId._code || e?.message?.includes(Status.InvalidContractId.toString())) {
        this.logger.debug('Unable to find code for contract %s in block "%s", returning 0x0, err code: %s', address, blockNumber, e?.status?._code);
        return '0x0';
      }

      this.logger.error(e, 'Error raised during getCode for address %s, err code: %s', address, e?.status?._code);
      throw e;
    }
  }

  /**
   * Gets the block with the given hash.
   *
   * @param hash
   * @param showDetails
   */
  async getBlockByHash(hash: string, showDetails: boolean): Promise<Block | null> {
    this.logger.trace('getBlockByHash(hash=%s, showDetails=%o)', hash, showDetails);
    return this.getBlock(hash, showDetails).catch((e: any) => {
      this.logger.error(e, 'Failed to retrieve block for hash %s', hash);
      return null;
    });
  }

  /**
   * Gets the block by its block number.
   * @param blockNumOrTag
   * @param showDetails
   */
  async getBlockByNumber(blockNumOrTag: string, showDetails: boolean): Promise<Block | null> {
    this.logger.trace('getBlockByNumber(blockNum=%d, showDetails=%o)', blockNumOrTag);
    return this.getBlock(blockNumOrTag, showDetails).catch((e: any) => {
      this.logger.error(e, 'Failed to retrieve block for blockNum %s', blockNumOrTag);
      return null;
    });
  }

  /**
   * Gets the number of transaction in a block by its block hash.
   *
   * @param hash
   */
  async getBlockTransactionCountByHash(hash: string): Promise<number | null> {
    this.logger.trace('getBlockTransactionCountByHash(hash=%s, showDetails=%o)', hash);
    return this.mirrorNodeClient
      .getBlock(hash)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        this.logger.error(e, 'Failed to retrieve block for hash %s', hash);
        return null;
      });
  }

  /**
   * Gets the number of transaction in a block by its block number.
   * @param blockNumOrTag
   */
  async getBlockTransactionCountByNumber(blockNumOrTag: string): Promise<number | null> {
    this.logger.trace('getBlockTransactionCountByNumber(blockNum=%s, showDetails=%o)', blockNumOrTag);
    const blockNum = await this.translateBlockTag(blockNumOrTag);
    return this.mirrorNodeClient
      .getBlock(blockNum)
      .then((block) => EthImpl.getTransactionCountFromBlockResponse(block))
      .catch((e: any) => {
        this.logger.error(e, 'Failed to retrieve block for blockNum %s', blockNum);
        return null;
      });
  }

  /**
   * Gets the transaction in a block by its block hash and transactions index.
   *
   * @param blockHash
   * @param transactionIndex
   */
  async getTransactionByBlockHashAndIndex(blockHash: string, transactionIndex: number): Promise<Transaction | null> {
    this.logger.trace('getTransactionByBlockHashAndIndex(hash=%s, index=%d)', blockHash, transactionIndex);
    return this.mirrorNodeClient
      .getContractResults({ blockHash: blockHash, transactionIndex: transactionIndex })
      .then((contractResults) => this.getTransactionFromContractResults(contractResults))
      .catch((e: any) => {
        this.logger.error(
          e,
          'Failed to retrieve contract result for hash %s and index=%d',
          blockHash,
          transactionIndex
        );
        return null;
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
    transactionIndex: number
  ): Promise<Transaction | null> {
    this.logger.trace('getTransactionByBlockNumberAndIndex(blockNum=%s, index=%d)', blockNumOrTag, transactionIndex);
    const blockNum = await this.translateBlockTag(blockNumOrTag);
    return this.mirrorNodeClient
      .getContractResults({ blockNumber: blockNum, transactionIndex: transactionIndex })
      .then((contractResults) => this.getTransactionFromContractResults(contractResults))
      .catch((e: any) => {
        this.logger.error(
          e,
          'Failed to retrieve contract result for blockNum %s and index=%d',
          blockNum,
          transactionIndex
        );
        return null;
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
  async getTransactionCount(address: string, blockNumOrTag: string): Promise<string> {
    this.logger.trace('getTransactionCount(address=%s, blockNumOrTag=%s)', address, blockNumOrTag);
    const blockNumber = await this.translateBlockTag(blockNumOrTag);
    if (blockNumber === 0) {
      return '0x0';
    } else {
      const result = await this.mirrorNodeClient.resolveEntityType(address);
      if (result?.type === constants.TYPE_ACCOUNT) {
        const accountInfo = await this.sdkClient.getAccountInfo(result?.entity.account);
        return EthImpl.numberTo0x(Number(accountInfo.ethereumNonce));
      }
      else if (result?.type === constants.TYPE_CONTRACT) {
        return EthImpl.numberTo0x(1);
      }

      return EthImpl.numberTo0x(0);
    }
  }

  /**
   * Submits a transaction to the network for execution.
   *
   * @param transaction
   */
  async sendRawTransaction(transaction: string): Promise<string | JsonRpcError> {
    this.logger.trace('sendRawTransaction(transaction=%s)', transaction);

    try {
      await this.precheck.gasLimit(transaction);
      await this.precheck.nonce(transaction);
      this.precheck.chainId(transaction);
    }
    catch(e: any) {
      return e;
    }
    //
    // const chainIdPrecheckRes = this.precheck.chainId(transaction);
    // if ( !chainIdPrecheckRes.passes ) {
    //   return new JsonRpcError({
    //     name: 'ChainId not supported',
    //     code: -32000,
    //     message: `ChainId (${chainIdPrecheckRes.chainId}) not supported. The correct chainId is ${this.chain}.`
    //   });
    // }

    const gasPrice = await this.getFeeWeibars();
    const gasPrecheck = this.precheck.gasPrice(transaction, gasPrice);
    if (!gasPrecheck.passes) {
      return gasPrecheck.error;
    }

    const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction), 'hex');

    try {
      const contractExecuteResponse = await this.sdkClient.submitEthereumTransaction(transactionBuffer);

      try {
        // Wait for the record from the execution.
        const record = await this.sdkClient.executeGetTransactionRecord(contractExecuteResponse, EthereumTransaction.name);
        if (record.ethereumHash == null) {
          throw new Error('The ethereumHash can never be null for an ethereum transaction, and yet it was!!');
        }
        const txHash = EthImpl.prepend0x(Buffer.from(record.ethereumHash).toString('hex'));

        // If the transaction succeeded, create a new block for the transaction.
        const mostRecentBlock = await this.mirrorNode.getMostRecentBlock();
        this.logger.debug('mostRecentBlock=%o', mostRecentBlock);
        let block = mostRecentBlock;
        if (record.receipt.status == Status.Success) {
          block = new CachedBlock(mostRecentBlock, txHash);
          this.mirrorNode.storeBlock(block);
        }

        // Create a receipt. Register the receipt in the cache and return the tx hash
        if (block == null) {
          this.logger.error('Failed to get a block for transaction');
          return '';
        }

        return txHash;
      } catch (e) {
        this.logger.error(e,
          'Failed sendRawTransaction during record retrieval for transaction %s, returning computed hash', transaction);
        //Return computed hash if unable to retrieve EthereumHash from record due to error
        return EthImpl.prepend0x(createHash('keccak256').update(transactionBuffer).digest('hex'));
      }
    } catch (e: any) {
      this.logger.error(e,
        'Failed to successfully submit sendRawTransaction for transaction %s', transaction);
      return predefined.INTERNAL_ERROR;
    }
  }

  /**
   * Execute a free contract call query.
   *
   * @param call
   * @param blockParam
   */
  async call(call: any, blockParam: string | null): Promise<string | JsonRpcError> {
    // FIXME: In the future this will be implemented by making calls to the mirror node. For the
    //        time being we'll eat the cost and ask the main consensus nodes instead.

    this.logger.trace('call(hash=%o, blockParam=%s)', call, blockParam);
    // The "to" address must always be 42 chars.
    if (call.to.length != 42) {
      throw new Error(
        "Invalid Contract Address: '" + call.to + "'. Expected length of 42 chars but was" + call.to.length
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

      // Execute the call and get the response
      this.logger.debug('Making eth_call on contract %o with gas %d and call data "%s"', call.to, gas, call.data);
      const contractCallResponse = await this.sdkClient.submitContractCallQuery(call.to, call.data, gas);

      // FIXME Is this right? Maybe so?
      return EthImpl.prepend0x(Buffer.from(contractCallResponse.asBytes()).toString('hex'));
    } catch (e: any) {
      // handle client error
      let resolvedError = e;
      if (e.status && e.status._code) {
        resolvedError = new Error(e.message);
      }

      this.logger.error(resolvedError, 'Failed to successfully submit contractCallQuery');
      return predefined.INTERNAL_ERROR;
    }
  }

  /**
   * Gets a transaction by the provided hash
   *
   * @param hash
   */
  async getTransactionByHash(hash: string) {
    this.logger.trace('getTransactionByHash(hash=%s)', hash);
    const contractResult = await this.mirrorNodeClient.getContractResult(hash);
    if (contractResult === null || contractResult.hash === undefined) {
      return null;
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
      from: contractResult.from.substring(0, 42),
      gas: contractResult.gas_used,
      gasPrice: EthImpl.toNullIfEmptyHex(contractResult.gas_price),
      hash: contractResult.hash.substring(0, 66),
      input: contractResult.function_parameters,
      maxPriorityFeePerGas: maxPriorityFee,
      maxFeePerGas: maxFee,
      nonce: contractResult.nonce,
      r: rSig,
      s: sSig,
      to: contractResult.to.substring(0, 42),
      transactionIndex: contractResult.transaction_index,
      type: contractResult.type,
      v: contractResult.v,
      value: contractResult.amount,
    });
  }

  /**
   * Gets a receipt for a transaction that has already executed.
   *
   * @param hash
   */
  async getTransactionReceipt(hash: string) {
    this.logger.trace(`getTransactionReceipt(${hash})`);
    const receiptResponse = await this.mirrorNodeClient.getContractResult(hash);
    if (receiptResponse === null || receiptResponse.hash === undefined) {
      this.logger.trace(`no receipt for ${hash}`);
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
          blockHash: receiptResponse.block_hash.substring(0, 66),
          blockNumber: receiptResponse.block_number,
          data: log.data,
          logIndex: log.index,
          removed: false,
          topics: log.topics,
          transactionHash: receiptResponse.hash,
          transactionIndex: receiptResponse.transaction_index
        });
      });

      const receipt = {
        blockHash: receiptResponse.block_hash.substring(0, 66),
        blockNumber: EthImpl.numberTo0x(receiptResponse.block_number),
        from: receiptResponse.from,
        to: receiptResponse.to,
        cumulativeGasUsed: EthImpl.numberTo0x(receiptResponse.block_gas_used),
        gasUsed: EthImpl.numberTo0x(receiptResponse.gas_used),
        contractAddress: createdContract,
        logs: logs,
        logsBloom: receiptResponse.bloom,
        transactionHash: receiptResponse.hash,
        transactionIndex: EthImpl.numberTo0x(receiptResponse.transaction_index),
        effectiveGasPrice: EthImpl.numberTo0x(Number.parseInt(effectiveGas) * 10_000_000_000),
        root: receiptResponse.root,
        status: receiptResponse.status,
      };


      this.logger.trace(`receipt for ${hash} found in block ${receipt.blockNumber}`);
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

  private static toNullIfEmptyHex(value: string): string | null {
    return value === EthImpl.emptyHex ? null : value;
  }

  /**
   * Internal helper method that removes the leading 0x if there is one.
   * @param input
   * @private
   */
  private static prune0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex) ? input.substring(2) : input;
  }

  /**
   * Translates a block tag into a number. 'latest', 'pending', and null are the
   * most recent block, 'earliest' is 0, numbers become numbers.
   *
   * @param tag null, a number, or 'latest', 'pending', or 'earliest'
   * @private
   */
  private async translateBlockTag(tag: string | null): Promise<number> {
    if (tag === null || tag === 'latest' || tag === 'pending') {
      return Number(await this.blockNumber());
    } else if (tag === 'earliest') {
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
  private async getBlock(blockHashOrNumber: string, showDetails: boolean): Promise<Block | null> {
    let blockResponse: any;
    if (blockHashOrNumber == null || blockHashOrNumber == 'latest' || blockHashOrNumber == 'pending') {
      const blockPromise = this.mirrorNodeClient.getLatestBlock();
      const blockAnswer = await blockPromise;
      blockResponse = blockAnswer.blocks[0];
    } else if (blockHashOrNumber == 'earliest') {
      blockResponse = await this.mirrorNodeClient.getBlock(0);
    } else if (blockHashOrNumber.length < 32) {
      // anything less than 32 characters is treated as a number
      blockResponse = await this.mirrorNodeClient.getBlock(Number(blockHashOrNumber));
    } else {
      blockResponse = await this.mirrorNodeClient.getBlock(blockHashOrNumber);
    }

    if (_.isNil(blockResponse) || blockResponse.hash === undefined) {
      // block not found
      return null;
    }

    const timestampRange = blockResponse.timestamp;
    const timestampRangeParams = [`gte:${timestampRange.from}`, `lte:${timestampRange.to}`];
    const contractResults = await this.mirrorNodeClient.getContractResults({ timestamp: timestampRangeParams });

    if (contractResults === null || contractResults.results === undefined) {
      // contract result not found
      return null;
    }

    // loop over contract function results to calculated aggregated datapoints
    let gasUsed = 0;
    let maxGasLimit = 0;
    let timestamp = 0;
    const transactionObjects: Transaction[] = [];
    const transactionHashes: string[] = [];

    for (const result of contractResults.results) {
      maxGasLimit = result.gas_limit > maxGasLimit ? result.gas_limit : maxGasLimit;
      gasUsed += result.gas_used;
      if (timestamp === 0) {
        // The consensus timestamp of the first transaction in the block, with the nanoseconds part omitted.
        timestamp = result.timestamp.substring(0, result.timestamp.indexOf('.')); // mirrorNode response assures format of ssssssssss.nnnnnnnnn
      }

      const transaction = await this.getTransactionFromContractResult(result.to, result.timestamp);
      if (transaction !== null) {
        if (showDetails) {
          transactionObjects.push(transaction);
        } else {
          transactionHashes.push(transaction.hash);
        }
      }
    }

    const blockHash = blockResponse.hash.substring(0, 66);
    const transactionArray = showDetails ? transactionObjects : transactionHashes;
    return new Block({
      baseFeePerGas: await this.gasPrice(),
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

  private static getTransactionCountFromBlockResponse(block: any) {
    if (block === null || block.count === undefined) {
      // block not found
      return null;
    }

    return block.count;
  }

  private getTransactionFromContractResults(contractResults: any) {
    if (contractResults.results === undefined) {
      // contract result not found
      return null;
    }

    const contractResult = contractResults.results[0];
    return this.getTransactionFromContractResult(contractResult.to, contractResult.timestamp);
  }

  private async getTransactionFromContractResult(to: string, timestamp: string): Promise<Transaction | null> {
    // call mirror node by id and timestamp for further details
    return this.mirrorNodeClient.getContractResultsByAddressAndTimestamp(to, timestamp)
      .then(contractResultDetails => {
        const rSig = contractResultDetails.r === null ? null : contractResultDetails.r.substring(0, 66);
        const sSig = contractResultDetails.s === null ? null : contractResultDetails.s.substring(0, 66);
        return new Transaction({
          accessList: undefined, // we don't support access lists for now, so punt
          blockHash: contractResultDetails.block_hash.substring(0, 66),
          blockNumber: EthImpl.numberTo0x(contractResultDetails.block_number),
          chainId: contractResultDetails.chain_id,
          from: contractResultDetails.from.substring(0, 42),
          gas: contractResultDetails.gas_used,
          gasPrice: EthImpl.toNullIfEmptyHex(contractResultDetails.gas_price),
          hash: contractResultDetails.hash.substring(0, 66),
          input: contractResultDetails.function_parameters,
          maxPriorityFeePerGas: EthImpl.toNullIfEmptyHex(contractResultDetails.max_priority_fee_per_gas),
          maxFeePerGas: EthImpl.toNullIfEmptyHex(contractResultDetails.max_fee_per_gas),
          nonce: contractResultDetails.nonce,
          r: rSig,
          s: sSig,
          to: contractResultDetails.to.substring(0, 42),
          transactionIndex: contractResultDetails.transaction_index,
          type: contractResultDetails.type,
          v: contractResultDetails.v,
          value: contractResultDetails.amount,
        });
      })
      .catch((e: any) => {
        this.logger.error(
          e,
          'Failed to retrieve contract result details for contract address %s at timestamp=%s',
          to,
          timestamp
        );
        return null;
      });
  }

  async getLogs(blockHash: string | null, fromBlock: string | null, toBlock: string | null, address: string | null, topics: any[] | null): Promise<Log[]> {
    const params: any = {};
    if (blockHash) {
      const block = await this.mirrorNodeClient.getBlock(blockHash);
      if (block) {
        params.timestamp = [
          `gte:${block.timestamp.from}`,
          `lte:${block.timestamp.to}`
        ];
      }
    }
    else if (fromBlock && toBlock) {
      const blocksResult = await this.mirrorNodeClient.getBlocks([
        `gte:${fromBlock}`,
        `lte:${toBlock}`
      ]);

      const blocks = blocksResult?.blocks;
      if (blocks?.length) {
        const firstBlock = blocks[0];
        const lastBlock = blocks[blocks.length - 1];
        params.timestamp = [
          `gte:${firstBlock.timestamp.from}`,
          `lte:${lastBlock.timestamp.to}`
        ];
      }
    }

    if (topics) {
      for (let i = 0; i < topics.length; i++) {
        params[`topic${i}`] = topics[i];
      }
    }

    let result;
    if (address) {
      result = await this.mirrorNodeClient.getContractResultsLogsByAddress(address, params);
    }
    else {
      result = await this.mirrorNodeClient.getContractResultsLogs(params);
    }

    if (!result || !result.logs) {
      return [];
    }
    const logs = result.logs;

    // Find unique contract execution timestamp and for each one make mirror node request
    const promises: Promise<any>[] = [];
    const uniquePairs = {};

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const timestamp = `${log.timestamp}`;
      if (uniquePairs[timestamp] === undefined) {
        uniquePairs[timestamp] = [i];
        promises.push(this.mirrorNodeClient.getContractResultsDetails(
          log.contract_id,
          log.timestamp
        ));
      }
      else {
        uniquePairs[timestamp].push(i);
      }
    }

    // Populate the Log objects with block and transaction data from ContractResultsDetails
    try {
      const contractsResultsDetails = await Promise.all(promises);
      for (let i = 0; i < contractsResultsDetails.length; i++) {
        const detail = contractsResultsDetails[i];
        // retrieve set of logs for each timestamp
        const timestamp = `${detail.timestamp}`;
        const uPair = uniquePairs[timestamp] || [];
        for (let p = 0; p < uPair.length; p++) {
          const logIndex = uPair[p];
          const log = logs[logIndex];
          logs[logIndex] = new Log({
            address: log.address,
            blockHash: detail.block_hash.substring(0, 66),
            blockNumber: detail.block_number,
            data: log.data,
            logIndex: log.index,
            removed: false,
            topics: log.topics,
            transactionHash: detail.hash,
            transactionIndex: detail.transaction_index
          });
        }
      }
    }
    catch (e) {
      return [];
    }

    return logs;
  }
}
