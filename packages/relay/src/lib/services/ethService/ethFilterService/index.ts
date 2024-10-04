/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { CommonService } from '../ethCommonService';
import { generateRandomHex } from '../../../../formatters';
import { JsonRpcError, predefined } from '../../../errors/JsonRpcError';
import { Log } from '../../../model';
import { CacheService } from '../../cacheService/cacheService';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { RequestDetails } from '../../../types';

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
  private readonly cacheService: CacheService;
  public readonly ethNewFilter = 'eth_newFilter';
  public readonly ethUninstallFilter = 'eth_uninstallFilter';
  public readonly ethGetFilterLogs = 'eth_getFilterLogs';
  public readonly ethGetFilterChanges = 'eth_getFilterChanges';

  private readonly common: CommonService;
  private readonly supportedTypes: string[];

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, cacheService: CacheService, common: CommonService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cacheService = cacheService;
    this.common = common;

    this.supportedTypes = [constants.FILTER.TYPE.LOG, constants.FILTER.TYPE.NEW_BLOCK];
  }

  /**
   * Creates a new filter with the specified type and parameters
   * @param type
   * @param params
   * @param requestDetails
   */
  async createFilter(type: string, params: any, requestDetails: RequestDetails): Promise<string> {
    const filterId = generateRandomHex();
    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    await this.cacheService.set(
      cacheKey,
      {
        type,
        params,
        lastQueried: null,
      },
      this.ethNewFilter,
      requestDetails,
      constants.FILTER.TTL,
    );
    this.logger.trace(`${requestDetails.formattedRequestId} created filter with TYPE=${type}, params: ${params}`);
    return filterId;
  }

  /**
   * Checks if the Filter API is enabled
   */
  static requireFiltersEnabled(): void {
    if (!ConfigService.get('FILTER_API_ENABLED')) {
      throw predefined.UNSUPPORTED_METHOD;
    }
  }

  /**
   * Creates a new filter with TYPE=log
   * @param fromBlock
   * @param toBlock
   * @param address
   * @param topics
   * @param requestDetails
   */
  async newFilter(
    fromBlock: string = 'latest',
    toBlock: string = 'latest',
    requestDetails: RequestDetails,
    address?: string,
    topics?: any[],
  ): Promise<string> {
    const requestIdPrefix = requestDetails.formattedRequestId;
    this.logger.trace(
      `${requestIdPrefix} newFilter(fromBlock=${fromBlock}, toBlock=${toBlock}, address=${address}, topics=${topics})`,
    );
    try {
      FilterService.requireFiltersEnabled();

      if (
        !(await this.common.validateBlockRangeAndAddTimestampToParams({}, fromBlock, toBlock, requestDetails, address))
      ) {
        throw predefined.INVALID_BLOCK_RANGE;
      }

      return await this.createFilter(
        constants.FILTER.TYPE.LOG,
        {
          fromBlock: fromBlock === 'latest' ? await this.common.getLatestBlockNumber(requestDetails) : fromBlock,
          toBlock,
          address,
          topics,
        },
        requestDetails,
      );
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }
  }

  async newBlockFilter(requestDetails: RequestDetails): Promise<string> {
    const requestIdPrefix = requestDetails.formattedRequestId;
    this.logger.trace(`${requestIdPrefix} newBlockFilter()`);
    try {
      FilterService.requireFiltersEnabled();
      return await this.createFilter(
        constants.FILTER.TYPE.NEW_BLOCK,
        {
          blockAtCreation: await this.common.getLatestBlockNumber(requestDetails),
        },
        requestDetails,
      );
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }
  }

  public async uninstallFilter(filterId: string, requestDetails: RequestDetails): Promise<boolean> {
    const requestIdPrefix = requestDetails.formattedRequestId;
    this.logger.trace(`${requestIdPrefix} uninstallFilter(${filterId})`);
    FilterService.requireFiltersEnabled();

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = await this.cacheService.getAsync(cacheKey, this.ethUninstallFilter, requestDetails);

    if (filter) {
      await this.cacheService.delete(cacheKey, this.ethUninstallFilter, requestDetails);
      return true;
    }

    return false;
  }

  public newPendingTransactionFilter(requestDetails: RequestDetails): JsonRpcError {
    this.logger.trace(`${requestDetails.formattedRequestId} newPendingTransactionFilter()`);
    return predefined.UNSUPPORTED_METHOD;
  }

  public async getFilterLogs(filterId: string, requestDetails: RequestDetails): Promise<any> {
    this.logger.trace(`${requestDetails.formattedRequestId} getFilterLogs(${filterId})`);
    FilterService.requireFiltersEnabled();

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = await this.cacheService.getAsync(cacheKey, this.ethGetFilterLogs, requestDetails);
    if (filter?.type != constants.FILTER.TYPE.LOG) {
      throw predefined.FILTER_NOT_FOUND;
    }

    return await this.common.getLogs(
      null,
      filter?.params.fromBlock,
      filter?.params.toBlock,
      filter?.params.address,
      filter?.params.topics,
      requestDetails,
    );
  }

  public async getFilterChanges(filterId: string, requestDetails: RequestDetails): Promise<string[] | Log[]> {
    this.logger.trace(`${requestDetails.formattedRequestId} getFilterChanges(${filterId})`);
    FilterService.requireFiltersEnabled();

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = await this.cacheService.getAsync(cacheKey, this.ethGetFilterChanges, requestDetails);

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
        requestDetails,
      );

      // get the latest block number and add 1 to exclude current results from the next response because
      // the mirror node query executes "gte" not "gt"
      latestBlockNumber =
        Number(
          result.length
            ? result[result.length - 1].blockNumber
            : await this.common.getLatestBlockNumber(requestDetails),
        ) + 1;
    } else if (filter.type === constants.FILTER.TYPE.NEW_BLOCK) {
      result = await this.mirrorNodeClient.getBlocks(
        requestDetails,
        [`gt:${filter.lastQueried || filter.params.blockAtCreation}`],
        undefined,
        {
          order: 'asc',
        },
      );

      latestBlockNumber = Number(
        result?.blocks?.length
          ? result.blocks[result.blocks.length - 1].number
          : await this.common.getLatestBlockNumber(requestDetails),
      );

      result = result?.blocks?.map((r) => r.hash) || [];
    } else if (this.supportedTypes.indexOf(filter.type) === -1) {
      throw predefined.UNSUPPORTED_METHOD;
    }

    // update filter to refresh TTL and set lastQueried block number
    await this.cacheService.set(
      cacheKey,
      {
        type: filter.type,
        params: filter.params,
        lastQueried: latestBlockNumber,
      },
      this.ethGetFilterChanges,
      requestDetails,
      constants.FILTER.TTL,
    );

    return result;
  }
}
