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

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import * as _ from 'lodash';
import { Logger } from 'pino';

import { nullableNumberTo0x, numberTo0x, parseNumericEnvVar, toHash32 } from '../../../../formatters';
import { MirrorNodeClient } from '../../../clients';
import constants from '../../../constants';
import { JsonRpcError, predefined } from '../../../errors/JsonRpcError';
import { MirrorNodeClientError } from '../../../errors/MirrorNodeClientError';
import { SDKClientError } from '../../../errors/SDKClientError';
import { EthImpl } from '../../../eth';
import { Log } from '../../../model';
import { RequestDetails } from '../../../types';
import { CacheService } from '../../cacheService/cacheService';
import { ICommonService } from './ICommonService';

/**
 * Create a new Common Service implementation.
 * @param mirrorNodeClient
 * @param logger
 * @param chain
 * @param registry
 * @param cacheService
 */
export class CommonService implements ICommonService {
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

  public static readonly blockLatest = 'latest';
  public static readonly blockEarliest = 'earliest';
  public static readonly blockPending = 'pending';
  public static readonly blockSafe = 'safe';
  public static readonly blockFinalized = 'finalized';
  public static readonly isDevMode = ConfigService.get('DEV_MODE');

  // function callerNames
  public static readonly latestBlockNumber = 'getLatestBlockNumber';

  private readonly maxBlockRange = parseNumericEnvVar('MAX_BLOCK_RANGE', 'MAX_BLOCK_RANGE');
  private readonly ethBlockNumberCacheTtlMs = parseNumericEnvVar(
    'ETH_BLOCK_NUMBER_CACHE_TTL_MS',
    'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT',
  );

