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
  AccountId, AccountInfoQuery,
  Client,
  ContractByteCodeQuery,
  ContractCallQuery,
  EthereumTransaction,
  ExchangeRates,
  FileContentsQuery,
  ContractId,
  HbarUnit,
  Status
} from '@hashgraph/sdk';
import {Logger} from "pino";
import {Block, Receipt, Transaction} from './model';
import {MirrorNode} from "./mirrorNode";
import {MirrorNodeClient} from "./clients";

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

  /**
   * The client to use for connecting to the main consensus network. The account
   * associated with this client will pay for all operations on the main network.
   *
   * @private
   */
  private readonly clientMain: Client;

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
  private readonly logger:Logger;

  /**
   * The ID of the chain, as a hex string, as it would be returned in a JSON-RPC call.
   * @private
   */
  private readonly chain:string;

  /**
   * Create a new Eth implementation.
   * @param clientMain
   * @param mirrorNode
   * @param logger
   */
  constructor(clientMain:Client, mirrorNode:MirrorNode, mirrorNodeClient:MirrorNodeClient, logger:Logger) {
    this.clientMain = clientMain;
    this.mirrorNode = mirrorNode;
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;

    // Compute the chainId
    // FIXME: Should default to a "dev net" number. Is this it?
    const configuredChainId = process.env.CHAIN_ID || '298';
    this.chain = EthImpl.prepend0x(Number(configuredChainId).toString(16));
    this.logger.info("Running with chainId=%s", this.chain);
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
  async feeHistory() {
    this.logger.trace('feeHistory()');
    try {
      const feeWeibars = await this.getFeeWeibars();

      return await this.mirrorNode.getFeeHistory(feeWeibars);
    } catch (e) {
      this.logger.trace(e);
    }
  }

  private async getFeeWeibars() {
    const exchangeFileBytes = await (new FileContentsQuery()
        .setFileId("0.0.112")
        .execute(this.clientMain));

    const exchangeRates = ExchangeRates.fromBytes(exchangeFileBytes);

    //FIXME retrieve fee from fee API when released
    const contractTransactionGas = 853454;

    //contractTransactionGas is in tinycents * 1000, so the final multiplier is truncated by 3 zeroes for
    // the conversion to weibars
    const weibars = Math.ceil(contractTransactionGas / exchangeRates.currentRate.cents *
        exchangeRates.currentRate.hbars * 10_000_000);
    return weibars;
  }

  /**
   * Gets the most recent block number.
   */
  async blockNumber() {
    this.logger.trace('blockNumber()');
    return await this.mirrorNode.getMostRecentBlockNumber();
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
    return 0x10000;
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
    return '0x0';
  }

  /**
   * Always returns '0x0'. There are no uncles in Hedera.
   */
  async getUncleCountByBlockNumber() {
    this.logger.trace('getUncleCountByBlockNumber()');
    return '0x0';
  }

  /**
   * TODO Needs docs, or be removed?
   */
  async hashrate() {
    this.logger.trace('hashrate()');
    return '0x0';
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
    this.logger.trace('getBalance(account=%s, blockNumber=%s)', account, blockNumber);
    try {
      const balance = await (new AccountBalanceQuery()
          .setAccountId(EthImpl.toAccountId(account)))
          .execute(this.clientMain);

      const weibars = balance.hbars
          .to(HbarUnit.Tinybar)
          .multipliedBy(10_000_000_000);

      return EthImpl.prepend0x(weibars.toString(16));
    } catch (e: any) {
      // handle INVALID_ACCOUNT_ID
      if (e?.status?._code === Status.InvalidAccountId._code) {
        this.logger.debug('Unable to find account %s in block "%s", returning 0x0 balance', account, blockNumber);
        return '0x0';
      }

      this.logger.error(e, 'Error raised during getBalance for account %s', account);
      throw(e);
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
      const bytecode = await (new ContractByteCodeQuery()
          .setContractId(ContractId.fromEvmAddress(0, 0, address))
          .execute(this.clientMain));

      return EthImpl.prepend0x(Buffer.from(bytecode).toString('hex'));
    } catch (e: any) {
      // handle INVALID_CONTRACT_ID
      if (e?.status?._code === Status.InvalidContractId._code) {
        this.logger.debug('Unable find code for contract %s in block "%s", returning 0x0', address, blockNumber);
        return '0x0';
      }

      this.logger.error(e, 'Error raised during getCode for address %s', address);
      throw(e);
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
    return await this.mirrorNode.getBlockByHash(hash, showDetails);
  }

  /**
   * Gets the block by its block number.
   * @param blockNum
   */
  async getBlockByNumber(blockNum: number) {
    this.logger.trace('getBlockByNumber(blockNum=%d)', blockNum);
    return await this.mirrorNode.getBlockByNumber(blockNum);
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
    const accountInfo = await (new AccountInfoQuery()
        .setAccountId(EthImpl.toAccountId(address)))
        .execute(this.clientMain);

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
      const transactionBuffer = Buffer.from(EthImpl.prune0x(transaction),'hex');
      const contractExecuteResponse = await (new EthereumTransaction()
          .setEthereumData(transactionBuffer))
          .execute(this.clientMain);

      // Wait for the record from the execution.
      const record = await contractExecuteResponse.getRecord(this.clientMain);
      if (record.ethereumHash == null) {
        throw new Error("The ethereumHash can never be null for an ethereum transaction, and yet it was!!");
      }
      const txHash = EthImpl.prepend0x(Buffer.from(record.ethereumHash).toString('hex'));

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
        this.logger.error("Failed to get a block for transaction");
        return "";
      }

      const receipt = new Receipt(txHash, record, block);
      cache.set(txHash, receipt);
      return txHash;
    } catch (e) {
      this.logger.error(e, 'Failed to handle sendRawTransaction cleanly for transaction %s', transaction);
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
      throw new Error("Invalid Contract Address: '" + call.to + "'. Expected length of 42 chars but was" + call.to.length);
    }

    try {
      // Get a reasonable value for "gas" if it is not specified.
      const gas: number = call.gas == null
          ? 400_000
          : typeof call.gas === 'string' ? Number(call.gas) : call.gas;

      // Execute the call and get the response
      const contract = EthImpl.prune0x(call.to);
      const callData = EthImpl.prune0x(call.data);
      this.logger.debug('Making eth_call on contract %o with gas %d and call data "%s"', contract, gas, callData);
      const contractId = contract.startsWith("00000000000")
          ? ContractId.fromSolidityAddress(contract)
          : ContractId.fromEvmAddress(0, 0, contract);
      const contractCallResponse = await (new ContractCallQuery()
          .setContractId(contractId)
          .setFunctionParameters(Buffer.from(callData, 'hex'))
          .setGas(gas))
          .execute(this.clientMain);

      // FIXME Is this right? Maybe so?
      return EthImpl.prepend0x(Buffer.from(contractCallResponse.asBytes()).toString('hex'));
    } catch (e) {
      this.logger.error(e, 'Failed to handle call cleanly for transaction %s', call);
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
    // const contractResult = await this.mirrorNodeClient.getContractResult(hash);
    const contractResult = await this.mirrorNode.getContractResult(hash);
    return new Transaction({
      accessList: contractResult.access_list,
      blockHash: contractResult.block_hash,
      blockNumber: contractResult.block_number,
      chainId: contractResult.chain_id,
      from: contractResult.from,
      gas: contractResult.gas_used,
      gasPrice: contractResult.gas_price,
      hash: contractResult.hash,
      input: contractResult.function_parameters,
      maxPriorityFeePerGas: contractResult.max_priority_fee_per_gas,
      maxFeePerGas: contractResult.max_fee_per_gas,
      nonce: contractResult.nonce,
      r: contractResult.r,
      s: contractResult.s,
      to: contractResult.to,
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
        this.logger.debug("Did not find the receipt for hash %s. Returning null.", hash);
        return null;
      }

      this.logger.trace("Found a receipt, returning it to the caller");
      return receipt;
    } catch (e) {
      this.logger.error(e, 'Failed to handle getTransactionReceipt cleanly for hash %s', hash);
    }
  }

  /**
   * Internal helper method that removes the leading 0x if there is one.
   * @param input
   * @private
   */
  private static prune0x(input:string):string {
    return input.startsWith('0x')
        ? input.substring(2)
        : input;
  }

  /**
   * Internal helper method that prepends a leading 0x if there isn't one.
   * @param input
   * @private
   */
  private static prepend0x(input:string):string {
    return input.startsWith('0x')
        ? input
        : '0x' + input;
  }

  /**
   * Internal helper method that converts an ethAddress (with, or without a leading 0x)
   * into an alias friendly AccountId.
   * @param ethAddress
   * @private
   */
  private static toAccountId(ethAddress:string) {
    return AccountId.fromEvmAddress(0, 0, EthImpl.prune0x(ethAddress));
  }
}