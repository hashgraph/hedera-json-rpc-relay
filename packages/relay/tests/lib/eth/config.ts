/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { defaultLogs1, defaultLogs2, defaultLogs3 } from '../../helpers';
import { numberTo0x } from '../../../dist/formatters';

export const BLOCK_TRANSACTION_COUNT = 77;
export const GAS_USED_1 = 200000;
export const GAS_USED_2 = 800000;
export const BLOCK_NUMBER = 3;
export const BLOCK_TIMESTAMP = '1651560386';
export const BLOCK_HASH_TRIMMED = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
export const BLOCK_HASH = `${BLOCK_HASH_TRIMMED}999fc7e86699f60f2a3fb3ed9a646c6b`;

export const DEFAULT_BLOCK = {
  count: BLOCK_TRANSACTION_COUNT,
  hapi_version: '0.28.1',
  hash: BLOCK_HASH,
  name: '2022-05-03T06_46_26.060890949Z.rcd',
  number: BLOCK_NUMBER,
  previous_hash: '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
  size: null,
  timestamp: {
    from: `${BLOCK_TIMESTAMP}.060890949`,
    to: '1651560389.060890949',
  },
  gas_used: GAS_USED_1 + GAS_USED_2,
  logs_bloom: '0x',
};
export const DEFAULT_NETWORK_FEES = {
  fees: [
    {
      gas: 77,
      transaction_type: 'ContractCall',
    },
    {
      gas: 771,
      transaction_type: 'ContractCreate',
    },
    {
      gas: 57,
      transaction_type: 'EthereumTransaction',
    },
  ],
  timestamp: '1653644164.591111113',
};

export const ETH_FEE_HISTORY_VALUE = process.env.ETH_FEE_HISTORY_FIXED || 'true';
export const BLOCK_HASH_PREV_TRIMMED = '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298';
export const BLOCK_NUMBER_HEX = `0x${BLOCK_NUMBER.toString(16)}`;
export const MAX_GAS_LIMIT = 250000;
export const BLOCK_TIMESTAMP_HEX = numberTo0x(Number(BLOCK_TIMESTAMP));
export const FIRST_TRX_TIMESTAMP_SEC = '1653077541';
export const CONTRACT_TIMESTAMP_1 = `${FIRST_TRX_TIMESTAMP_SEC}.983983199`;
export const CONTRACT_HASH_1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
export const CONTRACT_HASH_2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
export const MOST_RECENT_BLOCK = {
  blocks: [
    {
      count: 8,
      gas_used: 0,
      hapi_version: '0.35.0',
      hash: '0xd9f84ed7415f33ae171a34c5daa4030a3a3028536d737bacf28b08c68309c629d6b2d9e01cb4ad7eb5e4fc21749b8c33',
      logs_bloom: '0x',
      name: '2023-03-22T19_21_10.216373003Z.rcd.gz',
      number: 6,
      previous_hash:
        '0xe5ec054c17063d3912eb13760f9f62779f12c60f4d13f882d3fe0aba15db617b9f2b62d9f51d2aac05f7499147c6aa28',
      size: 3085,
      timestamp: {
        from: '1679512870.216373003',
        to: '1679512871.851262003',
      },
    },
  ],
};
export const DEFAULT_CONTRACT_RES_REVERT = {
  results: [
    {
      amount: 0,
      bloom:
        '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      call_result: '0x',
      contract_id: null,
      created_contract_ids: [],
      error_message:
        '0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002645524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e63650000000000000000000000000000000000000000000000000000',
      from: '0x0000000000000000000000000000000000000557',
      function_parameters: '0x',
      gas_limit: MAX_GAS_LIMIT,
      gas_used: GAS_USED_1,
      hash: CONTRACT_HASH_1,
      timestamp: `${CONTRACT_TIMESTAMP_1}`,
      to: null,
      block_gas_used: 400000,
      block_hash: BLOCK_HASH,
      block_number: BLOCK_NUMBER,
      chain_id: '0x12a',
      failed_initcode: null,
      gas_price: '0x4a817c80',
      max_fee_per_gas: '0x59',
      max_priority_fee_per_gas: '0x33',
      nonce: 5,
      r: '0xb5c21ab4dfd336e30ac2106cad4aa8888b1873a99bce35d50f64d2ec2cc5f6d9',
      result: 'SUCCESS',
      s: '0x1092806a99727a20c31836959133301b65a2bfa980f9795522d21a254e629110',
      status: '0x1',
      transaction_index: 1,
      type: 2,
      v: 1,
    },
  ],
  links: {
    next: null,
  },
};
export const DEFAULT_LOGS_LIST = defaultLogs1.concat(defaultLogs2).concat(defaultLogs3);
export const DEFAULT_LOGS = {
  logs: DEFAULT_LOGS_LIST,
};
export const DEFAULT_ETH_GET_BLOCK_BY_LOGS = {
  logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
};

// URLS:
export const CONTRACT_RESULTS_WITH_FILTER_URL = `contracts/results?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`;
export const CONTRACT_RESULTS_LOGS_WITH_FILTER_URL = `contracts/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`;
export const BLOCKS_LIMIT_ORDER_URL = 'blocks?limit=1&order=desc';
export const CONTRACTS_RESULTS_NEXT_URL = `contracts/results?timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity

//responce objects
export const NOT_FOUND_RES = {
  _status: {
    messages: [{ message: 'Not found' }],
  },
};
export const BLOCKS_RES = {
  blocks: [{ number: 3735929055 }],
};
export const DEFAULT_BLOCKS_RES = {
  blocks: [DEFAULT_BLOCK],
};
export const NO_SUCH_BLOCK_EXISTS_RES = {
  _status: {
    messages: [{ message: 'No such block exists' }],
  },
};
export const BLOCK_NOT_FOUND_RES = {
  _status: {
    messages: [{ message: 'Block not found' }],
  },
};
export const LINKS_NEXT_RES = {
  results: [],
  links: { next: CONTRACTS_RESULTS_NEXT_URL },
};
//
