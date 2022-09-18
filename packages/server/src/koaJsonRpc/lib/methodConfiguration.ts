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

// total requests per rate limit duration (default ex. 200 request per 60000ms)
export const methodConfiguration = {
  web3_clientVersion: {
    total: process.env.TIER_3_RATE_LIMIT,
  },
  net_listening: {
    total: process.env.TIER_3_RATE_LIMIT,
  },
  net_version: {
    total: process.env.TIER_3_RATE_LIMIT,
  },
  eth_blockNumber: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_call: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_coinbase: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_estimateGas: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_gasPrice: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getBalance: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getBlockByHash: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getBlockByNumber: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getBlockTransactionCountByHash: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getBlockTransactionCountByNumber: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getCode: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_chainId: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getLogs: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getStorageAt: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getTransactionByBlockHashAndIndex: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getTransactionByBlockNumberAndIndex: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getTransactionByHash: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getTransactionCount: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getTransactionReceipt: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getUncleByBlockHashAndIndex: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getUncleByBlockNumberAndIndex: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getUncleCountByBlockHash: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getUncleCountByBlockNumber: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_getWork: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_feeHistory: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_hashrate: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_mining: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_protocolVersion: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  eth_sendRawTransaction: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_sendTransaction: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_sign: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_signTransaction: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_submitHashrate: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_submitWork: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_syncing: {
    total: process.env.TIER_1_RATE_LIMIT,
  },
  eth_accounts: {
    total: process.env.TIER_2_RATE_LIMIT,
  },
  web3_client_version: {
    total: process.env.TIER_3_RATE_LIMIT,
  },
};
