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
import { Block, CachedBlock } from './model';

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
      const genesisBlock = new CachedBlock(null, null);
      this.storeBlock(genesisBlock);
    }
  }

  public async getFeeHistory(fee: number, _blockCount: number, _newestBlock: string, rewardPercentiles: Array<number> | null) {
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

    const feeHistoryResponse = {
      baseFeePerGasArray: Array(mostRecentBlocks.length).fill('0x' + fee.toString(16)),
      gasUsedRatioArray: Array(mostRecentBlocks.length).fill('0.5'),
      oldestBlockNumber: mostRecentBlocks[0].number
    };

    if (rewardPercentiles) {
      feeHistoryResponse['reward'] = Array(mostRecentBlocks.length).fill(Array(rewardPercentiles.length).fill("0x0"));
    }

    return feeHistoryResponse;
  }

  // FIXME this is for demo/temp purposes, remove it when the mirror node has real blocks
  //       that they get from the main net nodes
  public storeBlock(block: CachedBlock) {
    this.store.set(MirrorNode.MOST_RECENT_BLOCK_NUMBER_KEY, block.getNum());
    this.store.set(MirrorNode.MOST_RECENT_BLOCK_KEY, block);
    this.store.set(block.getNum().toString(), block);
    this.store.set(block.transactionHashes[0], block);
  }

  public async getMostRecentBlockNumber(): Promise<number> {
    // FIXME: Fake implementation for now. Should go to the mirror node.
    this.logger.trace('getMostRecentBlockNumber()');
    const num = this.store.get(MirrorNode.MOST_RECENT_BLOCK_NUMBER_KEY);
    this.logger.debug('Latest block number: %s', num);
    return num === undefined ? 0 : Number(num);
  }

  public async getMostRecentBlock(): Promise<CachedBlock | null> {
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
}
