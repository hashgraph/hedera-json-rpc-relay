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
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

import CONSTANTS from "../../../../relay/dist/lib/constants";

const tier1rateLimit = process.env.TIER_1_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_1;
const tier2rateLimit = process.env.TIER_2_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_2;
const tier3rateLimit = process.env.TIER_3_RATE_LIMIT || CONSTANTS.DEFAULT_RATE_LIMIT.TIER_3;

// total requests per rate limit duration (default ex. 200 request per 60000ms)
export const methodConfiguration = {
  web3_clientVersion: {
    total: tier3rateLimit,
  },
  net_listening: {
    total: tier3rateLimit,
  },
  net_version: {
    total: tier3rateLimit,
  },
  eth_blockNumber: {
    total: tier2rateLimit,
  },
  eth_call: {
    total: tier1rateLimit,
  },
  eth_coinbase: {
    total: tier2rateLimit,
  },
  eth_estimateGas: {
    total: tier2rateLimit,
  },
  eth_gasPrice: {
    total: tier2rateLimit,
  },
  eth_getBalance: {
    total: tier2rateLimit,
  },
  eth_getBlockByHash: {
    total: tier2rateLimit,
  },
  eth_getBlockByNumber: {
    total: tier2rateLimit,
  },
  eth_getBlockTransactionCountByHash: {
    total: tier2rateLimit,
  },
  eth_getBlockTransactionCountByNumber: {
    total: tier2rateLimit,
  },
  eth_getCode: {
    total: tier2rateLimit,
  },
  eth_chainId: {
    total: tier2rateLimit,
  },
  eth_getFilterChanges: {
    total: tier2rateLimit,
  },
  eth_getLogs: {
    total: tier2rateLimit,
  },
  eth_getStorageAt: {
    total: tier2rateLimit,
  },
  eth_getTransactionByBlockHashAndIndex: {
    total: tier2rateLimit,
  },
  eth_getTransactionByBlockNumberAndIndex: {
    total: tier2rateLimit,
  },
  eth_getTransactionByHash: {
    total: tier2rateLimit,
  },
  eth_getTransactionCount: {
    total: tier2rateLimit,
  },
  eth_getTransactionReceipt: {
    total: tier2rateLimit,
  },
  eth_getUncleByBlockHashAndIndex: {
    total: tier2rateLimit,
  },
  eth_getUncleByBlockNumberAndIndex: {
    total: tier2rateLimit,
  },
  eth_getUncleCountByBlockHash: {
    total: tier2rateLimit,
  },
  eth_getUncleCountByBlockNumber: {
    total: tier2rateLimit,
  },
  eth_getWork: {
    total: tier2rateLimit,
  },
  eth_feeHistory: {
    total: tier2rateLimit,
  },
  eth_hashrate: {
    total: tier1rateLimit,
  },
  eth_maxPriorityFeePerGas: {
    total: tier1rateLimit,
  },
  eth_mining: {
    total: tier1rateLimit,
  },
  eth_protocolVersion: {
    total: tier2rateLimit,
  },
  eth_sendRawTransaction: {
    total: tier1rateLimit,
  },
  eth_sendTransaction: {
    total: tier1rateLimit,
  },
  eth_sign: {
    total: tier1rateLimit,
  },
  eth_signTransaction: {
    total: tier1rateLimit,
  },
  eth_submitHashrate: {
    total: tier1rateLimit,
  },
  eth_submitWork: {
    total: tier1rateLimit,
  },
  eth_syncing: {
    total: tier1rateLimit,
  },
  eth_accounts: {
    total: tier2rateLimit,
  },
  eth_newBlockFilter: {
    total: tier2rateLimit,
  },
  eth_newPendingTransactionFilter: {
    total: tier2rateLimit,
  },
  eth_newFilter: {
    total: tier2rateLimit,
  },
  web3_client_version: {
    total: tier3rateLimit,
  },
  eth_uninstallFilter: {
    total: tier2rateLimit,
  },
  eth_getFilterLogs: {
    total: tier2rateLimit,
  },
};
