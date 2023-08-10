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

import { Logger } from 'pino';
import { ClientCache, MirrorNodeClient } from '../../../clients';
import constants from '../../../constants';
import { IFilterService } from './IFilterService';
import { CommonService } from './../ethCommonService';
import {generateRandomHex} from "../../../../formatters";
import {JsonRpcError, predefined} from "../../../errors/JsonRpcError";
import { Log } from '../../../model';

/**
 * Create a new Filter Service implementation.
 * @param mirrorNodeClient
 * @param logger
 * @param chain
 * @param registry
 * @param clientCache
 */
export class FilterService implements IFilterService {
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
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly cache: ClientCache;
  public readonly ethNewFilter = 'eth_newFilter';
  public readonly ethUninstallFilter = 'eth_uninstallFilter';
  public readonly ethGetFilterChanges = 'eth_getFilterChanges';

  private readonly common: CommonService;
  private readonly supportedTypes;

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, clientCache: ClientCache, common: CommonService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cache = clientCache;
    this.common = common;

    this.supportedTypes = [constants.FILTER.TYPE.LOG, constants.FILTER.TYPE.NEW_BLOCK];
  }

  /**
   * Creates a new filter with the specified type and parameters
   * @param type
   * @param params
   * @param requestIdPrefix
   */
  createFilter(type: string, params: any, requestIdPrefix?: string): string {
    const filterId = generateRandomHex();
    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    this.cache.set(cacheKey, {
      type,
      params,
      lastQueried: null
    }, this.ethNewFilter, constants.FILTER.TTL, requestIdPrefix);
    this.logger.trace(`${requestIdPrefix} created filter with TYPE=${type}, params: ${params}`);
    return filterId;
  }

  /**
   * Checks if the Filter API is enabled
   */
  static requireFiltersEnabled() {
    if (!process.env.FILTER_API_ENABLED || process.env.FILTER_API_ENABLED !== 'true') {
      throw predefined.UNSUPPORTED_METHOD;
    }
  }

  /**
   * Creates a new filter with TYPE=log
   * @param fromBlock
   * @param toBlock
   * @param address
   * @param topics
   * @param requestIdPrefix
   */
  async newFilter(fromBlock: string = 'latest', toBlock: string = 'latest', address?: string, topics?: any[], requestIdPrefix?: string): Promise<string | JsonRpcError> {
    this.logger.trace(`${requestIdPrefix} newFilter(fromBlock=${fromBlock}, toBlock=${toBlock}, address=${address}, topics=${topics})`);
    try {
      FilterService.requireFiltersEnabled();

      if (!(await this.common.validateBlockRangeAndAddTimestampToParams({}, fromBlock, toBlock, requestIdPrefix))) {
        throw predefined.INVALID_BLOCK_RANGE;
      }

      return this.createFilter(constants.FILTER.TYPE.LOG, {
        fromBlock, toBlock, address, topics
      }, requestIdPrefix);
    }
    catch(e) {
      return this.common.genericErrorHandler(e);
    }
  }

  public async uninstallFilter(filterId: string, requestIdPrefix?: string | undefined): Promise<boolean> {
    this.logger.trace(`${requestIdPrefix} uninstallFilter(${filterId})`);
    FilterService.requireFiltersEnabled();

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = this.cache.get(cacheKey, this.ethUninstallFilter, requestIdPrefix);

    if (filter) {
      this.cache.delete(cacheKey, this.ethUninstallFilter, requestIdPrefix);
      return true;
    }

    return false;
  }

  public newPendingTransactionFilter(requestIdPrefix?: string | undefined): JsonRpcError {
    this.logger.trace(`${requestIdPrefix} newPendingTransactionFilter()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  public async getFilterChanges(filterId: string, requestIdPrefix?: string): Promise<string[] | Log[] | JsonRpcError> {
    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = this.cache.get(cacheKey, this.ethGetFilterChanges, requestIdPrefix);

    if (!filter || this.supportedTypes.indexOf(filter.type) === -1) {
      throw predefined.FILTER_NOT_FOUND;
    }

    let result, latestBlockNumber;

    if (filter.type === constants.FILTER.TYPE.LOG) {
      // FIXME implement once https://github.com/hashgraph/hedera-json-rpc-relay/pull/1624 is merged
    }
    else if (filter.type === constants.FILTER.TYPE.NEW_BLOCK) {
      const fromBlock = filter.lastQueried || filter.params.blockAtCreation;
      result = await this.mirrorNodeClient.getBlocks([`gte:${fromBlock}`], undefined, {
        order: 'asc'
      });
      if (result?.blocks && result.blocks.length) {
        latestBlockNumber = Number(result.blocks[result.blocks.length - 1].number);
        result = result.blocks.map(r => r.hash);
      }
      else {
        result = [];
        const latestBlock = await this.common.getLatestBlockNumber(requestIdPrefix);
        latestBlockNumber = Number(latestBlock);
      }
    }

    //update filter to refresh TTL and set lastQueried block number
    this.cache.set(cacheKey, {
      type: filter.type,
      params: filter.params,
      lastQueried: latestBlockNumber
    }, this.ethGetFilterChanges, constants.FILTER.TTL, requestIdPrefix);

    return result;
  }
}
