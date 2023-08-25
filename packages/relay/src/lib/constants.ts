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

enum CACHE_KEY {
    ACCOUNT = 'account',
    ETH_BLOCK_NUMBER = 'eth_block_number',
    ETH_CALL = 'eth_call',
    ETH_GET_BALANCE = 'eth_get_balance',
    ETH_GET_BLOCK_BY_HASH = 'eth_getBlockByHash',
    ETH_GET_BLOCK_BY_NUMBER = 'eth_getBlockByNumber',
    ETH_GET_TRANSACTION_COUNT_BY_HASH = 'eth_getBlockTransactionCountByHash',
    ETH_GET_TRANSACTION_COUNT_BY_NUMBER = 'eth_getBlockTransactionCountByNumber',
    ETH_GET_TRANSACTION_COUNT = 'eth_getTransactionCount',
    ETH_GET_TRANSACTION_RECEIPT = 'eth_getTransactionReceipt',
    FEE_HISTORY = 'fee_history',
    FILTER = 'filter',
    GAS_PRICE = 'gas_price',
    GET_BLOCK = 'getBlock',
    GET_CONTRACT = 'getContract',
    GET_CONTRACT_RESULT = 'getContractResult',
    GET_TINYBAR_GAS_FEE = 'getTinyBarGasFee',
    RESOLVE_ENTITY_TYPE = 'resolveEntityType',
    SYNTHETIC_LOG_TRANSACTION_HASH = 'syntheticLogTransactionHash',
    FILTERID = 'filterId'
}

enum CACHE_TTL {
    ONE_HOUR = 3_600_000,
    ONE_DAY = 86_400_000
}

enum ORDER {
    ASC = 'asc',
    DESC = 'desc'
}

export default {
    TINYBAR_TO_WEIBAR_COEF: 10_000_000_000,

    CACHE_KEY,
    CACHE_TTL,
    CACHE_MAX: 1000,

    DEFAULT_TINY_BAR_GAS: 72, // (853454 / 1000) * (1 / 12)
    ETH_FUNCTIONALITY_CODE: 84,
    DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT: 1000,
    EXCHANGE_RATE_FILE_ID: "0.0.112",
    FEE_SCHEDULE_FILE_ID: '0.0.111',

    TYPE_CONTRACT: 'contract',
    TYPE_ACCOUNT: 'account',
    TYPE_TOKEN: 'token',

    DEFAULT_FEE_HISTORY_MAX_RESULTS: 10,
    ORDER,

    BLOCK_GAS_LIMIT: 15_000_000,
    CONTRACT_CALL_GAS_LIMIT: 15_000_000,
    ISTANBUL_TX_DATA_NON_ZERO_COST: 16,
    TX_BASE_COST: 21_000,
    TX_HOLLOW_ACCOUNT_CREATION_GAS: 587_000,
    TX_DEFAULT_GAS_DEFAULT: 400_000,
    TX_CREATE_EXTRA: 32_000,
    TX_DATA_ZERO_COST: 4,
    REQUEST_ID_STRING: `Request ID: `,
    BALANCES_UPDATE_INTERVAL: 900,   // 15 minutes
    MAX_MIRROR_NODE_PAGINATION: 20,
    MIRROR_NODE_QUERY_LIMIT: 100,
    NEXT_LINK_PREFIX: '/api/v1/',
    QUERY_COST_INCREMENTATION_STEP: 1.1,

    ETH_CALL_CACHE_TTL_DEFAULT: 200,
    ETH_BLOCK_NUMBER_CACHE_TTL_MS_DEFAULT: 1000,
    ETH_GET_BALANCE_CACHE_TTL_MS_DEFAULT: 1000,
    ETH_GET_TRANSACTION_COUNT_CACHE_TTL: 500,
    ETH_GET_BLOCK_BY_RESULTS_BATCH_SIZE: 25,
    DEFAULT_SYNTHETIC_LOG_CACHE_TTL: `${CACHE_TTL.ONE_DAY}`,

    TRANSACTION_ID_REGEX: /\d{1}\.\d{1}\.\d{1,10}\@\d{1,10}\.\d{1,9}/,

    LONG_ZERO_PREFIX: '0x000000000000',
    CHAIN_IDS: {
        mainnet: 0x127,
        testnet: 0x128,
        previewnet: 0x129,
    },

    // block ranges
    MAX_BLOCK_RANGE: 5,
    ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE: 1000,
    BLOCK_HASH_REGEX: '^0[xX][a-fA-F0-9]',

    DEFAULT_RATE_LIMIT: {
        TIER_1: 100,
        TIER_2: 800,
        TIER_3: 1600,
        DURATION: 60000
    },


    HBAR_RATE_LIMIT_DURATION: parseInt(process.env.HBAR_RATE_LIMIT_DURATION || '80000'),
    HBAR_RATE_LIMIT_TINYBAR: parseInt(process.env.HBAR_RATE_LIMIT_TINYBAR || '11000000000'),
    GAS_PRICE_TINY_BAR_BUFFER: parseInt(process.env.GAS_PRICE_TINY_BAR_BUFFER || '10000000000'),
    WEB_SOCKET_PORT: process.env.WEB_SOCKET_PORT || 8546,
    WEB_SOCKET_HTTP_PORT: process.env.WEB_SOCKET_HTTP_PORT || 8547,

    RELAY_PORT: process.env.SERVER_PORT || 7546,

    FUNCTION_SELECTOR_CHAR_LENGTH: 10,
    MIRROR_NODE_GET_CONTRACT_RESULTS_DEFAULT_RETRIES: 3,

    TRANSACTION_RESULT_STATUS: {
        WRONG_NONCE: 'WRONG_NONCE'
    },

    PRECHECK_STATUS_ERROR_STATUS_CODES: {
        INVALID_CONTRACT_ID: 16,
        CONTRACT_DELETED: 66
    },

    FILTER: {
        TYPE: {
            NEW_BLOCK: 'newBlock',
            LOG: 'log',
            PENDING_TRANSACTION: 'pendingTransaction'
        },
        TTL: parseInt(process.env.FILTER_TTL || '300000')   // default is 5 minutes
    },

    METHODS: {
        ETH_SUBSCRIBE: 'eth_subscribe',
        ETH_UNSUBSCRIBE: 'eth_unsubscribe',
        ETH_CHAIN_ID: 'eth_chainId',
    },

    SUBSCRIBE_EVENTS: {
        LOGS: 'logs',
        NEW_HEADS: 'newHeads',
        NEW_PENDING_TRANSACTIONS: 'newPendingTransactions'
    }
};

