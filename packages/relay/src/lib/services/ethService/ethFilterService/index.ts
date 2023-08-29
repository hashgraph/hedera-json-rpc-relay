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
import { MirrorNodeClient } from '../../../clients';
import constants from '../../../constants';
import { IFilterService } from './IFilterService';
import { CommonService } from './../ethCommonService';
import {generateRandomHex} from "../../../../formatters";
import {JsonRpcError, predefined} from "../../../errors/JsonRpcError";
import { Log } from '../../../model';
import { CacheService } from '../../cacheService/cacheService';
import {Registry} from "prom-client";

/**
 * Create a new Filter Service implementation.
 * @param mirrorNodeClient
 * @param logger
 * @param chain
 * @param registry
 * @param cacheService
 */
export class FilterService implements IFilterService {
  /**
   * The interface through which we interact with the mirror node
   * @private
   */
  public readonly mirrorNodeClient: MirrorNodeClient;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  public readonly logger: Logger;

  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  public readonly cacheService: CacheService;
  public readonly ethNewFilter = 'eth_newFilter';
  public readonly ethUninstallFilter = 'eth_uninstallFilter';
  public readonly ethGetFilterLogs = 'eth_getFilterLogs';
  public readonly ethGetFilterChanges = 'eth_getFilterChanges';

  public readonly common: CommonService;
  private readonly supportedTypes;

  constructor(logger: Logger, register: Registry, useSharedCache: boolean) {

    // Create new instance of cacheService with shared=true and pass it to the other services
    this.cacheService = new CacheService(logger.child({ name: 'cache-service' }), register, useSharedCache);
    this.mirrorNodeClient = new MirrorNodeClient(
        process.env.MIRROR_NODE_URL || '',
        logger.child({ name: `mirror-node` }),
        register,
        this.cacheService,
        undefined,
        process.env.MIRROR_NODE_URL_WEB3 || process.env.MIRROR_NODE_URL || ''
    );
    this.common = new CommonService(this.mirrorNodeClient, logger, this.cacheService);
    this.logger = logger;
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
    this.cacheService.set(cacheKey, {
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
        fromBlock: fromBlock === 'latest' ? await this.common.getLatestBlockNumber(requestIdPrefix) : fromBlock,
        toBlock,
        address,
        topics
      }, requestIdPrefix);
    }
    catch(e) {
      return this.common.genericErrorHandler(e);
    }
  }

  async newBlockFilter(requestIdPrefix?: string): Promise<string | JsonRpcError> {
    this.logger.trace(`${requestIdPrefix} newBlockFilter()`);
    try {
      FilterService.requireFiltersEnabled();
      return this.createFilter(constants.FILTER.TYPE.NEW_BLOCK, {
        blockAtCreation: await this.common.getLatestBlockNumber(requestIdPrefix)
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
    const filter = await this.cacheService.get(cacheKey, this.ethUninstallFilter, requestIdPrefix);

    if (filter) {
      this.cacheService.delete(cacheKey, this.ethUninstallFilter, requestIdPrefix);
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

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = await this.cacheService.get(cacheKey, this.ethGetFilterLogs, requestIdPrefix);
    if (filter?.type != constants.FILTER.TYPE.LOG) {
      throw predefined.FILTER_NOT_FOUND;
    }

    return this.common.getLogs(
      null,
      filter?.params.fromBlock,
      filter?.params.toBlock,
      filter?.params.address,
      filter?.params.topics,
      requestIdPrefix
    );
  }

  public async getFilterChanges(filterId: string, requestIdPrefix?: string): Promise<string[] | Log[] | JsonRpcError> {
    this.logger.trace(`${requestIdPrefix} getFilterChanges(${filterId})`);
    FilterService.requireFiltersEnabled();

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = await this.cacheService.get(cacheKey, this.ethGetFilterChanges, requestIdPrefix);

    if (!filter) {
      throw predefined.FILTER_NOT_FOUND;
    }

    let result, latestBlockNumber;
    if (filter.type === constants.FILTER.TYPE.LOG) {
      result = await this.common.getLogs(
        null,
        filter?.lastQueried || filter?.params.fromBlock,
        filter?.params.toBlock,
        filter?.params.address,
        filter?.params.topics,
        requestIdPrefix
      );

      // get the latest block number and add 1 to exclude current results from the next response because
      // the mirror node query executes "gte" not "gt"
      latestBlockNumber = Number(
        result.length ? result[result.length - 1].blockNumber : await this.common.getLatestBlockNumber(requestIdPrefix)
      ) + 1;
    } else if (filter.type === constants.FILTER.TYPE.NEW_BLOCK) {
      result = await this.mirrorNodeClient.getBlocks([
        `gt:${filter.lastQueried || filter.params.blockAtCreation}`
      ], undefined, {
        order: 'asc'
      });

      latestBlockNumber = Number(
        result?.blocks?.length ? result.blocks[result.blocks.length - 1].number : await this.common.getLatestBlockNumber(requestIdPrefix)
      );

      result = result?.blocks?.map(r => r.hash) || [];
    } else if (this.supportedTypes.indexOf(filter.type) === -1) {
      throw predefined.UNSUPPORTED_METHOD;
    }

    // update filter to refresh TTL and set lastQueried block number
    this.cacheService.set(cacheKey, {
      type: filter.type,
      params: filter.params,
      lastQueried: latestBlockNumber
    }, this.ethGetFilterChanges, constants.FILTER.TTL, requestIdPrefix);

    return result;
  }
}
