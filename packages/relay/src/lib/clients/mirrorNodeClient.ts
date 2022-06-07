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
import { predefined } from '../errors';
import { Logger } from "pino";

export interface ILimitOrderParams {
    limit?: number;
    order?: string;
}

export interface IContractResultsParams {
    blockHash?: string;
    blockNumber?: number;
    from?: string;
    internal?: boolean;
    timestamp?: string | string[];
    transactionIndex?: number;
}

export interface IContractLogsResultsParams {
    index?: number,
    timestamp?: string | string[],
    topic0?: string | string[],
    topic1?: string | string[],
    topic2?: string | string[],
    topic3?: string | string[]
}

export class MirrorNodeClient {
    private static GET_ACCOUNTS_ENDPOINT = 'accounts/';
    private static GET_BLOCK_ENDPOINT = 'blocks/';
    private static GET_BLOCKS_ENDPOINT = 'blocks';
    private static GET_CONTRACT_ENDPOINT = 'contracts/';
    private static ADDRESS_PLACEHOLDER = '{address}';
    private static TIMESTAMP_PLACEHOLDER = '{timestamp}';
    private static CONTRACT_ID_PLACEHOLDER = '{contractId}';
    private static GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/results`;
    private static GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT =
        `contracts/${MirrorNodeClient.CONTRACT_ID_PLACEHOLDER}/results/${MirrorNodeClient.TIMESTAMP_PLACEHOLDER}`;
    private static GET_CONTRACT_RESULT_ENDPOINT = 'contracts/results/';
    private static GET_CONTRACT_RESULT_LOGS_ENDPOINT = 'contracts/results/logs';
    private static GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/results/logs`;
    private static GET_CONTRACT_RESULTS_ENDPOINT = 'contracts/results';
    private static GET_NETWORK_EXCHANGERATE_ENDPOINT = 'network/exchangerate';
    private static GET_NETWORK_FEES_ENDPOINT = 'network/fees';

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

    async request(path: string, allowedErrorStatuses?: number[]): Promise<any> {
        try {
            this.logger.debug(`Mirror Request: ${path}`);
            const response = await this.client.get(path);
            return response.data;
        } catch (error) {
            this.handleError(error, allowedErrorStatuses);
        }
        return null;
    }

    handleError(error: any, allowedErrorStatuses?: number[]) {
        if (allowedErrorStatuses && allowedErrorStatuses.length) {
            if (error.response && allowedErrorStatuses.indexOf(error.response.status) === -1) {
                throw error;
            }

            return null;
        }

        this.logger.error(error, 'Unexpected request error');
        throw predefined.INTERNAL_ERROR;
    }

