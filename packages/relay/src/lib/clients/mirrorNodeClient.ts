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

import Axios, { AxiosInstance } from 'axios';
import { predefined as errors } from '../errors';
import { Logger } from "pino";

export class MirrorNodeClient {
    private static GET_ACCOUNTS_ENDPOINT = "accounts/";
    private static GET_BLOCK_ENDPOINT = "blocks/";
    private static GET_BLOCKS_ENDPOINT = "blocks";
    private static GET_CONTRACT_ENDPOINT = "contracts/";
    private static GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT = "contracts/{address}/results";
    private static GET_CONTRACT_RESULT_ENDPOINT = "contracts/results/";
    private static GET_CONTRACT_RESULT_LOGS_ENDPOINT = "contracts/results/logs";
    private static GET_CONTRACT_RESULTS_ENDPOINT = "contracts/results";
    private static GET_NETWORK_EXCHANGERATE_ENDPOINT = "network/exchangerate";

    private static ORDER = {
        ASC: 'asc',
        DESC: 'desc'
    };

    /**
     * The logger used for logging all output from this class.
     * @private
     */
    private readonly logger: Logger;

    private readonly client: AxiosInstance;

    public readonly baseUrl: string;

    protected createAxiosClient(
        baseUrl: string
    ): AxiosInstance {
        return Axios.create({
            baseURL: baseUrl,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10 * 1000
        });
    }

    constructor(baseUrl: string, logger: Logger, axiosClient?: AxiosInstance) {
        if (axiosClient !== undefined) {
            this.baseUrl = '';
            this.client = axiosClient;
          } else {
            if (!baseUrl.match(/^https?:\/\//)) {
              baseUrl = `https://${baseUrl}`;
            }
      
            if (!baseUrl.match(/\/$/)) {
              baseUrl = `${baseUrl}/`;
            }
      
            baseUrl = `${baseUrl}api/v1/`;
      
            this.baseUrl = baseUrl;
            this.client = axiosClient ? axiosClient : this.createAxiosClient(baseUrl);
          }
      
          this.logger = logger;
          this.logger.info("Restarting.");
    }

    async request(path: string, allowedErrorStatuses?: [number]): Promise<any> {
        try {
            this.logger.info(`*** requesting: ${path}`);
            const response = await this.client.get(path);
            return response.data;
        } catch (error) {
            this.handleError(error, allowedErrorStatuses);
        }
        return null;
    }

    handleError(error: any, allowedErrorStatuses?: [number]) {
        if (allowedErrorStatuses && allowedErrorStatuses.length) {
            if (error.response && allowedErrorStatuses.indexOf(error.response.status) === -1) {
                throw error;
            }

            return null;
        }

        throw errors['INTERNAL_ERROR'];
    }

    public async getAccountLatestTransactionByAddress(idOrAliasOrEvmAddress: string):Promise<object> {
        return this.request(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}?order=desc&limit=1`, [400]);
    }

    public async getBlock(hashOrBlockNumber: string) {
        return this.request(`${MirrorNodeClient.GET_BLOCK_ENDPOINT}${hashOrBlockNumber}`, [400]);
    }

    public async getBlocks(blockNumber?: number, timestamp?: string, limit?: number, order?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'blockNumber', blockNumber);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'limit', limit);
        this.setQueryParam(queryParamObject, 'order', order);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_BLOCKS_ENDPOINT}${queryParams}`, [400]);
    }

    public async getContract(contractIdOrAddress: string) {
        return this.request(`${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`, [400]);
    }

    public async getContractResult(transactionIdOrHash: string) {
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT}${transactionIdOrHash}`, [400]);
    }

    public async getContractResults(
        blockHash?: string,
        blockNumber?: number,
        from?: string,
        internal?: boolean,
        limit?: number,
        order?: string,
        timestamp?: string | [string],
        transactionIndex?: number) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'block.hash', blockHash);
        this.setQueryParam(queryParamObject, 'block.number', blockNumber);
        this.setQueryParam(queryParamObject, 'from', from);
        this.setQueryParam(queryParamObject, 'internal', internal);
        this.setQueryParam(queryParamObject, 'limit', limit);
        this.setQueryParam(queryParamObject, 'order', order);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'transaction.index', transactionIndex);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT}${queryParams}`, [400]);
    }

    public async getContractResultsByAddress(
        contractIdOrAddress: string, 
        blockHash?: string,
        blockNumber?: number,
        from?: string,
        internal?: boolean,
        limit?: number,
        order?: string,
        timestamp?: string | [string],
        transactionIndex?: number) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'block.hash', blockHash);
        this.setQueryParam(queryParamObject, 'block.number', blockNumber);
        this.setQueryParam(queryParamObject, 'from', from);
        this.setQueryParam(queryParamObject, 'internal', internal);
        this.setQueryParam(queryParamObject, 'limit', limit);
        this.setQueryParam(queryParamObject, 'order', order);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'transaction.index', transactionIndex);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT}${contractIdOrAddress}${queryParams}`, [400]);
    }

    public async getContractResultsLogs(
        index: number,
        limit?: number,
        order?: string,
        timestamp?: string | [string],
        topic0?: string | [string],
        topic1?: string | [string],
        topic2?: string | [string],
        topic3?: string | [string]) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'index', index);
        this.setQueryParam(queryParamObject, 'limit', limit);
        this.setQueryParam(queryParamObject, 'order', order);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'topic0', topic0);
        this.setQueryParam(queryParamObject, 'topic1', topic1);
        this.setQueryParam(queryParamObject, 'topic2', topic2);
        this.setQueryParam(queryParamObject, 'topic3', topic3);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT}${queryParams}`, [400]);
    }

    public async getLatestBlock() {
        return this.getBlocks(undefined, undefined, 1, MirrorNodeClient.ORDER.DESC);
    }

    public async getNetworkExchangeRate(timestamp?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT}${queryParams}`, [400]);
    }

    getQueryParams(params: object) {
        let paramString = '';
        for (const [key, value] of Object.entries(params)) {
            paramString += paramString === '' ? `?${key}=${value}` : `&${key}=${value}`;
        }
        return paramString;
    }

    setQueryParam(queryParamObject, key, value) {
        if (key && value) {
            queryParamObject[key] = value;
        }
    }
}