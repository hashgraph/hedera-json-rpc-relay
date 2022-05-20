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
import {
  AccountBalanceQuery,
  AccountId,
  AccountInfoQuery,
  Client,
  ContractByteCodeQuery,
  ContractCallQuery,
  ContractId,
  EthereumTransaction,
  ExchangeRates,
  FileContentsQuery,
  HbarUnit,
  Status,
} from '@hashgraph/sdk';
import { Logger } from 'pino';
import { Block, Receipt, Transaction } from './model';
import { MirrorNode } from './mirrorNode';
import { NodeClient, MirrorNodeClient } from './clients';

const cache = require('js-cache');

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
  private static emptyHex = '0x';
  private static zeroHex = '0x0';
  private static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
  private static defaultGas = 0x10000;
  
  /**
   * The client to use for connecting to the main consensus network. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private readonly nodeClient: NodeClient;

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
   * The ID of the chain, as a hex string, as it would be returned in a JSON-RPC call.
   * @private
   */
  private readonly chain: string;

  /**
   * Create a new Eth implementation.
   * @param nodeClient
   * @param mirrorNode
   * @param logger
   */
  constructor(nodeClient: NodeClient, mirrorNode: MirrorNode, mirrorNodeClient: MirrorNodeClient, logger: Logger, chain: string) {
    this.nodeClient = nodeClient;
    this.mirrorNode = mirrorNode;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.chain = chain;
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
  async feeHistory(
    blockCount: number,
    newestBlock: string,
    rewardPercentiles: Array<number> | null
  ) {
    this.logger.trace('feeHistory()');
    try {
      const feeWeibars = await this.getFeeWeibars();

      return await this.mirrorNode.getFeeHistory(
        feeWeibars,
        blockCount,
        newestBlock,
        rewardPercentiles
      );
    } catch (e) {
      this.logger.trace(e);
    }
  }

  private async getFeeWeibars() {
    const exchangeRates = await this.nodeClient.getExchangeRate();

    //FIXME retrieve fee from fee API when released
    const contractTransactionGas = 853454;

    //contractTransactionGas is in tinycents * 1000, so the final multiplier is truncated by 3 zeroes for
    // the conversion to weibars
    return Math.ceil(
      (contractTransactionGas / exchangeRates.currentRate.cents) *
        exchangeRates.currentRate.hbars *
        10_000_000
    );
  }

  /**
   * Gets the most recent block number.
   */
  async blockNumber(): Promise<number> {
    this.logger.trace('blockNumber()');

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock();
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      return blocks[0].number;
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
   *
   * TODO: API signature is not right, some kind of call info needs to be passed through:
   *   "params": [{
   *     "from": "0xb60e8dd61c5d32be8058bb8eb970870f07233155",
   *     "to": "0xd46e8dd67c5d32be8058bb8eb970870f07244567",
   *     "gas": "0x76c0",
   *     "gasPrice": "0x9184e72a000",
   *     "value": "0x9184e72a",
   *     "data": "0xd46e8dd67c5d32be8d46e8dd67c5d32be8058bb8eb970870f072445675058bb8eb970870f072445675"}],
   */
  async estimateGas() {
    // FIXME: For now, we are going to have a rough estimate but in the future we can do something more sophisticated.
    this.logger.trace('estimateGas()');
    return EthImpl.defaultGas;
  }

  /**
   * Gets the current gas price of the network.
   */
  async gasPrice() {
    // FIXME: This should come from the mainnet and get cached. The gas price does change dynamically based on
    //        the price of the HBAR relative to the USD. It only needs to be updated hourly.
    this.logger.trace('gasPrice()');
    try {
      const feeWeibars = await this.getFeeWeibars();

      return feeWeibars;
    } catch (e) {
      this.logger.trace(e);
      throw e;
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
   * Gets the balance of an account as of the given block.
   *
   * @param account
   * @param blockNumber
   */
  async getBalance(account: string, blockNumber: string | null) {
    // FIXME: This implementation should be replaced so that instead of going to the
    //        consensus nodes we go to the mirror nodes instead. The problem is that
    //        the mirror nodes need to have the ability to give me the **CURRENT**
    //        account balance *and* the account balance for any given block.
    this.logger.trace(
      'getBalance(account=%s, blockNumber=%s)',
      account,
      blockNumber
    );
    try {
      const weibars = await this.nodeClient.getAccountBalanceInWeiBar(account);
      return EthImpl.prepend0x(weibars.toString(16));
    } catch (e: any) {
      // handle INVALID_ACCOUNT_ID
      if (e?.status?._code === Status.InvalidAccountId._code) {
        this.logger.debug('Unable to find account %s in block "%s", returning 0x0 balance', account, blockNumber);
        return EthImpl.zeroHex;
      }

      this.logger.error(e, 'Error raised during getBalance for account %s', account);
      throw (e);
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
    this.logger.trace(
      'getCode(address=%s, blockNumber=%s)',
      address,
      blockNumber
    );
    try {
      const bytecode = await this.nodeClient.getContractByteCode(0, 0, address);
      return EthImpl.prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      // handle INVALID_CONTRACT_ID
      if (e?.status?._code === Status.InvalidContractId._code) {
        this.logger.debug(
          'Unable find code for contract %s in block "%s", returning 0x0',
          address,
          blockNumber
        );
        return '0x0';
      }

      this.logger.error(e, 'Error raised during getCode for address %s', address);
      throw (e);
    }
  }

  /**
   * Gets the block with the given hash.
   *
   * TODO What do we return if we cannot find the block with that hash?
   * @param hash
   * @param showDetails
   */
  async getBlockByHash(hash: string, showDetails: boolean) {
    this.logger.trace('getBlockByHash(hash=%s, showDetails=%o)', hash, showDetails);
    try {
      return this.getBlock(hash, showDetails);
    } catch (e) {
      this.logger.error(e, 'Failed to retrieve block for hash %s', hash);
      return this.mirrorNode.getBlockByHash(hash, showDetails);
    }
  }

  /**
   * Gets the block by its block number.
   * @param blockNum
   */
  async getBlockByNumber(blockNum: number, showDetails: boolean) {
    this.logger.trace('getBlockByNumber(blockNum=%d, showDetails=%o)', blockNum);
    try {
      return this.getBlock(blockNum, showDetails);
    } catch (e) {
      this.logger.error(e, 'Failed to retrieve block for blockNum %s', blockNum);
      return this.mirrorNode.getBlockByNumber(blockNum);
    }
  }

  /**
   * Gets the number of transactions that have been executed for the given address.
   * This goes to the consensus nodes to determine the ethereumNonce.
   *
   * TODO Should it go against the mirror node instead? Less load on the network vs. latency...
   *
   * @param address
   * @param blockNum
   */
  async getTransactionCount(address: string, blockNum: string): Promise<number> {
    this.logger.trace('getTransactionCount(address=%s, blockNum=%s)', address, blockNum);
    const accountInfo = await this.nodeClient.getAccountInfo(address);

    return Number(accountInfo.ethereumNonce);
  }

  /**
   * Submits a transaction to the network for execution.
   *
   * @param transaction
   */
  async sendRawTransaction(transaction: string): Promise<string> {
    this.logger.trace('sendRawTransaction(transaction=%s)', transaction);
    try {
      // Convert from 0xabc format into a raw Uint8Array of bytes and execute the transaction
      const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction), 'hex');
      const contractExecuteResponse = await this.nodeClient.submitEthereumTransaction(transactionBuffer);

      // Wait for the record from the execution.
      const record = await this.nodeClient.getRecord(contractExecuteResponse);
      if (record.ethereumHash == null) {
        throw new Error(
          'The ethereumHash can never be null for an ethereum transaction, and yet it was!!'
        );
      }
      const txHash = EthImpl.prepend0x(
        Buffer.from(record.ethereumHash).toString('hex')
      );

      // If the transaction succeeded, create a new block for the transaction.
      const mostRecentBlock = await this.mirrorNode.getMostRecentBlock();
      this.logger.debug('mostRecentBlock=%o', mostRecentBlock);
      let block = mostRecentBlock;
      if (record.receipt.status == Status.Success) {
        block = new Block(mostRecentBlock, txHash);
        this.mirrorNode.storeBlock(block);
      }

      // Create a receipt. Register the receipt in the cache and return the tx hash
      if (block == null) {
        this.logger.error('Failed to get a block for transaction');
        return '';
      }

      const receipt = new Receipt(txHash, record, block);
      cache.set(txHash, receipt);
      return txHash;
    } catch (e) {
      this.logger.error(
        e,
        'Failed to handle sendRawTransaction cleanly for transaction %s',
        transaction
      );
      throw e;
    }
  }

  /**
   * Execute a free contract call query.
   *
   * @param call
   * @param blockParam
   */
  async call(call: any, blockParam: string) {
    // FIXME: In the future this will be implemented by making calls to the mirror node. For the
    //        time being we'll eat the cost and ask the main consensus nodes instead.

    this.logger.trace('call(hash=%o, blockParam=%s)', call, blockParam);
    // The "to" address must always be 42 chars.
    if (call.to.length != 42) {
      throw new Error(
        "Invalid Contract Address: '" +
          call.to +
          "'. Expected length of 42 chars but was" +
          call.to.length
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
      const contractCallResponse = await this.nodeClient.submitContractCallQuery(call.to, call.data, gas);

      // FIXME Is this right? Maybe so?
      return EthImpl.prepend0x(
        Buffer.from(contractCallResponse.asBytes()).toString('hex')
      );
    } catch (e) {
      this.logger.error(
        e,
        'Failed to handle call cleanly for transaction %s',
        call
      );
      throw e;
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

    return new Transaction({
      accessList: contractResult.access_list,
      blockHash: contractResult.block_hash.substring(0, 66),
      blockNumber: contractResult.block_number,
      chainId: contractResult.chain_id,
      from: contractResult.from.substring(0, 42),
      gas: contractResult.gas_used,
      gasPrice: contractResult.gas_price,
      hash: contractResult.hash.substring(0, 66),
      input: contractResult.function_parameters,
      maxPriorityFeePerGas: contractResult.max_priority_fee_per_gas,
      maxFeePerGas: contractResult.max_fee_per_gas,
      nonce: contractResult.nonce,
      r: contractResult.r.substring(0, 66),
      s: contractResult.s.substring(0, 66),
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
    // FIXME: This should go to the mirror node. For now we have an in memory map we
    //        grab receipts from for each tx that was executed. Even in the full implementation
    //        we will want to use the cache as an LRU to avoid hammering the mirror node more
    //        than needed, since the receipt is an immutable type. But the cache should be in the
    //        mirror node connector, rather than here.
    this.logger.trace('getTransactionReceipt(hash=%s)', hash);
    try {
      // Lookup the receipt in the cache.
      const receipt = cache.get(hash);

      if (!receipt) {
        // FIXME: if it wasn't in the cache, go to the mirror node. If it isn't there either,
        //        then return null.
        this.logger.debug(
          'Did not find the receipt for hash %s. Returning null.',
          hash
        );
        return null;
      }

      this.logger.trace('Found a receipt, returning it to the caller');
      return receipt;
    } catch (e) {
      this.logger.error(
        e,
        'Failed to handle getTransactionReceipt cleanly for hash %s',
        hash
      );
    }
  }

  /**
   * Internal helper method that removes the leading 0x if there is one.
   * @param input
   * @private
   */
  private static prune0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex)
      ? input.substring(2)
      : input;
  }

  /**
   * Internal helper method that prepends a leading 0x if there isn't one.
   * @param input
   * @private
   */
  private static prepend0x(input: string): string {
    return input.startsWith(EthImpl.emptyHex)
      ? input
      : EthImpl.emptyHex + input;
  }

  /**
   * Gets the block with the given hash.
   * Given an ethereum transaction hash, call the mirror node to get the block info.
   * Then using the block timerange get all contract results to get transaction details.
   * If showDetails is set to true subsequently call mirror node for addtional transaction details
   *
   * TODO What do we return if we cannot find the block with that hash?
   * @param hash
   * @param showDetails
   */
  private async getBlock(hash: number | string, showDetails: boolean): Promise<Block> {

    const blockResponse = await this.mirrorNodeClient.getBlock(hash);
    const timestampRange = blockResponse.timestamp;
    const timestampRangeParams = [`gte:${timestampRange.from}`, `lte:${timestampRange.to}`];
    const contractResults = await this.mirrorNodeClient.getContractResults({ timestamp: timestampRangeParams });

    // loop over contract function results to calculated aggregated datapoints
    let gasUsed = 0;
    let maxGasLimit = 0;
    let timestamp = 0;
    const transactions = [];
    contractResults.results.forEach((result) => {
      maxGasLimit = result.gas_limit > maxGasLimit ? result.gas_limit : maxGasLimit;
      gasUsed += result.gas_used;
      if (timestamp === 0) {
        // The consensus timestamp of the first transaction in the block, with the nanoseconds part omitted.
        timestamp = result.timestamp.substring(0, result.timestamp.indexOf('.')); // mirrorNode response assures format of ssssssssss.nnnnnnnnn
      }

      // transactions.push(this.getTransaction(result.ethereum_hash, showDetails));
    });

    return new Block(null, null, {
      baseFeePerGas: 0,
      difficulty: EthImpl.zeroHex,
      extraData: EthImpl.emptyHex,
      gasLimit: maxGasLimit,
      gasUsed: gasUsed,
      hash: blockResponse.hash,
      logsBloom: blockResponse.logsBloom,
      miner: EthImpl.emptyHex,
      mixHash: EthImpl.emptyHex,
      nonce: EthImpl.emptyHex,
      number: blockResponse.number,
      parentHash: blockResponse.previous_hash,
      receiptsRoot: EthImpl.emptyHex,
      timestamp: timestamp,
      sha3Uncles: EthImpl.emptyArrayHex,
      size: blockResponse.size,
      stateRoot: EthImpl.emptyHex,
      totalDifficulty: EthImpl.zeroHex,
      transactions: transactions,
      transactionsRoot: blockResponse.hash,
      uncles: [],
    });
  }

  private getTransaction(hash: string, showDetails: boolean) {
    // blockHash: DATA, 32 Bytes - hash of the block where this transaction was in. null when its pending.
    // blockNumber: QUANTITY - block number where this transaction was in. null when its pending.
    // from: DATA, 20 Bytes - address of the sender.
    // gas: QUANTITY - gas provided by the sender.
    // gasPrice: QUANTITY - gas price provided by the sender in Wei.
    // hash: DATA, 32 Bytes - hash of the transaction.
    // input: DATA - the data send along with the transaction.
    // nonce: QUANTITY - the number of transactions made by the sender prior to this one.
    // to: DATA, 20 Bytes - address of the receiver. null when its a contract creation transaction.
    // transactionIndex: QUANTITY - integer of the transactions index position in the block. null when its pending.
    // value: QUANTITY - value transferred in Wei.
    // v: QUANTITY - ECDSA recovery id
    // r: DATA, 32 Bytes - ECDSA signature r
    // s: DATA, 32 Bytes - ECDSA signature s
    if (showDetails) {
      // build and return transaction object
      // hopefully we don't have to call mirroNode api/v1/contracts/results/{transactionHash} for every single item
    } else {
      return hash;
    }
  }
}
