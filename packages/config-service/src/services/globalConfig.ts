/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import { ConfigName } from './configName';

export interface ConfigProperty {
  envName: string;
  type: string;
  required: boolean;
  defaultValue: string | number | boolean | null;
}

export class GlobalConfig {
  public static readonly ENTRIES: Record<ConfigName, ConfigProperty> = {
    BATCH_REQUESTS_ENABLED: {
      envName: 'BATCH_REQUESTS_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    BATCH_REQUESTS_MAX_SIZE: {
      envName: 'BATCH_REQUESTS_MAX_SIZE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    CACHE_MAX: {
      envName: 'CACHE_MAX',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    CACHE_TTL: {
      envName: 'CACHE_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    CHAIN_ID: {
      envName: 'CHAIN_ID',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    CLIENT_TRANSPORT_SECURITY: {
      envName: 'CLIENT_TRANSPORT_SECURITY',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    CONSENSUS_MAX_EXECUTION_TIME: {
      envName: 'CONSENSUS_MAX_EXECUTION_TIME',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    CONTRACT_CALL_GAS_LIMIT: {
      envName: 'CONTRACT_CALL_GAS_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    CONTRACT_QUERY_TIMEOUT_RETRIES: {
      envName: 'CONTRACT_QUERY_TIMEOUT_RETRIES',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    DEBUG_API_ENABLED: {
      envName: 'DEBUG_API_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    DEFAULT_RATE_LIMIT: {
      envName: 'DEFAULT_RATE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    DEV_MODE: {
      envName: 'DEV_MODE',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    E2E_RELAY_HOST: {
      envName: 'E2E_RELAY_HOST',
      type: 'string',
      required: false,
      defaultValue: 'http://localhost:7546',
    },
    E2E_SERVER_PORT: {
      envName: 'E2E_SERVER_PORT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ESTIMATE_GAS_THROWS: {
      envName: 'ESTIMATE_GAS_THROWS',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    ETH_BLOCK_NUMBER_CACHE_TTL_MS: {
      envName: 'ETH_BLOCK_NUMBER_CACHE_TTL_MS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_CALL_ACCEPTED_ERRORS: {
      envName: 'ETH_CALL_ACCEPTED_ERRORS',
      type: 'array',
      required: false,
      defaultValue: null,
    },
    ETH_CALL_CACHE_TTL: {
      envName: 'ETH_CALL_CACHE_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_CALL_CONSENSUS_SELECTORS: {
      envName: 'ETH_CALL_CONSENSUS_SELECTORS',
      type: 'array',
      required: false,
      defaultValue: null,
    },
    ETH_CALL_DEFAULT_TO_CONSENSUS_NODE: {
      envName: 'ETH_CALL_DEFAULT_TO_CONSENSUS_NODE',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    ETH_FEE_HISTORY_FIXED: {
      envName: 'ETH_FEE_HISTORY_FIXED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    ETH_GET_BALANCE_CACHE_TTL_MS: {
      envName: 'ETH_GET_BALANCE_CACHE_TTL_MS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_GET_GAS_PRICE_CACHE_TTL_MS: {
      envName: 'ETH_GET_GAS_PRICE_CACHE_TTL_MS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_GET_LOGS_BLOCK_RANGE_LIMIT: {
      envName: 'ETH_GET_LOGS_BLOCK_RANGE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_GET_TRANSACTION_COUNT_CACHE_TTL: {
      envName: 'ETH_GET_TRANSACTION_COUNT_CACHE_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE: {
      envName: 'ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    HEDERA_SPECIFIC_REVERT_STATUSES: {
      envName: 'HEDERA_SPECIFIC_REVERT_STATUSES',
      type: 'string',
      required: false,
      defaultValue: '["WRONG_NONCE", "INVALID_ACCOUNT_ID"]',
    },
    FEE_HISTORY_MAX_RESULTS: {
      envName: 'FEE_HISTORY_MAX_RESULTS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    FILE_APPEND_CHUNK_SIZE: {
      envName: 'FILE_APPEND_CHUNK_SIZE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    FILE_APPEND_MAX_CHUNKS: {
      envName: 'FILE_APPEND_MAX_CHUNKS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    FILTER_API_ENABLED: {
      envName: 'FILTER_API_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    FILTER_TTL: {
      envName: 'FILTER_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    GAS_PRICE_PERCENTAGE_BUFFER: {
      envName: 'GAS_PRICE_PERCENTAGE_BUFFER',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    GAS_PRICE_TINY_BAR_BUFFER: {
      envName: 'GAS_PRICE_TINY_BAR_BUFFER',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    GET_RECORD_DEFAULT_TO_CONSENSUS_NODE: {
      envName: 'GET_RECORD_DEFAULT_TO_CONSENSUS_NODE',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    GH_ACCESS_TOKEN: {
      envName: 'GH_ACCESS_TOKEN',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    GITHUB_PR_NUMBER: {
      envName: 'GITHUB_PR_NUMBER',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    GITHUB_REPOSITORY: {
      envName: 'GITHUB_REPOSITORY',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    GITHUB_TOKEN: {
      envName: 'GITHUB_TOKEN',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    HAPI_CLIENT_DURATION_RESET: {
      envName: 'HAPI_CLIENT_DURATION_RESET',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    HAPI_CLIENT_ERROR_RESET: {
      envName: 'HAPI_CLIENT_ERROR_RESET',
      type: 'array',
      required: false,
      defaultValue: null,
    },
    HAPI_CLIENT_TRANSACTION_RESET: {
      envName: 'HAPI_CLIENT_TRANSACTION_RESET',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    HBAR_RATE_LIMIT_BASIC: {
      envName: 'HBAR_RATE_LIMIT_BASIC',
      type: 'number',
      required: false,
      defaultValue: 1_120_000_000, // 11.2 hbar
    },
    HBAR_RATE_LIMIT_EXTENDED: {
      envName: 'HBAR_RATE_LIMIT_EXTENDED',
      type: 'number',
      required: false,
      defaultValue: 3_200_000_000, // 32 hbar
    },
    HBAR_RATE_LIMIT_PRIVILEGED: {
      envName: 'HBAR_RATE_LIMIT_PRIVILEGED',
      type: 'number',
      required: false,
      defaultValue: 8_000_000_000, // 80 hbar
    },
    HBAR_RATE_LIMIT_DURATION: {
      envName: 'HBAR_RATE_LIMIT_DURATION',
      type: 'number',
      required: false,
      defaultValue: 86_400_000, // 24 hours
    },
    HBAR_RATE_LIMIT_TINYBAR: {
      envName: 'HBAR_RATE_LIMIT_TINYBAR',
      type: 'number',
      required: false,
      defaultValue: 800_000_000_000, // 8000 hbar
    },
    HEDERA_NETWORK: {
      envName: 'HEDERA_NETWORK',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    HBAR_SPENDING_PLANS_CONFIG: {
      envName: 'HBAR_SPENDING_PLANS_CONFIG',
      type: 'string',
      required: false,
      defaultValue: 'spendingPlansConfig.json',
    },
    INITIAL_BALANCE: {
      envName: 'INITIAL_BALANCE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    INPUT_SIZE_LIMIT: {
      envName: 'INPUT_SIZE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    LIMIT_DURATION: {
      envName: 'LIMIT_DURATION',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    LOCAL_NODE: {
      envName: 'LOCAL_NODE',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    LOG_LEVEL: {
      envName: 'LOG_LEVEL',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    MAX_BLOCK_RANGE: {
      envName: 'MAX_BLOCK_RANGE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MEMWATCH_ENABLED: {
      envName: 'MEMWATCH_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_AGENT_CACHEABLE_DNS: {
      envName: 'MIRROR_NODE_AGENT_CACHEABLE_DNS',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_CONTRACT_RESULTS_LOGS_PG_MAX: {
      envName: 'MIRROR_NODE_CONTRACT_RESULTS_LOGS_PG_MAX',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_CONTRACT_RESULTS_PG_MAX: {
      envName: 'MIRROR_NODE_CONTRACT_RESULTS_PG_MAX',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_HTTP_KEEP_ALIVE: {
      envName: 'MIRROR_NODE_HTTP_KEEP_ALIVE',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_HTTP_KEEP_ALIVE_MSECS: {
      envName: 'MIRROR_NODE_HTTP_KEEP_ALIVE_MSECS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_HTTP_MAX_SOCKETS: {
      envName: 'MIRROR_NODE_HTTP_MAX_SOCKETS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_HTTP_MAX_TOTAL_SOCKETS: {
      envName: 'MIRROR_NODE_HTTP_MAX_TOTAL_SOCKETS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_HTTP_SOCKET_TIMEOUT: {
      envName: 'MIRROR_NODE_HTTP_SOCKET_TIMEOUT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_LIMIT_PARAM: {
      envName: 'MIRROR_NODE_LIMIT_PARAM',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_MAX_REDIRECTS: {
      envName: 'MIRROR_NODE_MAX_REDIRECTS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_RETRIES: {
      envName: 'MIRROR_NODE_RETRIES',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_RETRIES_DEVMODE: {
      envName: 'MIRROR_NODE_RETRIES_DEVMODE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_RETRY_CODES: {
      envName: 'MIRROR_NODE_RETRY_CODES',
      type: 'array',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_RETRY_DELAY: {
      envName: 'MIRROR_NODE_RETRY_DELAY',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_RETRY_DELAY_DEVMODE: {
      envName: 'MIRROR_NODE_RETRY_DELAY_DEVMODE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_REQUEST_RETRY_COUNT: {
      envName: 'MIRROR_NODE_REQUEST_RETRY_COUNT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_TIMEOUT: {
      envName: 'MIRROR_NODE_TIMEOUT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_URL: {
      envName: 'MIRROR_NODE_URL',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    MIRROR_NODE_URL_HEADER_X_API_KEY: {
      envName: 'MIRROR_NODE_URL_HEADER_X_API_KEY',
      type: 'array',
      required: false,
      defaultValue: null,
    },
    MIRROR_NODE_URL_WEB3: {
      envName: 'MIRROR_NODE_URL_WEB3',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    MULTI_SET: {
      envName: 'MULTI_SET',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    // the actual env var in the node process is npm_package_version
    npm_package_version: {
      envName: 'npm_package_version',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    OPERATOR_ID_ETH_SENDRAWTRANSACTION: {
      envName: 'OPERATOR_ID_ETH_SENDRAWTRANSACTION',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    OPERATOR_ID_MAIN: {
      envName: 'OPERATOR_ID_MAIN',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    OPERATOR_KEY_ETH_SENDRAWTRANSACTION: {
      envName: 'OPERATOR_KEY_ETH_SENDRAWTRANSACTION',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    OPERATOR_KEY_FORMAT: {
      envName: 'OPERATOR_KEY_FORMAT',
      type: 'string',
      required: false,
      defaultValue: null,
    },
    OPERATOR_KEY_MAIN: {
      envName: 'OPERATOR_KEY_MAIN',
      type: 'string',
      required: true,
      defaultValue: null,
    },
    RATE_LIMIT_DISABLED: {
      envName: 'RATE_LIMIT_DISABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    REDIS_ENABLED: {
      envName: 'REDIS_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    REDIS_RECONNECT_DELAY_MS: {
      envName: 'REDIS_RECONNECT_DELAY_MS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    REDIS_URL: {
      envName: 'REDIS_URL',
      type: 'string',
      required: false,
      defaultValue: 'redis://127.0.0.1:6379',
    },
    REQUEST_ID_IS_OPTIONAL: {
      envName: 'REQUEST_ID_IS_OPTIONAL',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    SDK_REQUEST_TIMEOUT: {
      envName: 'SDK_REQUEST_TIMEOUT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    SEND_RAW_TRANSACTION_SIZE_LIMIT: {
      envName: 'SEND_RAW_TRANSACTION_SIZE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    SERVER_PORT: {
      envName: 'SERVER_PORT',
      type: 'number',
      required: false,
      defaultValue: 7546,
    },
    SERVER_REQUEST_TIMEOUT_MS: {
      envName: 'SERVER_REQUEST_TIMEOUT_MS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    SUBSCRIPTIONS_ENABLED: {
      envName: 'SUBSCRIPTIONS_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    TEST: {
      envName: 'TEST',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    TEST_GAS_PRICE_DEVIATION: {
      envName: 'TEST_GAS_PRICE_DEVIATION',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TEST_INITIAL_ACCOUNT_STARTING_BALANCE: {
      envName: 'TEST_INITIAL_ACCOUNT_STARTING_BALANCE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TEST_TRANSACTION_RECORD_COST_TOLERANCE: {
      envName: 'TEST_TRANSACTION_RECORD_COST_TOLERANCE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TEST_WS_SERVER: {
      envName: 'TEST_WS_SERVER',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    TIER_1_RATE_LIMIT: {
      envName: 'TIER_1_RATE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TIER_2_RATE_LIMIT: {
      envName: 'TIER_2_RATE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TIER_3_RATE_LIMIT: {
      envName: 'TIER_3_RATE_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    TX_DEFAULT_GAS: {
      envName: 'TX_DEFAULT_GAS',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    USE_ASYNC_TX_PROCESSING: {
      envName: 'USE_ASYNC_TX_PROCESSING',
      type: 'boolean',
      required: false,
      defaultValue: false,
    },
    WEB_SOCKET_HTTP_PORT: {
      envName: 'WEB_SOCKET_HTTP_PORT',
      type: 'number',
      required: false,
      defaultValue: 8547,
    },
    WEB_SOCKET_PORT: {
      envName: 'WEB_SOCKET_PORT',
      type: 'number',
      required: false,
      defaultValue: 8546,
    },
    WRITE_SNAPSHOT_ON_MEMORY_LEAK: {
      envName: 'WRITE_SNAPSHOT_ON_MEMORY_LEAK',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    WS_BATCH_REQUESTS_ENABLED: {
      envName: 'WS_BATCH_REQUESTS_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    WS_BATCH_REQUESTS_MAX_SIZE: {
      envName: 'WS_BATCH_REQUESTS_MAX_SIZE',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_CACHE_TTL: {
      envName: 'WS_CACHE_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_CONNECTION_LIMIT: {
      envName: 'WS_CONNECTION_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_CONNECTION_LIMIT_PER_IP: {
      envName: 'WS_CONNECTION_LIMIT_PER_IP',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_MAX_INACTIVITY_TTL: {
      envName: 'WS_MAX_INACTIVITY_TTL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_MULTIPLE_ADDRESSES_ENABLED: {
      envName: 'WS_MULTIPLE_ADDRESSES_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    WS_NEW_HEADS_ENABLED: {
      envName: 'WS_NEW_HEADS_ENABLED',
      type: 'boolean',
      required: false,
      defaultValue: true,
    },
    WS_PING_INTERVAL: {
      envName: 'WS_PING_INTERVAL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_POLLING_INTERVAL: {
      envName: 'WS_POLLING_INTERVAL',
      type: 'number',
      required: false,
      defaultValue: null,
    },
    WS_RELAY_URL: {
      envName: 'WS_RELAY_URL',
      type: 'string',
      required: false,
      defaultValue: 'ws://127.0.0.1:8546',
    },
    WS_SAME_SUB_FOR_SAME_EVENT: {
      envName: 'WS_SAME_SUB_FOR_SAME_EVENT',
      type: 'boolean',
      required: false,
      defaultValue: null,
    },
    WS_SUBSCRIPTION_LIMIT: {
      envName: 'WS_SUBSCRIPTION_LIMIT',
      type: 'number',
      required: false,
      defaultValue: null,
    },
  };
}
