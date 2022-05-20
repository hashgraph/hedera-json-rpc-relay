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

import { Logger } from "pino";
// Used for temporary purposes to store block info. As the mirror node supports the APIs, we will remove this.
import { Block } from './model';

export class MirrorNode {
  // A FAKE implementation until mirror node is integrated and ready.
  // Keeps all blocks in memory. We're going to do our own bookkeeping
  // to keep track of blocks and only create them once per transaction.
  // So it may have been 20 minutes and if there were no transactions
  // then we don't advance the block list. The first block is block 0,
  // so we can quickly look them up in the array. Yes, we will eventually
  // end up running out of memory.
  private static MOST_RECENT_BLOCK_NUMBER_KEY = "mostRecentBlockNumber";
  private static MOST_RECENT_BLOCK_KEY = "mostRecentBlock";
  private readonly store: Map<string, any> = new Map();


  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;

    // FIXME: Create an empty genesis block (which has no transactions!)
    //        to preload the system.
    if (this.store.has(MirrorNode.MOST_RECENT_BLOCK_KEY)) {
      this.logger.info("Restarting.");
    } else {
      this.logger.info("Fresh start, creating genesis block with no transactions");
      const genesisBlock = new Block(null, null);
      this.storeBlock(genesisBlock);
    }
  }

  public async getFeeHistory(fee : number) {
    // FIXME: This is a fake implementation. It works for now, but should
    //        actually delegate to the mirror node.
    this.logger.trace('getFeeHistory()');

    const mostRecentBlockNumber = await this.getMostRecentBlockNumber();
    this.logger.debug('computing fee history for mostRecentBlockNumber=%d', mostRecentBlockNumber);
    const mostRecentBlocks: Block[] = [];
    for (let blockNumber = Math.max(0, mostRecentBlockNumber - 9); blockNumber <= mostRecentBlockNumber; blockNumber++) {
      const block = await this.getBlockByNumber(blockNumber);
      this.logger.debug("block for %d is %o", blockNumber, block);
      if (block != null) {
        mostRecentBlocks.push(block);
      } else {
        this.logger.error('Error: unable to find block by number %d', blockNumber);
      }
    }
    this.logger.debug('Computing fee history based on the last %d blocks', mostRecentBlocks.length);

    return {
      baseFeePerGas: Array(mostRecentBlocks.length).fill('0x' + fee.toString(16)),
      gasUsedRatio: Array(mostRecentBlocks.length).fill('0.5'),
      oldestBlock: mostRecentBlocks[0].number
    };
  }

  // FIXME this is for demo/temp purposes, remove it when the mirror node has real blocks
  //       that they get from the main net nodes
  public storeBlock(block: Block) {
    this.store.set(MirrorNode.MOST_RECENT_BLOCK_NUMBER_KEY, block.getNum());
    this.store.set(MirrorNode.MOST_RECENT_BLOCK_KEY, block);
    this.store.set(block.getNum().toString(), block);
    this.store.set(block.transactions[0], block);
  }

  public async getMostRecentBlockNumber(): Promise<number> {
    // FIXME: Fake implementation for now. Should go to the mirror node.
    this.logger.trace('getMostRecentBlockNumber()');
    const num = this.store.get(MirrorNode.MOST_RECENT_BLOCK_NUMBER_KEY);
    this.logger.debug('Latest block number: %s', num);
    return num === undefined ? 0 : Number(num);
  }

  public async getMostRecentBlock(): Promise<Block | null> {
    // FIXME: Fake implementation for now. Should go to the mirror node.
    this.logger.trace('getMostRecentBlock()');
    const block = this.store.get(MirrorNode.MOST_RECENT_BLOCK_KEY);
    if (block === undefined) {
      this.logger.debug("No blocks retrievable");
      return null;
    } else {
      this.logger.debug("Retrieved block number: %s", block.getNum());
      return block;
    }
  }

  // TODO: mirror node method is not yet implemented
  public async getBlockByNumber(blockNumber: number): Promise<Block | null> {
    // FIXME: This needs to be reimplemented to go to the mirror node.
    // return this.request(`blocks/${blockNumber}`);
    this.logger.trace('getBlockByNumber(blockNumber=%d)', blockNumber);
    const block = this.store.get(blockNumber.toString());
    return block === undefined ? null : block;
  }

  public async getBlockByHash(hash: string, showDetails: boolean): Promise<Block | null> {
    // FIXME: This needs to be reimplemented to go to the mirror node.
    this.logger.trace('getBlockByHash(hash=%s, showDetails=%o)', hash, showDetails);

    // We don't support this yet, so log a warning in case somebody tries to use it
    // we can learn of that usage.
    if (showDetails) {
      this.logger.warn('getBlockByHash does not yet support "showDetails"');
    }

    // Look up the block number by hash
    const block = this.store.get(hash);
    return block === undefined ? null : block;
  }

  public async getContractResult(hash: string): Promise<any> {
    return {
      'access_list': '0x',
      'amount': 2000000000,
      'block_gas_used': 50000000,
      'block_hash': '0x6ceecd8bb224da491',
      'block_number': 17,
      'bloom': '0x0505',
      'call_result': '0x0606',
      'chain_id': '0x',
      'contract_id': '0.0.5001',
      'created_contract_ids': ['0.0.7001'],
      'error_message': null,
      'from': '0x0000000000000000000000000000000000001f41',
      'function_parameters': '0x0707',
      'gas_limit': 1000000,
      'gas_price': '0x4a817c80',
      'gas_used': 123,
      'hash': '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
      'logs': [
        {
          'address': '0x0000000000000000000000000000000000001389',
          'bloom': '0x0123',
          'contract_id': '0.0.5001',
          'data': '0x0123',
          'index': 0,
          'topics': [
            '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
            '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
            '0xe8d47b56e8cdfa95f871b19d4f50a857217c44a95502b0811a350fec1500dd67'
          ]
        }
      ],
      'max_fee_per_gas': '0x',
      'max_priority_fee_per_gas': '0x',
      'nonce': 1,
      'r': '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
      'result': 'SUCCESS',
      's': '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
      'state_changes': [
        {
          'address': '0x0000000000000000000000000000000000001389',
          'contract_id': '0.0.5001',
          'slot': '0x0000000000000000000000000000000000000000000000000000000000000101',
          'value_read': '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
          'value_written': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
        }
      ],
      'status': '0x1',
      'timestamp': '167654.000123456',
      'to': '0x0000000000000000000000000000000000001389',
      'transaction_index': 1,
      'type': 2,
      'v': 1
    };
  }
}