  private getLogsBlockRangeLimit() {
    return parseNumericEnvVar('ETH_GET_LOGS_BLOCK_RANGE_LIMIT', 'DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT');
  }

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, cacheService: CacheService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cacheService = cacheService;
  }

  public static blockTagIsLatestOrPendingStrict(tag: string | null): boolean {
    return tag === CommonService.blockLatest || tag === CommonService.blockPending;
  }

  public blockTagIsLatestOrPending = (tag): boolean => {
    return (
      tag == null ||
      tag === CommonService.blockLatest ||
      tag === CommonService.blockPending ||
      tag === CommonService.blockSafe ||
      tag === CommonService.blockFinalized
    );
  };

  public async validateBlockRangeAndAddTimestampToParams(
    params: any,
    fromBlock: string,
    toBlock: string,
    requestDetails: RequestDetails,
    address?: string | string[] | null,
  ) {
    if (this.blockTagIsLatestOrPending(toBlock)) {
      toBlock = CommonService.blockLatest;
    }

    const latestBlockNumber: string = await this.getLatestBlockNumber(requestDetails);

    // toBlock is a number and is less than the current block number and fromBlock is not defined
    if (Number(toBlock) < Number(latestBlockNumber) && !fromBlock) {
      throw predefined.MISSING_FROM_BLOCK_PARAM;
    }

    if (this.blockTagIsLatestOrPending(fromBlock)) {
      fromBlock = CommonService.blockLatest;
    }

    let fromBlockNum = 0;
    let toBlockNum;
    params.timestamp = [];

    const fromBlockResponse = await this.getHistoricalBlockResponse(requestDetails, fromBlock, true);
    if (!fromBlockResponse) {
      return false;
    }

    params.timestamp.push(`gte:${fromBlockResponse.timestamp.from}`);

    if (fromBlock === toBlock) {
      params.timestamp.push(`lte:${fromBlockResponse.timestamp.to}`);
    } else {
      fromBlockNum = parseInt(fromBlockResponse.number);
      const toBlockResponse = await this.getHistoricalBlockResponse(requestDetails, toBlock, true);
      if (toBlockResponse != null) {
        params.timestamp.push(`lte:${toBlockResponse.timestamp.to}`);
        toBlockNum = parseInt(toBlockResponse.number);
      }

      if (fromBlockNum > toBlockNum) {
        return false;
      }

      const blockRangeLimit = this.getLogsBlockRangeLimit();
      // Increasing it to more then one address may degrade mirror node performance
      // when addresses contains many log events.
      const isSingleAddress = Array.isArray(address)
        ? address.length === 1
        : typeof address === 'string' && address !== '';
      if (!isSingleAddress && toBlockNum - fromBlockNum > blockRangeLimit) {
        throw predefined.RANGE_TOO_LARGE(blockRangeLimit);
      }
    }

    return true;
  }

  /**
   * returns the block response
   * otherwise return undefined.
   *
   * @param requestDetails
   * @param blockNumberOrTagOrHash
   * @param returnLatest
   */
  public async getHistoricalBlockResponse(
    requestDetails: RequestDetails,
    blockNumberOrTagOrHash?: string | null,
    returnLatest?: boolean,
  ): Promise<any> {
    if (!returnLatest && this.blockTagIsLatestOrPending(blockNumberOrTagOrHash)) {
      if (this.logger.isLevelEnabled('debug')) {
        this.logger.debug(
          `${requestDetails.formattedRequestId} Detected a contradiction between blockNumberOrTagOrHash and returnLatest. The request does not target the latest block, yet blockNumberOrTagOrHash representing latest or pending: returnLatest=${returnLatest}, blockNumberOrTagOrHash=${blockNumberOrTagOrHash}`,
        );
      }
      return null;
    }

    if (blockNumberOrTagOrHash === EthImpl.emptyHex) {
      if (this.logger.isLevelEnabled('debug')) {
        this.logger.debug(
          `${requestDetails.formattedRequestId} Invalid input detected in getHistoricalBlockResponse(): blockNumberOrTagOrHash=${blockNumberOrTagOrHash}.`,
        );
      }
      return null;
    }

    const blockNumber = Number(blockNumberOrTagOrHash);
    if (blockNumberOrTagOrHash != null && blockNumberOrTagOrHash.length < 32 && !isNaN(blockNumber)) {
      const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestDetails);
      const latestBlock = latestBlockResponse.blocks[0];
      if (blockNumber > latestBlock.number + this.maxBlockRange) {
        return null;
      }
    }

    if (blockNumberOrTagOrHash == null || this.blockTagIsLatestOrPending(blockNumberOrTagOrHash)) {
      const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestDetails);
      return latestBlockResponse.blocks[0];
    }

    if (blockNumberOrTagOrHash == CommonService.blockEarliest) {
      return await this.mirrorNodeClient.getBlock(0, requestDetails);
    }

    if (blockNumberOrTagOrHash.length < 32) {
      return await this.mirrorNodeClient.getBlock(Number(blockNumberOrTagOrHash), requestDetails);
    }

    return await this.mirrorNodeClient.getBlock(blockNumberOrTagOrHash, requestDetails);
  }

  /**
   * Gets the most recent block number.
   */
  public async getLatestBlockNumber(requestDetails: RequestDetails): Promise<string> {
    // check for cached value
    const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;
    const blockNumberCached = await this.cacheService.getAsync(
      cacheKey,
      CommonService.latestBlockNumber,
      requestDetails,
    );

    if (blockNumberCached) {
      if (this.logger.isLevelEnabled('trace')) {
        this.logger.trace(
          `${requestDetails.formattedRequestId} returning cached value ${cacheKey}:${JSON.stringify(
            blockNumberCached,
          )}`,
        );
      }
      return blockNumberCached;
    }

    const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestDetails);
    const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
    if (Array.isArray(blocks) && blocks.length > 0) {
      const currentBlock = numberTo0x(blocks[0].number);
      // save the latest block number in cache
      await this.cacheService.set(
        cacheKey,
        currentBlock,
        CommonService.latestBlockNumber,
        requestDetails,
        this.ethBlockNumberCacheTtlMs,
      );

      return currentBlock;
    }

    throw predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
  }

  public genericErrorHandler(error: any, logMessage?: string) {
    if (logMessage) {
      this.logger.error(error, logMessage);
    } else {
      this.logger.error(error);
    }

    if (error instanceof SDKClientError && error.isGrpcTimeout()) {
      throw predefined.REQUEST_TIMEOUT;
    }

    if (error instanceof JsonRpcError) {
      throw error;
    }
    throw predefined.INTERNAL_ERROR(error.message.toString());
  }

  public async validateBlockHashAndAddTimestampToParams(
    params: any,
    blockHash: string,
    requestDetails: RequestDetails,
  ) {
    try {
      const block = await this.mirrorNodeClient.getBlock(blockHash, requestDetails);
      if (block) {
        params.timestamp = [`gte:${block.timestamp.from}`, `lte:${block.timestamp.to}`];
      } else {
        return false;
      }
    } catch (e: any) {
      if (e instanceof MirrorNodeClientError && e.isNotFound()) {
        return false;
      }

      throw e;
    }

    return true;
  }

  public addTopicsToParams(params: any, topics: any[] | null) {
    if (topics) {
      for (let i = 0; i < topics.length; i++) {
        if (!_.isNil(topics[i])) {
          params[`topic${i}`] = topics[i];
        }
      }
    }
  }

  public async getLogsByAddress(address: string | string[], params: any, requestDetails: RequestDetails) {
    const addresses = Array.isArray(address) ? address : [address];
    const logPromises = addresses.map((addr) =>
      this.mirrorNodeClient.getContractResultsLogsByAddress(addr, requestDetails, params, undefined),
    );

    const logResults = await Promise.all(logPromises);
    const logs = logResults.flatMap((logResult) => (logResult ? logResult : []));
    logs.sort((a: any, b: any) => {
      return a.timestamp >= b.timestamp ? 1 : -1;
    });

    return logs;
  }

  public async getLogsWithParams(
    address: string | string[] | null,
    params: any,
    requestDetails: RequestDetails,
  ): Promise<Log[]> {
    const EMPTY_RESPONSE = [];

    let logResults;
    if (address) {
      logResults = await this.getLogsByAddress(address, params, requestDetails);
    } else {
      logResults = await this.mirrorNodeClient.getContractResultsLogsWithRetry(requestDetails, params);
    }

    if (!logResults) {
      return EMPTY_RESPONSE;
    }

    const logs: Log[] = [];
    for (const log of logResults) {
      if (
        log.transaction_index == null ||
        log.block_number == null ||
        log.index == null ||
        log.block_hash === EthImpl.emptyHex
      ) {
        if (this.logger.isLevelEnabled('debug')) {
          this.logger.debug(
            `${
              requestDetails.formattedRequestId
            } Log entry is missing required fields: block_number, index, or block_hash is an empty hex (0x). log=${JSON.stringify(
              log,
            )}`,
          );
        }
        throw predefined.INTERNAL_ERROR(
          `The log entry from the remote Mirror Node server is missing required fields. `,
        );
      }

      logs.push(
        new Log({
          address: log.address,
          blockHash: toHash32(log.block_hash),
          blockNumber: numberTo0x(log.block_number),
          data: log.data,
          logIndex: numberTo0x(log.index),
          removed: false,
          topics: log.topics,
          transactionHash: toHash32(log.transaction_hash),
          transactionIndex: numberTo0x(log.transaction_index),
        }),
      );
    }

    return logs;
  }

  public async getLogs(
    blockHash: string | null,
    fromBlock: string | 'latest',
    toBlock: string | 'latest',
    address: string | string[] | null,
    topics: any[] | null,
    requestDetails: RequestDetails,
  ): Promise<Log[]> {
    const EMPTY_RESPONSE = [];
    const params: any = {};

    if (blockHash) {
      if (!(await this.validateBlockHashAndAddTimestampToParams(params, blockHash, requestDetails))) {
        return EMPTY_RESPONSE;
      }
    } else if (
      !(await this.validateBlockRangeAndAddTimestampToParams(params, fromBlock, toBlock, requestDetails, address))
    ) {
      return EMPTY_RESPONSE;
    }

    this.addTopicsToParams(params, topics);

    return this.getLogsWithParams(address, params, requestDetails);
  }
}