    public async getAccountLatestTransactionByAddress(idOrAliasOrEvmAddress: string): Promise<object> {
        return this.request(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}?order=desc&limit=1`, [400]);
    }

    public async getAccount(idOrAliasOrEvmAddress: string): Promise<object> {
        return this.request(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}`, [400, 404]);
    }

    public async getBlock(hashOrBlockNumber: string | number) {
        return this.request(`${MirrorNodeClient.GET_BLOCK_ENDPOINT}${hashOrBlockNumber}`, [400]);
    }

    public async getBlocks(blockNumber?: number | string[], timestamp?: string, limitOrderParams?: ILimitOrderParams) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'block.number', blockNumber);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_BLOCKS_ENDPOINT}${queryParams}`, [400, 404]);
    }

    public async getContract(contractIdOrAddress: string) {
        return this.request(`${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`, [400, 404]);
    }

    public async getContractResult(transactionIdOrHash: string) {
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT}${transactionIdOrHash}`, [400, 404]);
    }

    public async getContractResults(contractResultsParams?: IContractResultsParams, limitOrderParams?: ILimitOrderParams) {
        const queryParamObject = {};
        this.setContractResultsParams(queryParamObject, contractResultsParams);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT}${queryParams}`, [400]);
    }

    public async getContractResultsDetails(contractId: string, timestamp: string) {
        return this.request(`${this.getContractResultsDetailsByContractIdAndTimestamp(contractId, timestamp)}`, [400]);
    }

    public async getContractResultsByAddress(
        contractIdOrAddress: string,
        contractResultsParams?: IContractResultsParams,
        limitOrderParams?: ILimitOrderParams) {
        const queryParamObject = {};
        this.setContractResultsParams(queryParamObject, contractResultsParams);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}${queryParams}`, [400]);
    }

    public async getContractResultsByAddressAndTimestamp(contractIdOrAddress: string, timestamp: string) {
        return this.request(`${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}/${timestamp}`, [206, 400, 404]);
    }

    private prepareLogsParams(
        contractLogsResultsParams?: IContractLogsResultsParams,
        limitOrderParams?: ILimitOrderParams) {
        const queryParamObject = {};
        if (contractLogsResultsParams) {
            this.setQueryParam(queryParamObject, 'index', contractLogsResultsParams.index);
            this.setQueryParam(queryParamObject, 'timestamp', contractLogsResultsParams.timestamp);
            this.setQueryParam(queryParamObject, 'topic0', contractLogsResultsParams.topic0);
            this.setQueryParam(queryParamObject, 'topic1', contractLogsResultsParams.topic1);
            this.setQueryParam(queryParamObject, 'topic2', contractLogsResultsParams.topic2);
            this.setQueryParam(queryParamObject, 'topic3', contractLogsResultsParams.topic3);
        }

        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        return this.getQueryParams(queryParamObject);
    }

    public async getContractResultsLogs(
        contractLogsResultsParams?: IContractLogsResultsParams,
        limitOrderParams?: ILimitOrderParams) {
        const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);
        return this.request(`${MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT}${queryParams}`, [400, 404]);
    }

    public async getContractResultsLogsByAddress(
        address: string,
        contractLogsResultsParams?: IContractLogsResultsParams,
        limitOrderParams?: ILimitOrderParams
    ) {
        const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);
        const apiEndpoint = MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT.replace(
            MirrorNodeClient.ADDRESS_PLACEHOLDER,
            address
        );
        return this.request(`${apiEndpoint}${queryParams}`, [400, 404]);
    }

    public async getLatestBlock() {
        return this.getBlocks(undefined, undefined, this.getLimitOrderQueryParam(1, MirrorNodeClient.ORDER.DESC));
    }

    public getLimitOrderQueryParam(limit: number, order: string): ILimitOrderParams {
        return { limit: limit, order: order };
    }

    public async getNetworkExchangeRate(timestamp?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT}${queryParams}`, [400, 404]);
    }

    public async getNetworkFees(timestamp?: string, order?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'order', order);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.request(`${MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT}${queryParams}`, [400, 404]);
    }

    private static getContractResultsByAddressPath(address: string) {
        return MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT.replace(MirrorNodeClient.ADDRESS_PLACEHOLDER, address);
    }

    public getContractResultsDetailsByContractIdAndTimestamp(contractId: string, timestamp: string) {
        return MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT
            .replace(MirrorNodeClient.CONTRACT_ID_PLACEHOLDER, contractId)
            .replace(MirrorNodeClient.TIMESTAMP_PLACEHOLDER, timestamp);
    }

    getQueryParams(params: object) {
        let paramString = '';
        for (const [key, value] of Object.entries(params)) {
            let additionalString = '';
            if (Array.isArray(value)) {
                additionalString = value.map(v => `${key}=${v}`).join('&');
            } else {
                additionalString = `${key}=${value}`;
            }
            paramString += paramString === '' ? `?${additionalString}` : `&${additionalString}`;
        }
        return paramString;
    }

    setContractResultsParams(queryParamObject, contractResultsParams?: IContractResultsParams) {
        if (contractResultsParams) {
            this.setQueryParam(queryParamObject, 'block.hash', contractResultsParams.blockHash);
            this.setQueryParam(queryParamObject, 'block.number', contractResultsParams.blockNumber);
            this.setQueryParam(queryParamObject, 'from', contractResultsParams.from);
            this.setQueryParam(queryParamObject, 'internal', contractResultsParams.internal);
            this.setQueryParam(queryParamObject, 'timestamp', contractResultsParams.timestamp);
            this.setQueryParam(queryParamObject, 'transaction.index', contractResultsParams.transactionIndex);
        }
    }

    setLimitOrderParams(queryParamObject, limitOrderParams?: ILimitOrderParams) {
        if (limitOrderParams) {
            this.setQueryParam(queryParamObject, 'limit', limitOrderParams.limit);
            this.setQueryParam(queryParamObject, 'order', limitOrderParams.order);
        }
    }

    setQueryParam(queryParamObject, key, value) {
        if (key && value !== undefined) {
            queryParamObject[key] = value;
        }
    }
}
