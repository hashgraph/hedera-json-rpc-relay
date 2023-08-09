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
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import CONSTANTS from '../../../../relay/dist/lib/constants';

const tier1rateLimit = process.env.TIER_1_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_1;
const tier2rateLimit = process.env.TIER_2_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_2;
const tier3rateLimit = process.env.TIER_3_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_3;


// total requests per rate limit duration (default ex. 200 request per 60000ms)
export const methodConfiguration = {
  web3_clientVersion: {
    totalLimit: tier3rateLimit,
  },
  net_listening: {
    totalLimit: tier3rateLimit,
  },
  net_version: {
    totalLimit: tier3rateLimit,
  },
  eth_blockNumber: {
    totalLimit: tier2rateLimit,
    cacheTTL: CONSTANTS.CACHE_TTL.ONE_SECOND.valueOf(),
  },
  eth_call: {
    totalLimit: tier1rateLimit,
  },
  eth_coinbase: {
    totalLimit: tier2rateLimit,
  },
  eth_estimateGas: {
    totalLimit: tier2rateLimit,
  },
  eth_gasPrice: {
    totalLimit: tier2rateLimit,
  },
  eth_getBalance: {
    totalLimit: tier2rateLimit,
  },
  eth_getBlockByHash: {
    totalLimit: tier2rateLimit,
    cacheTTL: CONSTANTS.CACHE_TTL.ONE_HOUR.valueOf(),
  },
  eth_getBlockByNumber: {
    totalLimit: tier2rateLimit,
    cacheTTL: CONSTANTS.CACHE_TTL.ONE_HOUR.valueOf(),
  },
  eth_getBlockTransactionCountByHash: {
    totalLimit: tier2rateLimit,
  },
  eth_getBlockTransactionCountByNumber: {
    totalLimit: tier2rateLimit,
  },
  eth_getCode: {
    totalLimit: tier2rateLimit,
  },
  eth_chainId: {
    totalLimit: tier2rateLimit,
    cacheTTL: CONSTANTS.CACHE_TTL.ONE_DAY.valueOf(),
  },
  eth_getLogs: {
    totalLimit: tier2rateLimit,
  },
  eth_getStorageAt: {
    totalLimit: tier2rateLimit,
  },
  eth_getTransactionByBlockHashAndIndex: {
    totalLimit: tier2rateLimit,
  },
  eth_getTransactionByBlockNumberAndIndex: {
    totalLimit: tier2rateLimit,
  },
  eth_getTransactionByHash: {
    totalLimit: tier2rateLimit,
  },
  eth_getTransactionCount: {
    totalLimit: tier2rateLimit,
  },
  eth_getTransactionReceipt: {
    totalLimit: tier2rateLimit,
  },
  eth_getUncleByBlockHashAndIndex: {
    totalLimit: tier2rateLimit,
  },
  eth_getUncleByBlockNumberAndIndex: {
    totalLimit: tier2rateLimit,
  },
  eth_getUncleCountByBlockHash: {
    totalLimit: tier2rateLimit,
  },
  eth_getUncleCountByBlockNumber: {
    totalLimit: tier2rateLimit,
  },
  eth_getWork: {
    totalLimit: tier2rateLimit,
  },
  eth_feeHistory: {
    totalLimit: tier2rateLimit,
    cacheTTL: CONSTANTS.CACHE_TTL.ONE_DAY.valueOf(),
  },
  eth_hashrate: {
    totalLimit: tier1rateLimit,
  },
  eth_maxPriorityFeePerGas: {
    totalLimit: tier1rateLimit,
  },
  eth_mining: {
    totalLimit: tier1rateLimit,
  },
  eth_protocolVersion: {
    totalLimit: tier2rateLimit,
  },
  eth_sendRawTransaction: {
    totalLimit: tier1rateLimit,
  },
  eth_sendTransaction: {
    totalLimit: tier1rateLimit,
  },
  eth_sign: {
    totalLimit: tier1rateLimit,
  },
  eth_signTransaction: {
    totalLimit: tier1rateLimit,
  },
  eth_submitHashrate: {
    totalLimit: tier1rateLimit,
  },
  eth_submitWork: {
    totalLimit: tier1rateLimit,
  },
  eth_syncing: {
    totalLimit: tier1rateLimit,
  },
  eth_accounts: {
    totalLimit: tier2rateLimit,
  },
  eth_newFilter: {
    totalLimit: tier2rateLimit,
  },
  web3_client_version: {
    totalLimit: tier3rateLimit,
  },
  eth_uninstallFilter: {
    totalLimit: tier2rateLimit,
  }
};
