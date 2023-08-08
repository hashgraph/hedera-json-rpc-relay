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

import constants from "../../../constants";
import {JsonRpcError, predefined} from "../../../errors/JsonRpcError";
import {ICommonService} from "./ICommonService";
import { Logger } from 'pino';
import { ClientCache, MirrorNodeClient } from '../../../clients';
import {numberTo0x, parseNumericEnvVar} from "../../../../formatters";
import {SDKClientError} from "../../../errors/SDKClientError";


/**
 * Create a new Common Service implementation.
 * @param mirrorNodeClient
 * @param logger
 * @param chain
 * @param registry
 * @param clientCache
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
    private readonly cache: ClientCache;

    static blockLatest = 'latest';
    static blockEarliest = 'earliest';
    static blockPending = 'pending';

    // function callerNames
    static latestBlockNumber = 'getLatestBlockNumber';

    private readonly maxBlockRange = parseNumericEnvVar('MAX_BLOCK_RANGE', 'MAX_BLOCK_RANGE');
    private readonly ethBlockNumberCacheTtlMs = parseNumericEnvVar('ETH_BLOCK_NUMBER_CACHE_TTL_MS', 'ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT');

    constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, clientCache: ClientCache) {
        this.mirrorNodeClient = mirrorNodeClient;
        this.logger = logger;
        this.cache = clientCache;
    }

    public blockTagIsLatestOrPending = (tag) => {
        return tag == null || tag === CommonService.blockLatest || tag === CommonService.blockPending;
    };

    public async validateBlockRangeAndAddTimestampToParams(params: any, fromBlock: string, toBlock: string, requestIdPrefix?: string) {
        const blockRangeLimit = Number(process.env.ETH_GET_LOGS_BLOCK_RANGE_LIMIT) || constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT;

        if (this.blockTagIsLatestOrPending(toBlock)) {
            toBlock = CommonService.blockLatest;
        }

        // toBlock is a number and is less than the current block number and fromBlock is not defined
        if (Number(toBlock) < Number(await this.getLatestBlockNumber(requestIdPrefix)) && !fromBlock) {
            throw predefined.MISSING_FROM_BLOCK_PARAM;
        }

        if (this.blockTagIsLatestOrPending(fromBlock)) {
            fromBlock = CommonService.blockLatest;
        }

        let fromBlockNum = 0;
        let toBlockNum;
        params.timestamp = [];

        const fromBlockResponse = await this.getHistoricalBlockResponse(fromBlock, true, requestIdPrefix);
        if (!fromBlockResponse) {
            return false;
        }

        params.timestamp.push(`gte:${fromBlockResponse.timestamp.from}`);

        if (fromBlock === toBlock) {
            params.timestamp.push(`lte:${fromBlockResponse.timestamp.to}`);
        }
        else {
            fromBlockNum = parseInt(fromBlockResponse.number);
            const toBlockResponse = await this.getHistoricalBlockResponse(toBlock, true, requestIdPrefix);
            if (toBlockResponse != null) {
                params.timestamp.push(`lte:${toBlockResponse.timestamp.to}`);
                toBlockNum = parseInt(toBlockResponse.number);
            }

            if (fromBlockNum > toBlockNum) {
                return false;
            } else if (toBlockNum - fromBlockNum > blockRangeLimit) {
                throw predefined.RANGE_TOO_LARGE(blockRangeLimit);
            }
        }

        return true;
    }


    /**
     * returns the block response
     * otherwise return undefined.
     *
     * @param blockNumberOrTag
     * @param returnLatest
     */
    public async getHistoricalBlockResponse(blockNumberOrTag?: string | null, returnLatest?: boolean, requestIdPrefix?: string | undefined): Promise<any> {
        if (!returnLatest && this.blockTagIsLatestOrPending(blockNumberOrTag)) {
            return null;
        }

        const blockNumber = Number(blockNumberOrTag);
        if (blockNumberOrTag != null && blockNumberOrTag.length < 32 && !isNaN(blockNumber)) {
            const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestIdPrefix);
            const latestBlock = latestBlockResponse.blocks[0];
            if (blockNumber > latestBlock.number + this.maxBlockRange) {
                return null;
            }
        }

        if (blockNumberOrTag == null || this.blockTagIsLatestOrPending(blockNumberOrTag)) {
            const latestBlockResponse = await this.mirrorNodeClient.getLatestBlock(requestIdPrefix);
            return latestBlockResponse.blocks[0];
        }

        if (blockNumberOrTag == CommonService.blockEarliest) {
            return await this.mirrorNodeClient.getBlock(0, requestIdPrefix);
        }

        if (blockNumberOrTag.length < 32) {
            return await this.mirrorNodeClient.getBlock(Number(blockNumberOrTag), requestIdPrefix);
        }

        return await this.mirrorNodeClient.getBlock(blockNumberOrTag, requestIdPrefix);
    }

    /**
     * Gets the most recent block number.
     */
    public async getLatestBlockNumber(requestIdPrefix?: string): Promise<string> {
        // check for cached value
        const cacheKey = `${constants.CACHE_KEY.ETH_BLOCK_NUMBER}`;
        const blockNumberCached = this.cache.get(cacheKey, CommonService.latestBlockNumber);

        if(blockNumberCached) {
            this.logger.trace(`${requestIdPrefix} returning cached value ${cacheKey}:${JSON.stringify(blockNumberCached)}`);
            return blockNumberCached;
        }

        const blocksResponse = await this.mirrorNodeClient.getLatestBlock(requestIdPrefix);
        const blocks = blocksResponse !== null ? blocksResponse.blocks : null;
        if (Array.isArray(blocks) && blocks.length > 0) {
            const currentBlock = numberTo0x(blocks[0].number);
            // save the latest block number in cache
            this.cache.set(cacheKey, currentBlock, CommonService.latestBlockNumber, this.ethBlockNumberCacheTtlMs, requestIdPrefix);

            return currentBlock;
        }

        throw predefined.COULD_NOT_RETRIEVE_LATEST_BLOCK;
    }

    public genericErrorHandler(error: any, logMessage?: string) {
        if (logMessage) {
            this.logger.error(error, logMessage);
        }
        else {
            this.logger.error(error);
        }

        if (error instanceof SDKClientError && error.isGrpcTimeout()) {
            throw predefined.REQUEST_TIMEOUT;
        }

        if (error instanceof JsonRpcError) {
            throw error;
        }
        return predefined.INTERNAL_ERROR(error.message.toString());
    }
}
