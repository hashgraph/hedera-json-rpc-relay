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

import Axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { MirrorNodeClientError } from './../errors/MirrorNodeClientError';
import { Logger } from "pino";
import constants from './../constants';
import { Histogram, Registry } from 'prom-client';
import { formatRequestIdMessage, formatTransactionId } from '../../formatters';
import axiosRetry from 'axios-retry';
import { predefined } from "../errors/JsonRpcError";
const http = require('http');
const https = require('https');
const LRU = require('lru-cache');

type REQUEST_METHODS = 'GET' | 'POST';

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
    private static GET_STATE_ENDPOINT = '/state';
    private static GET_CONTRACT_RESULTS_ENDPOINT = 'contracts/results';
    private static GET_NETWORK_EXCHANGERATE_ENDPOINT = 'network/exchangerate';
    private static GET_NETWORK_FEES_ENDPOINT = 'network/fees';
    private static GET_TOKENS_ENDPOINT = 'tokens';
    private static GET_TRANSACTIONS_ENDPOINT = 'transactions';
    private static CONTRACT_CALL_ENDPOINT = 'contracts/call';

    private static CONTRACT_RESULT_LOGS_PROPERTY = 'logs';
    private static CONTRACT_STATE_PROPERTY = 'state';

    static acceptedErrorStatusesResponsePerRequestPathMap: Map<string, Array<number>> = new Map([
        [MirrorNodeClient.GET_ACCOUNTS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_BALANCE_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_BLOCK_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_BLOCKS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT, [206, 400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_TOKENS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT, [400, 404]],
        [MirrorNodeClient.CONTRACT_CALL_ENDPOINT, [404, 415, 500]],
        [MirrorNodeClient.GET_STATE_ENDPOINT, [400, 404]]
    ]);

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

    private readonly restClient: AxiosInstance;
    private readonly web3Client: AxiosInstance;

    public readonly restUrl: string;
    public readonly web3Url: string;

    /**
     * The metrics register used for metrics tracking.
     * @private
     */
    private readonly register: Registry;

    private mirrorResponseHistogram;

    private readonly cache;
    static readonly EVM_ADDRESS_REGEX: RegExp = /\/accounts\/([\d\.]+)/;    

    protected createAxiosClient(
        baseUrl: string
    ): AxiosInstance {
        // defualt values for axios clients to mirror node
        const mirrorNodeTimeout = parseInt(process.env.MIRROR_NODE_TIMEOUT || '10000');
        const mirrorNodeMaxRedirects = parseInt(process.env.MIRROR_NODE_MAX_REDIRECTS || '5');
        const mirrorNodeHttpKeepAlive = process.env.MIRROR_NODE_HTTP_KEEP_ALIVE === 'true' ? true : false;
        const mirrorNodeHttpKeepAliveMsecs = parseInt(process.env.MIRROR_NODE_HTTP_KEEP_ALIVE_MSECS || '1000');
        const mirrorNodeHttpMaxSockets = parseInt(process.env.MIRROR_NODE_HTTP_MAX_SOCKETS || '100');
        const mirrorNodeHttpMaxTotalSockets = parseInt(process.env.MIRROR_NODE_HTTP_MAX_TOTAL_SOCKETS || '100');
        const mirrorNodeHttpSocketTimeout = parseInt(process.env.MIRROR_NODE_HTTP_SOCKET_TIMEOUT || '60000');
        const isDevMode = process.env.DEV_MODE && process.env.DEV_MODE === 'true';
        const mirrorNodeRetries = parseInt(process.env.MIRROR_NODE_RETRIES!) || 3;
        const mirrorNodeRetriesDevMode = parseInt(process.env.MIRROR_NODE_RETRIES_DEVMODE!) || 5;
        const mirrorNodeRetryDelay = parseInt(process.env.MIRROR_NODE_RETRY_DELAY!) || 250;
        const mirrorNodeRetryDelayDevMode = parseInt(process.env.MIRROR_NODE_RETRY_DELAY_DEVMODE!) || 200;
        const mirrorNodeRetryErrorCodes: Array<number> = process.env.MIRROR_NODE_RETRY_CODES ? JSON.parse(process.env.MIRROR_NODE_RETRY_CODES) : [404]; // by default we should only retry on 404 errors

        const axiosClient: AxiosInstance = Axios.create({
            baseURL: baseUrl,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: mirrorNodeTimeout,
            maxRedirects: mirrorNodeMaxRedirects,
            // set http agent options to optimize performance - https://nodejs.org/api/http.html#new-agentoptions
            httpAgent: new http.Agent({ 
                keepAlive: mirrorNodeHttpKeepAlive,
                keepAliveMsecs: mirrorNodeHttpKeepAliveMsecs,
                maxSockets: mirrorNodeHttpMaxSockets,
                maxTotalSockets: mirrorNodeHttpMaxTotalSockets,
                timeout: mirrorNodeHttpSocketTimeout,
            }),
            httpsAgent: new https.Agent({ 
                keepAlive: mirrorNodeHttpKeepAlive,
                keepAliveMsecs: mirrorNodeHttpKeepAliveMsecs,
                maxSockets: mirrorNodeHttpMaxSockets,
                maxTotalSockets: mirrorNodeHttpMaxTotalSockets,
                timeout: mirrorNodeHttpSocketTimeout,
            }),
        });
        //@ts-ignore
        axiosRetry(axiosClient, {
            retries: isDevMode ? mirrorNodeRetriesDevMode : mirrorNodeRetries,
            retryDelay: (retryCount, error) => {
                const request = error?.request?._header;
                const requestId = request ? request.split('\n')[3].substring(11,47) : '';
                const requestIdPrefix = formatRequestIdMessage(requestId);
                const delay = isDevMode ? mirrorNodeRetryDelayDevMode || 200 : mirrorNodeRetryDelay * retryCount;
                this.logger.trace(`${requestIdPrefix} Retry delay ${delay} ms on '${error?.request?.path}'`);                
                return delay;
            },
            retryCondition: (error) => {
                return !error?.response?.status || mirrorNodeRetryErrorCodes.includes(error?.response?.status);
            },
            shouldResetTimeout: true
        });

        return axiosClient;
    }

    constructor(restUrl: string, logger: Logger, register: Registry, restClient?: AxiosInstance, web3Url?: string, web3Client?: AxiosInstance) {
        if (!web3Url) {
            web3Url = restUrl;
        }

        if (restClient !== undefined) {
            this.restUrl = '';
            this.web3Url = '';

            this.restClient = restClient;
            this.web3Client = web3Client ? web3Client : restClient;
        } else {
            this.restUrl = this.buildUrl(restUrl);
            this.web3Url = this.buildUrl(web3Url);

            this.restClient = restClient ? restClient : this.createAxiosClient(this.restUrl);
            this.web3Client = web3Client ? web3Client : this.createAxiosClient(this.web3Url);
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
            registers: [register],
            buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] // ms (milliseconds)
        });

        this.logger.info(`Mirror Node client successfully configured to REST url: ${this.restUrl} and Web3 url: ${this.web3Url} `);
        this.cache = new LRU({ max: constants.CACHE_MAX, ttl: constants.CACHE_TTL.ONE_HOUR });

        // set  up eth call  accepted error codes.
        if(process.env.ETH_CALL_ACCEPTED_ERRORS) {
            MirrorNodeClient.acceptedErrorStatusesResponsePerRequestPathMap
                .set(MirrorNodeClient.CONTRACT_CALL_ENDPOINT, JSON.parse(process.env.ETH_CALL_ACCEPTED_ERRORS));
        }

    }

    private buildUrl(baseUrl: string) {
        if (!baseUrl.match(/^https?:\/\//)) {
            baseUrl = `https://${baseUrl}`;
        }

        if (!baseUrl.match(/\/$/)) {
            baseUrl = `${baseUrl}/`;
        }

        return `${baseUrl}api/v1/`;
    }

    private async request(path: string, pathLabel: string, method: REQUEST_METHODS, data?: any, requestId?: string): Promise<any> {
        const start = Date.now();
        const requestIdPrefix = formatRequestIdMessage(requestId);
        let ms;
        const controller = new AbortController();
        try {
            let response;

            const axiosRequestConfig: AxiosRequestConfig = {
                headers:{
                    'requestId': requestId || ''
                },
                signal: controller.signal
            };

            if (method === 'GET') {
                response = await this.restClient.get(path, axiosRequestConfig);
            }
            else {
                response = await this.web3Client.post(path, data, axiosRequestConfig);
            }

            const ms = Date.now() - start;
            this.logger.debug(`${requestIdPrefix} [${method}] ${path} ${response.status} ${ms} ms`);
            this.mirrorResponseHistogram.labels(pathLabel, response.status).observe(ms);
            return response.data;
        } catch (error: any) {
            ms = Date.now() - start;
            const effectiveStatusCode = error.response?.status || MirrorNodeClientError.ErrorCodes[error.code] || MirrorNodeClient.unknownServerErrorHttpStatusCode;
            this.mirrorResponseHistogram.labels(pathLabel, effectiveStatusCode).observe(ms);

            // always abort the request on failure as the axios call can hang until the parent code/stack times out (might be a few minutes in a server-side applications)
            controller.abort();

            this.handleError(error, path, pathLabel, effectiveStatusCode, method, requestId);
        }

        return null;
    }

    async get(path: string, pathLabel: string, requestId?: string): Promise<any> {
        return this.request(path, pathLabel, 'GET', null, requestId);
    }

    async post(path: string, data: any, pathLabel: string, requestId?: string): Promise<any> {
        if (!data) data = {};
        return this.request(path, pathLabel, 'POST', data, requestId);
    }

    handleError(error: any, path: string, pathLabel: string, effectiveStatusCode: number, method: REQUEST_METHODS, requestId?: string) {
        const mirrorError = new MirrorNodeClientError(error, effectiveStatusCode);   
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const acceptedErrorResponses = MirrorNodeClient.acceptedErrorStatusesResponsePerRequestPathMap.get(pathLabel);
        if (error.response && acceptedErrorResponses && acceptedErrorResponses.indexOf(effectiveStatusCode) !== -1) {
            this.logger.debug(`${requestIdPrefix} [${method}] ${path} ${effectiveStatusCode} status`);
            if(pathLabel  === MirrorNodeClient.CONTRACT_CALL_ENDPOINT) {
                this.logger.warn(`${requestIdPrefix} [${method}] ${path} Error details: ( StatusCode: '${effectiveStatusCode}', StatusText: '${error.response.statusText}', Data: '${JSON.stringify(error.response.data)}')`);
            }
            return null;
        }

        this.logger.error(new Error(error.message), `${requestIdPrefix} [${method}] ${path} ${effectiveStatusCode} status`);

        // we only need contract revert errors here as it's not the same as not supported
        if (mirrorError.isContractReverted() && !mirrorError.isNotSupported() && !mirrorError.isNotSupportedSystemContractOperaton()) {
            throw predefined.CONTRACT_REVERT(mirrorError.errorMessage);
        }

        throw mirrorError;
    }

    async getPaginatedResults(url: string, pathLabel: string, resultProperty: string, requestId?: string, results = [], page = 1) {
        const result = await this.get(url, pathLabel, requestId);

        if (result && result[resultProperty]) {
            results = results.concat(result[resultProperty]);
        }

        if (result && result.links?.next && page < constants.MAX_MIRROR_NODE_PAGINATION) {
            page++;
            const next = result.links.next.replace(constants.NEXT_LINK_PREFIX, "");
            return this.getPaginatedResults(next, pathLabel, resultProperty, requestId, results, page);
        }
        else {
            return results;
        }
    }

    public async getAccountLatestTransactionByAddress(idOrAliasOrEvmAddress: string, requestId?: string): Promise<object> {
        return this.get(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}?order=desc&limit=1`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            requestId);
    }

    public async getAccount(idOrAliasOrEvmAddress: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            requestId);
    }

    public async getAccountPageLimit(idOrAliasOrEvmAddress: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${idOrAliasOrEvmAddress}?limit=${constants.MIRROR_NODE_QUERY_LIMIT}`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            requestId);
    }
    /*******************************************************************************
     * To be used to make paginated calls for the account information when the 
     * transaction count exceeds the constant MIRROR_NODE_QUERY_LIMIT.
     *******************************************************************************/
    public async getAccountPaginated(url: string, requestId?: string) {
        const queryParamObject = {};
        const accountId = this.extractAccountIdFromUrl(url, requestId);
        const params = new URLSearchParams(url.split('?')[1]);
        
        this.setQueryParam(queryParamObject, 'limit', constants.MIRROR_NODE_QUERY_LIMIT);
        this.setQueryParam(queryParamObject, 'timestamp', params.get('timestamp'));
        const queryParams = this.getQueryParams(queryParamObject);

        return this.getPaginatedResults(
            `${MirrorNodeClient.GET_ACCOUNTS_ENDPOINT}${accountId}${queryParams}`,
            MirrorNodeClient.GET_ACCOUNTS_ENDPOINT,
            'transactions',
            requestId
        );
    }

    public extractAccountIdFromUrl(url: string, requestId?: string): string | null {
        const substringStartIndex = url.indexOf("/accounts/") + "/accounts/".length;
        if (url.startsWith("0x", substringStartIndex)) {
            // evm addresss
            const regex = /\/accounts\/(0x[a-fA-F0-9]{40})/;
            const match = url.match(regex);
            const accountId = match ? match[1] : null;
            if (!accountId) {
                this.logger.error(`${formatRequestIdMessage(requestId)} Unable to extract evm address from url ${url}`);
            }
            return String(accountId);
        } else {
            // account id 
            const match = url.match(MirrorNodeClient.EVM_ADDRESS_REGEX);
            const accountId = match ? match[1] : null;
            if (!accountId) {
                this.logger.error(`${formatRequestIdMessage(requestId)} Unable to extract account ID from url ${url}`);
            }
            return String(accountId);
        }
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
            requestId);
    }

    public async getBlock(hashOrBlockNumber: string | number, requestId?: string) {
        const cachedLabel = `${constants.CACHE_KEY.GET_BLOCK}.${hashOrBlockNumber}`;
        const cachedResponse: any = this.cache.get(cachedLabel);
        if (cachedResponse != undefined) {
            return cachedResponse;
        }

        const block = await this.get(`${MirrorNodeClient.GET_BLOCK_ENDPOINT}${hashOrBlockNumber}`,
          MirrorNodeClient.GET_BLOCK_ENDPOINT,
          requestId);

        this.cache.set(cachedLabel, block);
        return block;
    }

    public async getBlocks(blockNumber?: number | string[], timestamp?: string, limitOrderParams?: ILimitOrderParams, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'block.number', blockNumber);
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_BLOCKS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_BLOCKS_ENDPOINT,
            requestId);
    }

    public async getContract(contractIdOrAddress: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`,
            MirrorNodeClient.GET_CONTRACT_ENDPOINT,
            requestId);
    }

    public async getContractResult(transactionIdOrHash: string, requestId?: string) {
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const cacheKey = `${constants.CACHE_KEY.GET_CONTRACT_RESULT}.${transactionIdOrHash}`;
        const cachedResponse = this.cache.get(cacheKey);
        const path = `${MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT}${transactionIdOrHash}`;

        if(cachedResponse != undefined) {
            this.logger.trace(`${requestIdPrefix} returning cached response for ${path}:${JSON.stringify(cachedResponse)}`);
            return cachedResponse;
        }

        const response = await this.get(path,
            MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT,
            requestId);

        if(response != undefined && response.transaction_index != undefined && response.result === "SUCCESS") {
            this.logger.trace(`${requestIdPrefix} caching ${cacheKey}:${JSON.stringify(response)} for ${constants.CACHE_TTL.ONE_HOUR} ms`);
            this.cache.set(cacheKey, response);
        }

        return response;
    }

    /**
     * In some very rare cases the /contracts/results api is called before all the data is saved in
     * the mirror node DB and `transaction_index` is returned as `undefined`. A single re-fetch is sufficient to
     * resolve this problem.
     * @param transactionIdOrHash
     * @param requestId
     */
    public async getContractResultWithRetry(transactionIdOrHash: string, requestId?: string) {
        const contractResult = await this.getContractResult(transactionIdOrHash, requestId);
        if (contractResult && typeof contractResult.transaction_index === 'undefined') {
            return this.getContractResult(transactionIdOrHash, requestId);
        }
        return contractResult;
    }

    public async getContractResults(contractResultsParams?: IContractResultsParams, limitOrderParams?: ILimitOrderParams, requestId?: string) {
        const queryParamObject = {};
        this.setContractResultsParams(queryParamObject, contractResultsParams);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT,
            requestId);
    }

    public async getContractResultsDetails(contractId: string, timestamp: string, requestId?: string) {
        return this.get(`${this.getContractResultsDetailsByContractIdAndTimestamp(contractId, timestamp)}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT,
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
            requestId);
    }

    public async getContractResultsByAddressAndTimestamp(contractIdOrAddress: string, timestamp: string, requestId?: string) {
        return this.get(`${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}/${timestamp}`,
            MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT,
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
            requestId);
    }

    public async getNetworkFees(timestamp?: string, order?: string, requestId?: string) {
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'timestamp', timestamp);
        this.setQueryParam(queryParamObject, 'order', order);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT}${queryParams}`,
            MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT,
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
            requestId);
    }

    public async getLatestContractResultsByAddress(address: string, blockEndTimestamp: string | undefined, limit: number, requestId?: string) {
        // retrieve the timestamp of the contract
        const contractResultsParams: IContractResultsParams = blockEndTimestamp
            ? { timestamp: `lte:${blockEndTimestamp}` }
            : {};
        const limitOrderParams: ILimitOrderParams = this.getLimitOrderQueryParam(limit, 'desc');
        return this.getContractResultsByAddress(address, contractResultsParams, limitOrderParams, requestId);
    }

    public async getContractStateByAddressAndSlot(address: string, slot: string, blockEndTimestamp?: string, requestId?: string) {
        const limitOrderParams: ILimitOrderParams = this.getLimitOrderQueryParam(constants.MIRROR_NODE_QUERY_LIMIT, constants.ORDER.DESC);
        const queryParamObject = {};
        
        if (blockEndTimestamp) {
            this.setQueryParam(queryParamObject, 'timestamp', blockEndTimestamp);
        }
        this.setQueryParam(queryParamObject, 'slot', slot);
        this.setLimitOrderParams(queryParamObject, limitOrderParams);
        const queryParams = this.getQueryParams(queryParamObject);

        return this.get(`${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${address}${MirrorNodeClient.GET_STATE_ENDPOINT}${queryParams}`,
        MirrorNodeClient.GET_STATE_ENDPOINT,
        requestId);
    }

    public async postContractCall(callData: string, requestId?: string) {
        return this.post(MirrorNodeClient.CONTRACT_CALL_ENDPOINT, callData, MirrorNodeClient.CONTRACT_CALL_ENDPOINT, requestId);
    }

    public async getTransactionById(transactionId: string, nonce: number | undefined, requestId?: string) {
        const formattedId = formatTransactionId(transactionId);
        if (formattedId == null) {
            return formattedId;
        }
        const queryParamObject = {};
        this.setQueryParam(queryParamObject, 'nonce', nonce);
        const queryParams = this.getQueryParams(queryParamObject);
        return this.get(`${MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT}/${formattedId}${queryParams}`,
        MirrorNodeClient.GET_STATE_ENDPOINT,
        requestId);
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

    /**
     * Get the contract results for a given address
     * @param entityIdentifier the address of the contract
     * @param requestId the request id
     * @param searchableTypes the types to search for
     * @returns entity object or null if not found
     */
    public async resolveEntityType(
      entityIdentifier: string,
      searchableTypes: any[] = [constants.TYPE_CONTRACT, constants.TYPE_ACCOUNT, constants.TYPE_TOKEN],
      requestId?: string
    ) {
        const cachedLabel = `${constants.CACHE_KEY.RESOLVE_ENTITY_TYPE}_${entityIdentifier}`;
        const cachedResponse: { type: string, entity: any } | undefined = this.cache.get(cachedLabel);
        if (cachedResponse != undefined) {
            return cachedResponse;
        }

        const buildPromise = (fn) => new Promise((resolve, reject) => fn.then((values) => {
            if (values == null) reject();
            resolve(values);
        }));

        if (searchableTypes.find(t => t === constants.TYPE_CONTRACT)) {
            const contract = await this.getContract(entityIdentifier, requestId).catch(() =>  {return null;});
            if (contract) {
                const response = {
                    type: constants.TYPE_CONTRACT,
                    entity: contract
                };
                this.cache.set(cachedLabel, response);
                return response;
            }
        }

        let data;
        try {
            const promises = [
                searchableTypes.find(t => t === constants.TYPE_ACCOUNT) ? buildPromise(this.getAccount(entityIdentifier, requestId).catch(() =>  {return null;})) : Promise.reject(),
            ];

            // only add long zero evm addresses for tokens as they do not refer to actual contract addresses but rather encoded entity nums            
            if (entityIdentifier.startsWith(constants.LONG_ZERO_PREFIX)) {
                promises.push(searchableTypes.find(t => t === constants.TYPE_TOKEN) ? buildPromise(this.getTokenById(`0.0.${parseInt(entityIdentifier, 16)}`, requestId).catch(() =>  {return null;})) : Promise.reject());
            }

            // maps the promises with indices of the promises array
            // because there is no such method as Promise.anyWithIndex in js
            // the index is needed afterward for detecting the resolved promise type (contract, account, or token)
            // @ts-ignore
            data = await Promise.any(promises.map((promise, index) => promise.then(value => ({ value, index }))));
        } catch (e) {
            return null;
        }

        let type;
        switch (data.index) {
            case 0: {
                type = constants.TYPE_ACCOUNT;
                break;
            }
            case 1: {
                type = constants.TYPE_TOKEN;
                break;
            }
        }

        const response = {
            type,
            entity: data.value
        };
        this.cache.set(cachedLabel, response);
        return response;
    }

    //exposing mirror node instance for tests
    public getMirrorNodeRestInstance(){
        return this.restClient;
    }

    public getMirrorNodeWeb3Instance(){
        return this.web3Client;
    }
}
