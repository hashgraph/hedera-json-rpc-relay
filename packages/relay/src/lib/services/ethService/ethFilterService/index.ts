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
  public readonly ethGetFilterLogs = 'eth_getFilterLogs';

  private readonly common: CommonService;

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, clientCache: ClientCache, common: CommonService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cache = clientCache;
    this.common = common;
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

  public async getFilterLogs(filterId: string, requestIdPrefix?: string | undefined): Promise<any> {
    this.logger.trace(`${requestIdPrefix} getFilterLogs(${filterId})`);
    FilterService.requireFiltersEnabled();

    // TODO: This method only works for filters created with eth_newFilter not for filters created
    // using eth_newBlockFilter or eth_newPendingTransactionFilter, which will return "filter not found".

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = this.cache.get(cacheKey, this.ethGetFilterLogs, requestIdPrefix);

    const logs = this.common.getLogs(null, filter?.params.fromBlock, filter?.params.toBlock, filter?.params.address, filter?.params.topics, requestIdPrefix);

    // TODO: Update filter - Filters expire after 5 minutes of inactivity (no queries)

    return logs;
  }
}
