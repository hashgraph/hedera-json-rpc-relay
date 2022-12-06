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
import { MirrorNodeClientError } from './../errors/MirrorNodeClientError';
import { Logger } from "pino";
import constants from './../constants';
import { Histogram, Registry } from 'prom-client';
import { formatRequestIdMessage } from '../../formatters';
import axiosRetry from 'axios-retry';

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
    private static GET_BALANCE_ENDPOINT = 'balances';
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
    private static GET_TOKENS_ENDPOINT = 'tokens';
    private static GET_TRANSACTIONS_ENDPOINT = 'transactions';
    private static CONTRACT_CALL_ENDPOINT = 'contracts/call';

    private static CONTRACT_RESULT_LOGS_PROPERTY = 'logs';

    private static ORDER = {
        ASC: 'asc',
        DESC: 'desc'
    };

    private static unknownServerErrorHttpStatusCode = 567;

    /**
     * The logger used for logging all output from this class.
     * @private
     */
    private readonly logger: Logger;

    private readonly client: AxiosInstance;

    public readonly baseUrl: string;

    /**
     * The metrics register used for metrics tracking.
     * @private
     */
    private readonly register: Registry;

    private mirrorResponseHistogram;

    protected createAxiosClient(
        baseUrl: string
    ): AxiosInstance {
        const axiosClient: AxiosInstance = Axios.create({
            baseURL: baseUrl,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10 * 1000
        });
        //@ts-ignore
        axiosRetry(axiosClient, {
            retries: parseInt(process.env.MIRROR_NODE_RETRIES!) || 3,
            retryDelay: (retryCount, error) => {
                const request = error?.request?._header;
                const requestId = request ? request.split('\n')[3].substring(11,47) : '';
                const requestIdPrefix = formatRequestIdMessage(requestId);
                const delay = (parseInt(process.env.MIRROR_NODE_RETRY_DELAY!) || 500);
                this.logger.trace(`${requestIdPrefix} Retry delay ${delay} ms`);
                return delay;
            },
            retryCondition: (error) => {
                return !error?.response?.status || MirrorNodeClientError.retryErrorCodes.includes(error?.response?.status);
            },
            shouldResetTimeout: true
        });
        
        return axiosClient;
    }

    constructor(baseUrl: string, logger: Logger, register: Registry, axiosClient?: AxiosInstance) {
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
        this.register = register;

        // clear and create metric in registry
        const metricHistogramName = 'rpc_relay_mirror_response';
        register.removeSingleMetric(metricHistogramName);
        this.mirrorResponseHistogram = new Histogram({
            name: metricHistogramName,
            help: 'Mirror node response method statusCode latency histogram',
            labelNames: ['method', 'statusCode'],
            registers: [register]
        });

        this.logger.info(`Mirror Node client successfully configured to ${this.baseUrl}`);
    }

    private async request(path: string, pathLabel: string, method: 'GET' | 'POST', data?: any, allowedErrorStatuses?: number[], requestId?: string): Promise<any> {
        const start = Date.now();
        const requestIdPrefix = formatRequestIdMessage(requestId);
        let ms;
        try {
            let response;
            if (method === 'GET') {
                response = await this.client.get(path, {
                    headers:{
                        'requestId': requestId || ''
                    }
                });
            }
            else {
                response = await this.client.post(path, data, {
                    headers:{
                        'requestId': requestId || ''
                    }
                });
            }

            const
            ms = Date.now() - start;
            this.logger.debug(`${requestIdPrefix} [${method}] ${path} ${response.status} ${ms} ms`);
            this.mirrorResponseHistogram.labels(pathLabel, response.status).observe(ms);
            return response.data;
        } catch (error: any) {
            ms = Date.now() - start;
            const effectiveStatusCode = error.response?.status || MirrorNodeClientError.ErrorCodes[error.code] || MirrorNodeClient.unknownServerErrorHttpStatusCode;
            this.mirrorResponseHistogram.labels(pathLabel, effectiveStatusCode).observe(ms);
            this.handleError(error, path, effectiveStatusCode, allowedErrorStatuses, requestId);
        }
        return null;
    }

    async get(path: string, pathLabel: string, allowedErrorStatuses?: number[], requestId?: string): Promise<any> {
        return this.request(path, pathLabel, 'GET', null, allowedErrorStatuses, requestId);
    }

    async post(path: string, data: any = {}, pathLabel: string, allowedErrorStatuses?: number[], requestId?: string): Promise<any> {
        return this.request(path, pathLabel, 'POST', data, allowedErrorStatuses, requestId);
    }

    handleError(error: any, path: string, effectiveStatusCode: number, allowedErrorStatuses?: number[], requestId?: string) {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        if (allowedErrorStatuses && allowedErrorStatuses.length) {
            if (error.response && allowedErrorStatuses.indexOf(effectiveStatusCode) !== -1) {
                this.logger.debug(`${requestIdPrefix} [GET] ${path} ${effectiveStatusCode} status`);
                return null;
            }
        }

        this.logger.error(new Error(error.message), `${requestIdPrefix} [GET] ${path} ${effectiveStatusCode} status`);
        throw new MirrorNodeClientError(error.message, effectiveStatusCode);
    }

    async getPaginatedResults(url: string, pathLabel: string, resultProperty: string, allowedErrorStatuses?: number[], requestId?: string, results = [], page = 1) {
        const result = await this.get(url, pathLabel, allowedErrorStatuses, requestId);

        if (result && result[resultProperty]) {
            results = results.concat(result[resultProperty]);
        }

        if (result && result.links?.next && page < constants.MAX_MIRROR_NODE_PAGINATION) {
            page++;
            const next = result.links.next.replace(constants.NEXT_LINK_PREFIX, "");
            return this.getPaginatedResults(next, pathLabel, resultProperty, allowedErrorStatuses, requestId, results, page);
        }
        else {
            return results;
        }
    }

    public async getAccountLatestTransactionByAddress(idOrAliasOrEvmAddress: string, requestId?: string): Promise<object> {
        return this.get(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}?order=desc&limit=1`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            [400],
            requestId);
    }

    public async getAccount(idOrAliasOrEvmAddress: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getTransactionsForAccount(accountId: string, timestampFrom: string, timestampTo: string, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'account.id', accountId);
        this.setQueryParam(queryParamObject, 'timestamp', `gte:${timestampFrom}`);
        this.setQueryParam(queryParamObject, 'timestamp', `lt:${timestampTo}`);
        const queryParams = this.getQueryParams(queryParamObject);

        return this.getPaginatedResults(
            `${MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT,
            'transactions',
            [400, 404],
            requestId
        );
    }

    public async getBalanceAtTimestamp(accountId: string, timestamp?: string, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'account.id', accountId);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_BALANCE_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_BALANCE_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getBlock(hashOrBlockNumber: string | number, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_BLOCK_ENDPOINT}${hashOrBlockNumber}`,
            MirrorNodeClient.GET_BLOCK_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getBlocks(blockNumber?: number | string[], timestamp?: string, limitOrderParams?: ILimitOrderParams, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'block.number', blockNumber);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_BLOCKS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_BLOCKS_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getContract(contractIdOrAddress: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`,
            MirrorNodeClient.GET_CONTRACT_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getContractResult(transactionIdOrHash: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT}${transactionIdOrHash}`,
            MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getContractResults(contractResultsParams?: IContractResultsParams, limitOrderParams?: ILimitOrderParams, requestId?: string) {
        const queryParamObject = {};
        this.setContractResultsParams(queryParamObject, contractResultsParams);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getContractResultsDetails(contractId: string, timestamp: string, requestId?: string) {
        return this.get(`${this.getContractResultsDetailsByContractIdAndTimestamp(contractId, timestamp)}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getContractResultsByAddress(
        contractIdOrAddress: string,
        contractResultsParams?: IContractResultsParams,
        limitOrderParams?: ILimitOrderParams,
        requestId?: string) {
        const queryParamObject = {};
        this.setContractResultsParams(queryParamObject, contractResultsParams);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}${queryParams}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT,
            [400],
            requestId);
    }

    public async getContractResultsByAddressAndTimestamp(contractIdOrAddress: string, timestamp: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}/${timestamp}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT,
            [206, 400, 404],
            requestId);
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
        limitOrderParams?: ILimitOrderParams,
        requestId?: string) {
        const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);

        return this.getPaginatedResults(
            `${MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT,
            MirrorNodeClient.CONTRACT_RESULT_LOGS_PROPERTY,
            [400, 404],
            requestId
        );
    }

    public async getContractResultsLogsByAddress(
        address: string,
        contractLogsResultsParams?: IContractLogsResultsParams,
        limitOrderParams?: ILimitOrderParams,
        requestId?: string
    ) {
        const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);
        const apiEndpoint = MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT.replace(
            MirrorNodeClient.ADDRESS_PLACEHOLDER,
            address
        );

        return this.getPaginatedResults(
            `${apiEndpoint}${queryParams}`,
            MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT,
            MirrorNodeClient.CONTRACT_RESULT_LOGS_PROPERTY,
            [400, 404],
            requestId
        );
    }


    public async getLatestBlock(requestId?: string) {
        return this.getBlocks(undefined, undefined, this.getLimitOrderQueryParam(1, MirrorNodeClient.ORDER.DESC), requestId);
    }

    public getLimitOrderQueryParam(limit: number, order: string): ILimitOrderParams {
        return { limit: limit, order: order };
    }

    public async getNetworkExchangeRate(timestamp?: string, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getNetworkFees(timestamp?: string, order?: string, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'order', order);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT,
            [400, 404],
            requestId);
    }

    private static getContractResultsByAddressPath(address: string) {
        return MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT.replace(MirrorNodeClient.ADDRESS_PLACEHOLDER, address);
    }

    public getContractResultsDetailsByContractIdAndTimestamp(contractId: string, timestamp: string) {
        return MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT
            .replace(MirrorNodeClient.CONTRACT_ID_PLACEHOLDER, contractId)
            .replace(MirrorNodeClient.TIMESTAMP_PLACEHOLDER, timestamp);
    }

    public async getTokenById(tokenId: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_TOKENS_ENDPOINT}/${tokenId}`,
            MirrorNodeClient.GET_TOKENS_ENDPOINT,
            [400, 404],
            requestId);
    }

    public async getLatestContractResultsByAddress(address: string, blockEndTimestamp: string | undefined, limit: number) {
        // retrieve the timestamp of the contract
        const contractResultsParams: IContractResultsParams = blockEndTimestamp
            ? { timestamp: `lte:${blockEndTimestamp}` }
            : {};
        const limitOrderParams: ILimitOrderParams = this.getLimitOrderQueryParam(limit, 'desc');
        return this.getContractResultsByAddress(address, contractResultsParams, limitOrderParams);
    }

    public async postContractCall(callData: string, requestId?: string) {
        return this.post(MirrorNodeClient.CONTRACT_CALL_ENDPOINT, callData, MirrorNodeClient.CONTRACT_CALL_ENDPOINT, [], requestId);
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
        } else {
            this.setQueryParam(queryParamObject, 'limit', parseInt(process.env.MIRROR_NODE_LIMIT_PARAM!) || 100);
            this.setQueryParam(queryParamObject, 'order', constants.ORDER.ASC);
        }
    }

    setQueryParam(queryParamObject, key, value) {
        if (key && value !== undefined) {
            if (!queryParamObject[key]) {
                queryParamObject[key] = value;
            }

            // Allow for duplicating params
            else {
                queryParamObject[key] += `&${key}=${value}`;
            }
        }
    }

    public async resolveEntityType(entityIdentifier: string, requestId?: string) {
        const contractResult = await this.getContract(entityIdentifier, requestId);
        if (contractResult) {
            return {
                type: constants.TYPE_CONTRACT,
                entity: contractResult
            };
        }
        const accountResult = await this.getAccount(entityIdentifier, requestId);
        if (accountResult) {
            return {
                type: constants.TYPE_ACCOUNT,
                entity: accountResult
            };
        }
        const tokenResult = await this.getTokenById(`0.0.${parseInt(entityIdentifier, 16)}`, requestId);
        if (tokenResult) {
            return {
                type: constants.TYPE_TOKEN,
                entity: tokenResult
            }
        }

        return null;
    }

    //exposing mirror node instance for tests
    public getMirrorNodeInstance(){
        return this.client;
    }
}
