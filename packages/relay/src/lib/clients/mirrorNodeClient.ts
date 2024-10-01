/* -
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

import http from 'http';
import https from 'https';
import { Logger } from 'pino';
import { ethers } from 'ethers';
import axiosRetry from 'axios-retry';
import constants from './../constants';
import { Histogram, Registry } from 'prom-client';
import { predefined } from '../errors/JsonRpcError';
import { SDKClientError } from '../errors/SDKClientError';
import { IOpcodesResponse } from './models/IOpcodesResponse';
import { install as betterLookupInstall } from 'better-lookup';
import { CacheService } from '../services/cacheService/cacheService';
import { MirrorNodeClientError } from '../errors/MirrorNodeClientError';
import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { parseNumericEnvVar, formatTransactionId, formatRequestIdMessage } from '../../formatters';
import {
  ILimitOrderParams,
  IContractCallRequest,
  IContractCallResponse,
  IContractResultsParams,
  ITransactionRecordMetric,
  IContractLogsResultsParams,
  MirrorNodeTransactionRecord,
  IMirrorNodeTransactionRecord,
} from '../types';

type REQUEST_METHODS = 'GET' | 'POST';

export class MirrorNodeClient {
  private static readonly GET_BLOCK_ENDPOINT = 'blocks/';
  private static readonly GET_BLOCKS_ENDPOINT = 'blocks';
  private static readonly GET_TOKENS_ENDPOINT = 'tokens';
  private static readonly ADDRESS_PLACEHOLDER = '{address}';
  private static readonly GET_BALANCE_ENDPOINT = 'balances';
  private static readonly TIMESTAMP_PLACEHOLDER = '{timestamp}';
  private static readonly GET_CONTRACT_ENDPOINT = 'contracts/';
  private static readonly CONTRACT_RESULT_LOGS_PROPERTY = 'logs';
  private static readonly CONTRACT_ID_PLACEHOLDER = '{contractId}';
  private static readonly ACCOUNT_TIMESTAMP_PROPERTY = 'timestamp';
  private static readonly CONTRACT_CALL_ENDPOINT = 'contracts/call';
  private static readonly GET_ACCOUNTS_BY_ID_ENDPOINT = 'accounts/';
  private static readonly GET_NETWORK_FEES_ENDPOINT = 'network/fees';
  private static readonly GET_TRANSACTIONS_ENDPOINT = 'transactions';
  private static readonly TRANSACTION_ID_PLACEHOLDER = '{transactionId}';
  private static readonly TRANSACTION_HASH_PLACEHOLDER = '{transactionHash}';
  private static readonly GET_CONTRACT_RESULT_ENDPOINT = 'contracts/results/';
  private static readonly GET_CONTRACT_RESULTS_ENDPOINT = 'contracts/results';
  private static readonly ACCOUNT_TRANSACTION_TYPE_PROPERTY = 'transactiontype';
  private static readonly GET_NETWORK_EXCHANGERATE_ENDPOINT = 'network/exchangerate';
  private static readonly GET_CONTRACT_RESULT_LOGS_ENDPOINT = 'contracts/results/logs';
  private static readonly CONTRACT_ADDRESS_STATE_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/state`;
  private static readonly GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/results`;
  private static readonly GET_TRANSACTIONS_ENDPOINT_TRANSACTION_ID = `transactions/${MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER}`;
  private static readonly GET_TRANSACTIONS_ENDPOINT_TRANSACTION_HASH = `transactions/hash/${MirrorNodeClient.TRANSACTION_HASH_PLACEHOLDER}`;
  private static readonly GET_CONTRACTS_RESULTS_ACTIONS = `contracts/results/${MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER}/actions`;
  private static readonly GET_CONTRACTS_RESULTS_OPCODES = `contracts/results/${MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER}/opcodes`;
  private static readonly GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/results/logs`;
  private static readonly GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT = `contracts/${MirrorNodeClient.CONTRACT_ID_PLACEHOLDER}/results/${MirrorNodeClient.TIMESTAMP_PLACEHOLDER}`;
  private static readonly GET_CONTRACT_RESULTS_DETAILS_BY_ADDRESS_AND_TIMESTAMP_ENDPOINT = `contracts/${MirrorNodeClient.ADDRESS_PLACEHOLDER}/results/${MirrorNodeClient.TIMESTAMP_PLACEHOLDER}`;
  private readonly MIRROR_NODE_RETRY_DELAY = parseNumericEnvVar(
    'MIRROR_NODE_RETRY_DELAY',
    'MIRROR_NODE_RETRY_DELAY_DEFAULT',
  );
  private readonly MIRROR_NODE_REQUEST_RETRY_COUNT = parseNumericEnvVar(
    'MIRROR_NODE_REQUEST_RETRY_COUNT',
    'MIRROR_NODE_REQUEST_RETRY_COUNT_DEFAULT',
  );

  static acceptedErrorStatusesResponsePerRequestPathMap: Map<string, Array<number>> = new Map([
    [MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT, [404]],
    [MirrorNodeClient.GET_BALANCE_ENDPOINT, [404]],
    [MirrorNodeClient.GET_BLOCK_ENDPOINT, [404]],
    [MirrorNodeClient.GET_BLOCKS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_ADDRESS_AND_TIMESTAMP_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_CONTRACTS_RESULTS_ACTIONS, [404]],
    [MirrorNodeClient.GET_CONTRACTS_RESULTS_OPCODES, [404]],
    [MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT, [404]],
    [MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT, [404]],
    [MirrorNodeClient.GET_TOKENS_ENDPOINT, [404]],
    [MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT, [404]],
    [MirrorNodeClient.CONTRACT_CALL_ENDPOINT, [404]],
    [MirrorNodeClient.CONTRACT_ADDRESS_STATE_ENDPOINT, [404]],
  ]);

  private static readonly ETHEREUM_TRANSACTION_TYPE = 'ETHEREUMTRANSACTION';

  private static readonly ORDER = {
    ASC: 'asc',
    DESC: 'desc',
  };

  private static readonly unknownServerErrorHttpStatusCode = 567;

  // The following constants are used in requests objects
  private static readonly X_API_KEY = 'x-api-key';
  private static readonly FORWARD_SLASH = '/';
  private static readonly HTTPS_PREFIX = 'https://';
  private static readonly API_V1_POST_FIX = 'api/v1/';
  private static readonly EMPTY_STRING = '';
  private static readonly REQUEST_PREFIX_SEPARATOR = ': ';
  private static readonly REQUEST_PREFIX_TRAILING_BRACKET = ']';
  private static readonly HTTP_GET = 'GET';
  private static readonly REQUESTID_LABEL = 'requestId';

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

  /**
   * The histogram used for tracking the response time of the mirror node.
   * @private
   */
  private readonly mirrorResponseHistogram: Histogram;

  /**
   * The cache service used for caching responses.
   * @private
   */
  private readonly cacheService: CacheService;

  static readonly EVM_ADDRESS_REGEX: RegExp = /\/accounts\/([\d\.]+)/;

  static mirrorNodeContractResultsPageMax = parseInt(process.env.MIRROR_NODE_CONTRACT_RESULTS_PG_MAX!) || 25;
  static mirrorNodeContractResultsLogsPageMax = parseInt(process.env.MIRROR_NODE_CONTRACT_RESULTS_LOGS_PG_MAX!) || 200;

  protected createAxiosClient(baseUrl: string): AxiosInstance {
    // defualt values for axios clients to mirror node
    const mirrorNodeTimeout = parseInt(process.env.MIRROR_NODE_TIMEOUT || '10000');
    const mirrorNodeMaxRedirects = parseInt(process.env.MIRROR_NODE_MAX_REDIRECTS || '5');
    const mirrorNodeHttpKeepAlive = process.env.MIRROR_NODE_HTTP_KEEP_ALIVE === 'false' ? false : true;
    const mirrorNodeHttpKeepAliveMsecs = parseInt(process.env.MIRROR_NODE_HTTP_KEEP_ALIVE_MSECS || '1000');
    const mirrorNodeHttpMaxSockets = parseInt(process.env.MIRROR_NODE_HTTP_MAX_SOCKETS || '300');
    const mirrorNodeHttpMaxTotalSockets = parseInt(process.env.MIRROR_NODE_HTTP_MAX_TOTAL_SOCKETS || '300');
    const mirrorNodeHttpSocketTimeout = parseInt(process.env.MIRROR_NODE_HTTP_SOCKET_TIMEOUT || '60000');
    const isDevMode = process.env.DEV_MODE && process.env.DEV_MODE === 'true';
    const mirrorNodeRetries = parseInt(process.env.MIRROR_NODE_RETRIES || '0'); // we are in the process of deprecating this feature
    const mirrorNodeRetriesDevMode = parseInt(process.env.MIRROR_NODE_RETRIES_DEVMODE || '5');
    const mirrorNodeRetryDelay = this.MIRROR_NODE_RETRY_DELAY;
    const mirrorNodeRetryDelayDevMode = parseInt(process.env.MIRROR_NODE_RETRY_DELAY_DEVMODE || '200');
    const mirrorNodeRetryErrorCodes: Array<number> = process.env.MIRROR_NODE_RETRY_CODES
      ? JSON.parse(process.env.MIRROR_NODE_RETRY_CODES)
      : []; // we are in the process of deprecating this feature
    // by default will be true, unless explicitly set to false.
    const useCacheableDnsLookup: boolean = process.env.MIRROR_NODE_AGENT_CACHEABLE_DNS === 'false' ? false : true;

    const httpAgent = new http.Agent({
      keepAlive: mirrorNodeHttpKeepAlive,
      keepAliveMsecs: mirrorNodeHttpKeepAliveMsecs,
      maxSockets: mirrorNodeHttpMaxSockets,
      maxTotalSockets: mirrorNodeHttpMaxTotalSockets,
      timeout: mirrorNodeHttpSocketTimeout,
    });

    const httpsAgent = new https.Agent({
      keepAlive: mirrorNodeHttpKeepAlive,
      keepAliveMsecs: mirrorNodeHttpKeepAliveMsecs,
      maxSockets: mirrorNodeHttpMaxSockets,
      maxTotalSockets: mirrorNodeHttpMaxTotalSockets,
      timeout: mirrorNodeHttpSocketTimeout,
    });

    if (useCacheableDnsLookup) {
      betterLookupInstall(httpAgent);
      betterLookupInstall(httpsAgent);
    }

    const axiosClient: AxiosInstance = Axios.create({
      baseURL: baseUrl,
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: mirrorNodeTimeout,
      maxRedirects: mirrorNodeMaxRedirects,
      // set http agent options to optimize performance - https://nodejs.org/api/http.html#new-agentoptions
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
    });

    // Custom headers
    if (process.env.MIRROR_NODE_URL_HEADER_X_API_KEY) {
      axiosClient.defaults.headers.common[MirrorNodeClient.X_API_KEY] = process.env.MIRROR_NODE_URL_HEADER_X_API_KEY;
    }

    //@ts-ignore
    axiosRetry(axiosClient, {
      retries: isDevMode ? mirrorNodeRetriesDevMode : mirrorNodeRetries,
      retryDelay: (retryCount, error) => {
        const request = error?.request?._header;
        // extract request id from request header. Request is located in 4th element separated by new line
        const requestId = request ? request.split('\n')[3].substring(11, 47) : '';
        const requestIdPrefix = formatRequestIdMessage(requestId);
        const delay = isDevMode ? mirrorNodeRetryDelayDevMode || 200 : mirrorNodeRetryDelay * retryCount;
        this.logger.trace(`${requestIdPrefix} Retry delay ${delay} ms on '${error?.request?.path}'`);
        return delay;
      },
      retryCondition: (error) => {
        return !error?.response?.status || mirrorNodeRetryErrorCodes.includes(error?.response?.status);
      },
      shouldResetTimeout: true,
    });

    return axiosClient;
  }

  constructor(
    restUrl: string,
    logger: Logger,
    register: Registry,
    cacheService: CacheService,
    restClient?: AxiosInstance,
    web3Url?: string,
    web3Client?: AxiosInstance,
  ) {
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
    this.register.removeSingleMetric(metricHistogramName);
    this.mirrorResponseHistogram = new Histogram({
      name: metricHistogramName,
      help: 'Mirror node response method statusCode latency histogram',
      labelNames: ['method', 'statusCode'],
      registers: [register],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000], // ms (milliseconds)
    });

    this.logger.info(
      `Mirror Node client successfully configured to REST url: ${this.restUrl} and Web3 url: ${this.web3Url} `,
    );
    this.cacheService = cacheService;

    // set  up eth call  accepted error codes.
    if (process.env.ETH_CALL_ACCEPTED_ERRORS) {
      MirrorNodeClient.acceptedErrorStatusesResponsePerRequestPathMap.set(
        MirrorNodeClient.CONTRACT_CALL_ENDPOINT,
        JSON.parse(process.env.ETH_CALL_ACCEPTED_ERRORS),
      );
    }
  }

  private buildUrl(baseUrl: string): string {
    if (!baseUrl.match(/^https?:\/\//)) {
      baseUrl = `${MirrorNodeClient.HTTPS_PREFIX}${baseUrl}`;
    }

    if (!baseUrl.match(/\/$/)) {
      baseUrl = `${baseUrl}${MirrorNodeClient.FORWARD_SLASH}`;
    }

    return `${baseUrl}${MirrorNodeClient.API_V1_POST_FIX}`;
  }

  private async request<T>(
    path: string,
    pathLabel: string,
    method: REQUEST_METHODS,
    data?: any,
    requestIdPrefix?: string,
    retries?: number,
  ): Promise<T | null> {
    const start = Date.now();
    // extract request id from prefix and remove trailing ']' character
    const requestId =
      requestIdPrefix
        ?.split(MirrorNodeClient.REQUEST_PREFIX_SEPARATOR)[1]
        .replace(MirrorNodeClient.REQUEST_PREFIX_TRAILING_BRACKET, MirrorNodeClient.EMPTY_STRING) ||
      MirrorNodeClient.EMPTY_STRING;
    const controller = new AbortController();
    try {
      const axiosRequestConfig: AxiosRequestConfig = {
        headers: {
          [MirrorNodeClient.REQUESTID_LABEL]: requestId,
        },
        signal: controller.signal,
      };

      // request specific config for axios-retry
      if (retries != null) {
        axiosRequestConfig['axios-retry'] = { retries };
      }

      let response: AxiosResponse<T, any>;
      if (method === MirrorNodeClient.HTTP_GET) {
        if (pathLabel == MirrorNodeClient.GET_CONTRACTS_RESULTS_OPCODES) {
          response = await this.web3Client.get<T>(path, axiosRequestConfig);
        } else {
          response = await this.restClient.get<T>(path, axiosRequestConfig);
        }
      } else {
        response = await this.web3Client.post<T>(path, data, axiosRequestConfig);
      }

      const ms = Date.now() - start;
      this.logger.debug(`${requestId} [${method}] ${path} ${response.status} ${ms} ms`);
      this.mirrorResponseHistogram.labels(pathLabel, response.status?.toString()).observe(ms);
      return response.data;
    } catch (error: any) {
      const ms = Date.now() - start;
      const effectiveStatusCode =
        error.response?.status ||
        MirrorNodeClientError.ErrorCodes[error.code] ||
        MirrorNodeClient.unknownServerErrorHttpStatusCode;
      this.mirrorResponseHistogram.labels(pathLabel, effectiveStatusCode).observe(ms);

      // always abort the request on failure as the axios call can hang until the parent code/stack times out (might be a few minutes in a server-side applications)
      controller.abort();

      this.handleError(error, path, pathLabel, effectiveStatusCode, method, requestIdPrefix);
    }

    return null;
  }

  async get<T = any>(path: string, pathLabel: string, requestIdPrefix?: string, retries?: number): Promise<T | null> {
    return this.request<T>(path, pathLabel, 'GET', null, requestIdPrefix, retries);
  }

  async post<T = any>(
    path: string,
    data: any,
    pathLabel: string,
    requestIdPrefix?: string,
    retries?: number,
  ): Promise<T | null> {
    if (!data) data = {};
    return this.request<T>(path, pathLabel, 'POST', data, requestIdPrefix, retries);
  }

  /**
   * @returns null if the error code is in the accepted error responses,
   * @throws MirrorNodeClientError if the error code is not in the accepted error responses.
   */
  handleError(
    error: any,
    path: string,
    pathLabel: string,
    effectiveStatusCode: number,
    method: REQUEST_METHODS,
    requestIdPrefix?: string,
  ): null {
    const mirrorError = new MirrorNodeClientError(error, effectiveStatusCode);
    const acceptedErrorResponses = MirrorNodeClient.acceptedErrorStatusesResponsePerRequestPathMap.get(pathLabel);

    if (error.response && acceptedErrorResponses?.includes(effectiveStatusCode)) {
      this.logger.debug(`${requestIdPrefix} [${method}] ${path} ${effectiveStatusCode} status`);
      return null;
    }

    // Contract Call returns 400 for a CONTRACT_REVERT but is a valid response, expected and should not be logged as error:
    if (pathLabel === MirrorNodeClient.CONTRACT_CALL_ENDPOINT && effectiveStatusCode === 400) {
      this.logger.debug(
        `${requestIdPrefix} [${method}] ${path} Contract Revert: ( StatusCode: '${effectiveStatusCode}', StatusText: '${
          error.response.statusText
        }', Detail: '${JSON.stringify(error.response.detail)}',Data: '${JSON.stringify(error.response.data)}')`,
      );
    } else {
      this.logger.error(
        new Error(error.message),
        `${requestIdPrefix} [${method}] ${path} ${effectiveStatusCode} status`,
      );
    }

    throw mirrorError;
  }

  async getPaginatedResults(
    url: string,
    pathLabel: string,
    resultProperty: string,
    requestIdPrefix?: string,
    results = [],
    page = 1,
    pageMax: number = constants.MAX_MIRROR_NODE_PAGINATION,
  ) {
    const result = await this.get(url, pathLabel, requestIdPrefix);

    if (result && result[resultProperty]) {
      results = results.concat(result[resultProperty]);
    }

    if (page === pageMax) {
      // max page reached
      this.logger.trace(`${requestIdPrefix} Max page reached ${pageMax} with ${results.length} results`);
      throw predefined.PAGINATION_MAX(pageMax);
    }

    if (result?.links?.next && page < pageMax) {
      page++;
      const next = result.links.next.replace(constants.NEXT_LINK_PREFIX, '');
      return this.getPaginatedResults(next, pathLabel, resultProperty, requestIdPrefix, results, page, pageMax);
    } else {
      return results;
    }
  }

  public async getAccount(idOrAliasOrEvmAddress: string, requestIdPrefix?: string, retries?: number) {
    return this.get(
      `${MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT}${idOrAliasOrEvmAddress}?transactions=false`,
      MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT,
      requestIdPrefix,
      retries,
    );
  }

  public async getAccountLatestEthereumTransactionsByTimestamp(
    idOrAliasOrEvmAddress: string,
    timestampTo: string,
    numberOfTransactions: number = 1,
    requestIdPrefix?: string,
  ) {
    const queryParamObject = {};
    this.setQueryParam(
      queryParamObject,
      MirrorNodeClient.ACCOUNT_TRANSACTION_TYPE_PROPERTY,
      MirrorNodeClient.ETHEREUM_TRANSACTION_TYPE,
    );
    this.setQueryParam(queryParamObject, MirrorNodeClient.ACCOUNT_TIMESTAMP_PROPERTY, `lte:${timestampTo}`);
    this.setLimitOrderParams(
      queryParamObject,
      this.getLimitOrderQueryParam(numberOfTransactions, constants.ORDER.DESC),
    ); // get latest 2 transactions to infer for single case
    const queryParams = this.getQueryParams(queryParamObject);

    return this.get(
      `${MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT}${idOrAliasOrEvmAddress}${queryParams}`,
      MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT,
      requestIdPrefix,
    );
  }

  public async getAccountPageLimit(idOrAliasOrEvmAddress: string, requestIdPrefix?: string) {
    return this.get(
      `${MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT}${idOrAliasOrEvmAddress}?limit=${constants.MIRROR_NODE_QUERY_LIMIT}`,
      MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT,
      requestIdPrefix,
    );
  }
  /*******************************************************************************
   * To be used to make paginated calls for the account information when the
   * transaction count exceeds the constant MIRROR_NODE_QUERY_LIMIT.
   *******************************************************************************/
  public async getAccountPaginated(url: string, requestIdPrefix?: string) {
    const queryParamObject = {};
    const accountId = this.extractAccountIdFromUrl(url, requestIdPrefix);
    const params = new URLSearchParams(url.split('?')[1]);

    this.setQueryParam(queryParamObject, 'limit', constants.MIRROR_NODE_QUERY_LIMIT);
    this.setQueryParam(queryParamObject, 'timestamp', params.get('timestamp'));
    const queryParams = this.getQueryParams(queryParamObject);

    return this.getPaginatedResults(
      `${MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT}${accountId}${queryParams}`,
      MirrorNodeClient.GET_ACCOUNTS_BY_ID_ENDPOINT,
      'transactions',
      requestIdPrefix,
    );
  }

  public extractAccountIdFromUrl(url: string, requestIdPrefix?: string): string | null {
    const substringStartIndex = url.indexOf('/accounts/') + '/accounts/'.length;
    if (url.startsWith('0x', substringStartIndex)) {
      // evm addresss
      const regex = /\/accounts\/(0x[a-fA-F0-9]{40})/;
      const match = url.match(regex);
      const accountId = match ? match[1] : null;
      if (!accountId) {
        this.logger.error(`${requestIdPrefix} Unable to extract evm address from url ${url}`);
      }
      return String(accountId);
    } else {
      // account id
      const match = url.match(MirrorNodeClient.EVM_ADDRESS_REGEX);
      const accountId = match ? match[1] : null;
      if (!accountId) {
        this.logger.error(`${requestIdPrefix} Unable to extract account ID from url ${url}`);
      }
      return String(accountId);
    }
  }

  public async getTransactionsForAccount(
    accountId: string,
    timestampFrom: string,
    timestampTo: string,
    requestIdPrefix?: string,
  ) {
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'account.id', accountId);
    this.setQueryParam(queryParamObject, 'timestamp', `gte:${timestampFrom}`);
    this.setQueryParam(queryParamObject, 'timestamp', `lt:${timestampTo}`);
    const queryParams = this.getQueryParams(queryParamObject);

    return this.getPaginatedResults(
      `${MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT,
      'transactions',
      requestIdPrefix,
    );
  }

  public async getBalanceAtTimestamp(accountId: string, timestamp?: string, requestIdPrefix?: string) {
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'account.id', accountId);
    this.setQueryParam(queryParamObject, 'timestamp', timestamp);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.get(
      `${MirrorNodeClient.GET_BALANCE_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_BALANCE_ENDPOINT,
      requestIdPrefix,
    );
  }

  public async getBlock(hashOrBlockNumber: string | number, requestIdPrefix?: string) {
    const cachedLabel = `${constants.CACHE_KEY.GET_BLOCK}.${hashOrBlockNumber}`;
    const cachedResponse: any = await this.cacheService.getAsync(
      cachedLabel,
      MirrorNodeClient.GET_BLOCK_ENDPOINT,
      requestIdPrefix,
    );
    if (cachedResponse) {
      return cachedResponse;
    }

    const block = await this.get(
      `${MirrorNodeClient.GET_BLOCK_ENDPOINT}${hashOrBlockNumber}`,
      MirrorNodeClient.GET_BLOCK_ENDPOINT,
      requestIdPrefix,
    );

    await this.cacheService.set(cachedLabel, block, MirrorNodeClient.GET_BLOCK_ENDPOINT, undefined, requestIdPrefix);
    return block;
  }

  public async getBlocks(
    blockNumber?: number | string[],
    timestamp?: string,
    limitOrderParams?: ILimitOrderParams,
    requestIdPrefix?: string,
  ) {
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'block.number', blockNumber);
    this.setQueryParam(queryParamObject, 'timestamp', timestamp);
    this.setLimitOrderParams(queryParamObject, limitOrderParams);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.get(
      `${MirrorNodeClient.GET_BLOCKS_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_BLOCKS_ENDPOINT,
      requestIdPrefix,
    );
  }

  public async getContract(contractIdOrAddress: string, requestIdPrefix?: string, retries?: number) {
    return this.get(
      `${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`,
      MirrorNodeClient.GET_CONTRACT_ENDPOINT,
      requestIdPrefix,
      retries,
    );
  }

  public getIsValidContractCacheLabel(contractIdOrAddress): string {
    return `${constants.CACHE_KEY.GET_CONTRACT}.valid.${contractIdOrAddress}`;
  }

  public async getIsValidContractCache(contractIdOrAddress, requestIdPrefix?: string): Promise<any> {
    const cachedLabel = this.getIsValidContractCacheLabel(contractIdOrAddress);
    return await this.cacheService.getAsync(cachedLabel, MirrorNodeClient.GET_CONTRACT_ENDPOINT, requestIdPrefix);
  }

  public async isValidContract(contractIdOrAddress: string, requestIdPrefix?: string, retries?: number) {
    const cachedResponse: any = await this.getIsValidContractCache(contractIdOrAddress, requestIdPrefix);
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    const contract = await this.getContractId(contractIdOrAddress, requestIdPrefix, retries);
    const valid = contract != null;

    const cachedLabel = this.getIsValidContractCacheLabel(contractIdOrAddress);
    await this.cacheService.set(
      cachedLabel,
      valid,
      MirrorNodeClient.GET_CONTRACT_ENDPOINT,
      constants.CACHE_TTL.ONE_DAY,
      requestIdPrefix,
    );
    return valid;
  }

  public async getContractId(contractIdOrAddress: string, requestIdPrefix?: string, retries?: number) {
    const cachedLabel = `${constants.CACHE_KEY.GET_CONTRACT}.id.${contractIdOrAddress}`;
    const cachedResponse: any = await this.cacheService.getAsync(
      cachedLabel,
      MirrorNodeClient.GET_CONTRACT_ENDPOINT,
      requestIdPrefix,
    );
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    const contract = await this.get(
      `${MirrorNodeClient.GET_CONTRACT_ENDPOINT}${contractIdOrAddress}`,
      MirrorNodeClient.GET_CONTRACT_ENDPOINT,
      requestIdPrefix,
      retries,
    );

    if (contract != null) {
      const id = contract.contract_id;
      await this.cacheService.set(
        cachedLabel,
        id,
        MirrorNodeClient.GET_CONTRACT_ENDPOINT,
        constants.CACHE_TTL.ONE_DAY,
        requestIdPrefix,
      );
      return id;
    }

    return null;
  }

  public async getContractResult(transactionIdOrHash: string, requestIdPrefix?: string) {
    const cacheKey = `${constants.CACHE_KEY.GET_CONTRACT_RESULT}.${transactionIdOrHash}`;
    const cachedResponse = await this.cacheService.getAsync(cacheKey, MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT);

    if (cachedResponse) {
      return cachedResponse;
    }

    const response = await this.get(
      `${MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT}${transactionIdOrHash}`,
      MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT,
      requestIdPrefix,
    );

    if (
      response != undefined &&
      response.transaction_index != undefined &&
      response.block_number != undefined &&
      response.result === 'SUCCESS'
    ) {
      await this.cacheService.set(
        cacheKey,
        response,
        MirrorNodeClient.GET_CONTRACT_RESULT_ENDPOINT,
        constants.CACHE_TTL.ONE_HOUR,
        requestIdPrefix,
      );
    }

    return response;
  }

  /**
   * In some very rare cases the /contracts/results api is called before all the data is saved in
   * the mirror node DB and `transaction_index` or `block_number` is returned as `undefined`. A single re-fetch is sufficient to
   * resolve this problem.
   * @param transactionIdOrHash
   * @param requestIdPrefix
   */
  public async getContractResultWithRetry(transactionIdOrHash: string, requestIdPrefix?: string) {
    const contractResult = await this.getContractResult(transactionIdOrHash, requestIdPrefix);
    if (contractResult && !(contractResult.transaction_index && contractResult.block_number)) {
      return this.getContractResult(transactionIdOrHash, requestIdPrefix);
    }
    return contractResult;
  }

  public async getContractResults(
    contractResultsParams?: IContractResultsParams,
    limitOrderParams?: ILimitOrderParams,
    requestIdPrefix?: string,
  ) {
    const queryParamObject = {};
    this.setContractResultsParams(queryParamObject, contractResultsParams);
    this.setLimitOrderParams(queryParamObject, limitOrderParams);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.getPaginatedResults(
      `${MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_CONTRACT_RESULTS_ENDPOINT,
      'results',
      requestIdPrefix,
      [],
      1,
      MirrorNodeClient.mirrorNodeContractResultsPageMax,
    );
  }

  public async getContractResultsDetails(contractId: string, timestamp: string, requestIdPrefix?: string) {
    return this.get(
      `${this.getContractResultsDetailsByContractIdAndTimestamp(contractId, timestamp)}`,
      MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT,
      requestIdPrefix,
    );
  }

  public async getContractsResultsActions(transactionIdOrHash: string, requestIdPrefix?: string): Promise<any> {
    return this.get(
      `${this.getContractResultsActionsByTransactionIdPath(transactionIdOrHash)}`,
      MirrorNodeClient.GET_CONTRACTS_RESULTS_ACTIONS,
      requestIdPrefix,
    );
  }

  public async getContractsResultsOpcodes(
    transactionIdOrHash: string,
    requestIdPrefix?: string,
    params?: { memory?: boolean; stack?: boolean; storage?: boolean },
  ): Promise<IOpcodesResponse | null> {
    const queryParams = params ? this.getQueryParams(params) : '';
    return this.get<IOpcodesResponse>(
      `${this.getContractResultsOpcodesByTransactionIdPath(transactionIdOrHash)}${queryParams}`,
      MirrorNodeClient.GET_CONTRACTS_RESULTS_OPCODES,
      requestIdPrefix,
    );
  }

  public async getContractResultsByAddress(
    contractIdOrAddress: string,
    contractResultsParams?: IContractResultsParams,
    limitOrderParams?: ILimitOrderParams,
    requestIdPrefix?: string,
  ) {
    const queryParamObject = {};
    this.setContractResultsParams(queryParamObject, contractResultsParams);
    this.setLimitOrderParams(queryParamObject, limitOrderParams);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.get(
      `${MirrorNodeClient.getContractResultsByAddressPath(contractIdOrAddress)}${queryParams}`,
      MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT,
      requestIdPrefix,
    );
  }

  public async getContractResultsByAddressAndTimestamp(
    contractIdOrAddress: string,
    timestamp: string,
    requestIdPrefix?: string,
  ) {
    const apiPath = MirrorNodeClient.getContractResultsByAddressAndTimestampPath(contractIdOrAddress, timestamp);
    return this.get(
      apiPath,
      MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_ADDRESS_AND_TIMESTAMP_ENDPOINT,
      requestIdPrefix,
    );
  }

  private prepareLogsParams(
    contractLogsResultsParams?: IContractLogsResultsParams,
    limitOrderParams?: ILimitOrderParams,
  ) {
    const queryParamObject = {};
    if (contractLogsResultsParams) {
      this.setQueryParam(queryParamObject, 'transaction.hash', contractLogsResultsParams['transaction.hash']);
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
    requestIdPrefix?: string,
  ) {
    const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);

    return this.getPaginatedResults(
      `${MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_ENDPOINT,
      MirrorNodeClient.CONTRACT_RESULT_LOGS_PROPERTY,
      requestIdPrefix,
      [],
      1,
      MirrorNodeClient.mirrorNodeContractResultsLogsPageMax,
    );
  }

  public async getContractResultsLogsByAddress(
    address: string,
    contractLogsResultsParams?: IContractLogsResultsParams,
    limitOrderParams?: ILimitOrderParams,
    requestIdPrefix?: string,
  ) {
    if (address === ethers.ZeroAddress) return [];

    const queryParams = this.prepareLogsParams(contractLogsResultsParams, limitOrderParams);
    const apiEndpoint = MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT.replace(
      MirrorNodeClient.ADDRESS_PLACEHOLDER,
      address,
    );

    return this.getPaginatedResults(
      `${apiEndpoint}${queryParams}`,
      MirrorNodeClient.GET_CONTRACT_RESULT_LOGS_BY_ADDRESS_ENDPOINT,
      MirrorNodeClient.CONTRACT_RESULT_LOGS_PROPERTY,
      requestIdPrefix,
      [],
      1,
      MirrorNodeClient.mirrorNodeContractResultsLogsPageMax,
    );
  }

  public async getEarliestBlock(requestId?: string) {
    const cachedLabel = `${constants.CACHE_KEY.GET_BLOCK}.earliest`;
    const cachedResponse: any = await this.cacheService.getAsync(
      cachedLabel,
      MirrorNodeClient.GET_BLOCKS_ENDPOINT,
      requestId,
    );
    if (cachedResponse != undefined) {
      return cachedResponse;
    }

    const blocks = await this.getBlocks(
      undefined,
      undefined,
      this.getLimitOrderQueryParam(1, MirrorNodeClient.ORDER.ASC),
      requestId,
    );
    if (blocks && blocks.blocks.length > 0) {
      const block = blocks.blocks[0];
      await this.cacheService.set(
        cachedLabel,
        block,
        MirrorNodeClient.GET_BLOCKS_ENDPOINT,
        constants.CACHE_TTL.ONE_DAY,
        requestId,
      );
      return block;
    }

    return null;
  }

  public async getLatestBlock(requestIdPrefix?: string) {
    return this.getBlocks(
      undefined,
      undefined,
      this.getLimitOrderQueryParam(1, MirrorNodeClient.ORDER.DESC),
      requestIdPrefix,
    );
  }

  public getLimitOrderQueryParam(limit: number, order: string): ILimitOrderParams {
    return { limit: limit, order: order };
  }

  public async getNetworkExchangeRate(requestId: string, timestamp?: string) {
    const formattedRequestId = formatRequestIdMessage(requestId);
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'timestamp', timestamp);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.get(
      `${MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_NETWORK_EXCHANGERATE_ENDPOINT,
      formattedRequestId,
    );
  }

  public async getNetworkFees(timestamp?: string, order?: string, requestIdPrefix?: string) {
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'timestamp', timestamp);
    this.setQueryParam(queryParamObject, 'order', order);
    const queryParams = this.getQueryParams(queryParamObject);
    return this.get(
      `${MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT}${queryParams}`,
      MirrorNodeClient.GET_NETWORK_FEES_ENDPOINT,
      requestIdPrefix,
    );
  }

  private static getContractResultsByAddressPath(address: string) {
    return MirrorNodeClient.GET_CONTRACT_RESULTS_BY_ADDRESS_ENDPOINT.replace(
      MirrorNodeClient.ADDRESS_PLACEHOLDER,
      address,
    );
  }

  private static getContractResultsByAddressAndTimestampPath(address: string, timestamp: string) {
    return MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_ADDRESS_AND_TIMESTAMP_ENDPOINT.replace(
      MirrorNodeClient.ADDRESS_PLACEHOLDER,
      address,
    ).replace(MirrorNodeClient.TIMESTAMP_PLACEHOLDER, timestamp);
  }

  public getContractResultsDetailsByContractIdAndTimestamp(contractId: string, timestamp: string) {
    return MirrorNodeClient.GET_CONTRACT_RESULTS_DETAILS_BY_CONTRACT_ID_ENDPOINT.replace(
      MirrorNodeClient.CONTRACT_ID_PLACEHOLDER,
      contractId,
    ).replace(MirrorNodeClient.TIMESTAMP_PLACEHOLDER, timestamp);
  }

  private getContractResultsActionsByTransactionIdPath(transactionIdOrHash: string) {
    return MirrorNodeClient.GET_CONTRACTS_RESULTS_ACTIONS.replace(
      MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER,
      transactionIdOrHash,
    );
  }

  private getContractResultsOpcodesByTransactionIdPath(transactionIdOrHash: string) {
    return MirrorNodeClient.GET_CONTRACTS_RESULTS_OPCODES.replace(
      MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER,
      transactionIdOrHash,
    );
  }

  public async getTokenById(tokenId: string, requestIdPrefix?: string, retries?: number) {
    return this.get(
      `${MirrorNodeClient.GET_TOKENS_ENDPOINT}/${tokenId}`,
      MirrorNodeClient.GET_TOKENS_ENDPOINT,
      requestIdPrefix,
      retries,
    );
  }

  public async getLatestContractResultsByAddress(
    address: string,
    blockEndTimestamp: string | undefined,
    limit: number,
    requestIdPrefix?: string,
  ) {
    // retrieve the timestamp of the contract
    const contractResultsParams: IContractResultsParams = blockEndTimestamp
      ? { timestamp: `lte:${blockEndTimestamp}` }
      : {};
    const limitOrderParams: ILimitOrderParams = this.getLimitOrderQueryParam(limit, 'desc');
    return this.getContractResultsByAddress(address, contractResultsParams, limitOrderParams, requestIdPrefix);
  }

  public async getContractStateByAddressAndSlot(
    address: string,
    slot: string,
    blockEndTimestamp?: string,
    requestIdPrefix?: string,
  ) {
    const limitOrderParams: ILimitOrderParams = this.getLimitOrderQueryParam(
      constants.MIRROR_NODE_QUERY_LIMIT,
      constants.ORDER.DESC,
    );
    const queryParamObject = {};

    if (blockEndTimestamp) {
      this.setQueryParam(queryParamObject, 'timestamp', blockEndTimestamp);
    }
    this.setQueryParam(queryParamObject, 'slot', slot);
    this.setLimitOrderParams(queryParamObject, limitOrderParams);
    const queryParams = this.getQueryParams(queryParamObject);
    const apiEndpoint = MirrorNodeClient.CONTRACT_ADDRESS_STATE_ENDPOINT.replace(
      MirrorNodeClient.ADDRESS_PLACEHOLDER,
      address,
    );
    return this.get(`${apiEndpoint}${queryParams}`, MirrorNodeClient.CONTRACT_ADDRESS_STATE_ENDPOINT, requestIdPrefix);
  }

  /**
   * Send a contract call request to mirror node
   * @param callData {IContractCallRequest} contract call request data
   * @param requestIdPrefix {string} optional request id prefix
   */
  public async postContractCall(
    callData: IContractCallRequest,
    requestIdPrefix?: string,
  ): Promise<IContractCallResponse | null> {
    return this.post(
      MirrorNodeClient.CONTRACT_CALL_ENDPOINT,
      callData,
      MirrorNodeClient.CONTRACT_CALL_ENDPOINT,
      requestIdPrefix,
      1, // historical blocks might need 1 retry due to possible timeout from mirror node
    );
  }

  public async getTransactionByHash(transactionHash: string, requestIdPrefix?: string) {
    const apiEndpoint = MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT_TRANSACTION_HASH.replace(
      MirrorNodeClient.TRANSACTION_HASH_PLACEHOLDER,
      transactionHash,
    );
    return this.get(apiEndpoint, MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT, requestIdPrefix);
  }

  public async getTransactionById(transactionId: string, nonce: number | undefined, requestIdPrefix?: string) {
    const formattedId = formatTransactionId(transactionId);
    if (formattedId == null) {
      return formattedId;
    }
    const queryParamObject = {};
    this.setQueryParam(queryParamObject, 'nonce', nonce);
    const queryParams = this.getQueryParams(queryParamObject);
    const apiEndpoint = MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT_TRANSACTION_ID.replace(
      MirrorNodeClient.TRANSACTION_ID_PLACEHOLDER,
      formattedId,
    );
    return this.get(
      `${apiEndpoint}${queryParams}`,
      MirrorNodeClient.GET_TRANSACTIONS_ENDPOINT_TRANSACTION_ID,
      requestIdPrefix,
    );
  }

  /**
   * Check if transaction fail is because of contract revert and try to fetch and log the reason.
   *
   * @param e
   * @param requestIdPrefix
   */
  public async getContractRevertReasonFromTransaction(e: any, requestIdPrefix: string): Promise<any | undefined> {
    if (e instanceof SDKClientError && e.isContractRevertExecuted()) {
      const transactionId = e.message.match(constants.TRANSACTION_ID_REGEX);
      if (transactionId) {
        const tx = await this.getTransactionById(transactionId[0], undefined, requestIdPrefix);

        if (tx === null) {
          this.logger.error(`${requestIdPrefix} Transaction failed with null result`);
          return null;
        } else if (tx.length === 0) {
          this.logger.error(`${requestIdPrefix} Transaction failed with empty result`);
          return null;
        } else if (tx?.transactions.length > 1) {
          const result = tx.transactions[1].result;
          this.logger.error(`${requestIdPrefix} Transaction failed with result: ${result}`);
          return result;
        }
      }
    }
  }

  getQueryParams(params: object) {
    let paramString = '';
    for (const [key, value] of Object.entries(params)) {
      let additionalString = '';
      if (Array.isArray(value)) {
        additionalString = value.map((v) => `${key}=${v}`).join('&');
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
      this.setQueryParam(queryParamObject, 'limit', parseInt(process.env.MIRROR_NODE_LIMIT_PARAM || '100'));
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
   * @param searchableTypes the types to search for
   * @param callerName calling method name
   * @param requestIdPrefix the request id prefix message
   * @param retries the number of retries
   * @returns entity object or null if not found
   */
  public async resolveEntityType(
    entityIdentifier: string,
    searchableTypes: any[] = [constants.TYPE_CONTRACT, constants.TYPE_ACCOUNT, constants.TYPE_TOKEN],
    callerName: string,
    requestIdPrefix?: string,
    retries?: number,
  ) {
    const cachedLabel = `${constants.CACHE_KEY.RESOLVE_ENTITY_TYPE}_${entityIdentifier}`;
    const cachedResponse: { type: string; entity: any } | undefined = await this.cacheService.getAsync(
      cachedLabel,
      callerName,
      requestIdPrefix,
    );
    if (cachedResponse) {
      return cachedResponse;
    }

    const buildPromise = (fn) =>
      new Promise((resolve, reject) =>
        fn.then((values) => {
          if (values == null) reject();
          resolve(values);
        }),
      );

    if (searchableTypes.find((t) => t === constants.TYPE_CONTRACT)) {
      const contract = await this.getContract(entityIdentifier, requestIdPrefix, retries).catch(() => {
        return null;
      });
      if (contract) {
        const response = {
          type: constants.TYPE_CONTRACT,
          entity: contract,
        };
        await this.cacheService.set(cachedLabel, response, callerName, undefined, requestIdPrefix);
        return response;
      }
    }

    let data;
    try {
      const promises = [
        searchableTypes.find((t) => t === constants.TYPE_ACCOUNT)
          ? buildPromise(
              this.getAccount(entityIdentifier, requestIdPrefix, retries).catch(() => {
                return null;
              }),
            )
          : Promise.reject(),
      ];

      // only add long zero evm addresses for tokens as they do not refer to actual contract addresses but rather encoded entity nums
      if (entityIdentifier.startsWith(constants.LONG_ZERO_PREFIX)) {
        promises.push(
          searchableTypes.find((t) => t === constants.TYPE_TOKEN)
            ? buildPromise(
                this.getTokenById(`0.0.${parseInt(entityIdentifier, 16)}`, requestIdPrefix, retries).catch(() => {
                  return null;
                }),
              )
            : Promise.reject(),
        );
      }

      // maps the promises with indices of the promises array
      // because there is no such method as Promise.anyWithIndex in js
      // the index is needed afterward for detecting the resolved promise type (contract, account, or token)
      // @ts-ignore
      data = await Promise.any(promises.map((promise, index) => promise.then((value) => ({ value, index }))));
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
      entity: data.value,
    };
    await this.cacheService.set(cachedLabel, response, callerName, undefined, requestIdPrefix);
    return response;
  }

  // exposing mirror node instance for tests
  public getMirrorNodeRestInstance() {
    return this.restClient;
  }

  public getMirrorNodeWeb3Instance() {
    return this.web3Client;
  }
  public getMirrorNodeRequestRetryCount() {
    return this.MIRROR_NODE_REQUEST_RETRY_COUNT;
  }
  public getMirrorNodeRetryDelay() {
    return this.MIRROR_NODE_RETRY_DELAY;
  }

  /**
   * This method is intended to be used in cases when the default axios-retry settings do not provide
   * enough time for the expected data to be propagated to the Mirror node.
   * It provides a way to have an extended retry logic only in specific places
   */
  public async repeatedRequest(methodName: string, args: any[], repeatCount: number, requestId?: string) {
    let result;
    for (let i = 0; i < repeatCount; i++) {
      try {
        result = await this[methodName](...args, requestId);
      } catch (e: any) {
        // note: for some methods, it will throw 404 not found error as the record is not yet recorded in mirror-node
        //       if error is 404, `result` would be assigned as null for it to not break out the loop.
        //       Any other error will be notified in logs
        if (e.statusCode === 404) {
          result = null;
        } else {
          this.logger.warn(
            e,
            `${requestId} Error raised during polling mirror node for updated records: method=${methodName}, args=${args}`,
          );
        }
      }

      if (result) {
        break;
      }

      this.logger.trace(
        `${requestId} Repeating request ${methodName} with args ${JSON.stringify(
          args,
        )} retry count ${i} of ${repeatCount}. Waiting ${this.MIRROR_NODE_RETRY_DELAY} ms before repeating request`,
      );

      // Backoff before repeating request
      await new Promise((r) => setTimeout(r, this.MIRROR_NODE_RETRY_DELAY));
    }
    return result;
  }

  /**
   * Retrieves and processes transaction record metrics from the mirror node based on the provided transaction ID.
   *
   * @param {string} transactionId - The ID of the transaction for which the record is being retrieved.
   * @param {string} callerName - The name of the caller requesting the transaction record.
   * @param {string} requestId - The unique identifier for the request, used for logging and tracking.
   * @param {string} txConstructorName - The name of the transaction constructor associated with the transaction.
   * @param {string} operatorAccountId - The account ID of the operator, used to calculate transaction fees.
   * @returns {Promise<{ITransactionRecordMetric}>} - An object containing the transaction fee if available, or `undefined` if the transaction record is not found.
   * @throws {MirrorNodeClientError} - Throws an error if no transaction record is retrieved.
   */
  public async getTransactionRecordMetrics(
    transactionId: string,
    callerName: string,
    requestId: string,
    txConstructorName: string,
    operatorAccountId: string,
  ): Promise<ITransactionRecordMetric> {
    const formattedRequestId = formatRequestIdMessage(requestId);

    this.logger.trace(
      `${formattedRequestId} Get transaction record via mirror node: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}`,
    );

    const transactionRecords = await this.repeatedRequest(
      this.getTransactionById.name,
      [transactionId, 0],
      this.MIRROR_NODE_REQUEST_RETRY_COUNT,
      formattedRequestId,
    );

    if (!transactionRecords) {
      const notFoundMessage = `No transaction record retrieved: transactionId=${transactionId}, txConstructorName=${txConstructorName}, callerName=${callerName}.`;
      throw new MirrorNodeClientError({ message: notFoundMessage }, MirrorNodeClientError.statusCodes.NOT_FOUND);
    }

    const transactionRecord: IMirrorNodeTransactionRecord = transactionRecords.transactions.find(
      (tx: any) => tx.transaction_id === formatTransactionId(transactionId),
    );

    const mirrorNodeTxRecord = new MirrorNodeTransactionRecord(transactionRecord);

    const transactionFee = this.getTransferAmountSumForAccount(mirrorNodeTxRecord, operatorAccountId);
    return { transactionFee, txRecordChargeAmount: 0, gasUsed: 0, status: mirrorNodeTxRecord.result };
  }

  /**
   * Calculates the total sum of transfer amounts for a specific account from a transaction record.
   * This method filters the transfers in the transaction record to match the specified account ID,
   * then sums up the amounts by subtracting each transfer's amount from the accumulator.
   *
   * @param {MirrorNodeTransactionRecord} transactionRecord - The transaction record containing transfer details.
   * @param {string} accountId - The ID of the account for which the transfer sum is to be calculated.
   * @returns {number} The total sum of transfer amounts for the specified account.
   */
  public getTransferAmountSumForAccount(transactionRecord: MirrorNodeTransactionRecord, accountId: string): number {
    return transactionRecord.transfers
      .filter((transfer) => transfer.account === accountId)
      .reduce((acc, transfer) => {
        return acc - transfer.amount;
      }, 0);
  }
}
