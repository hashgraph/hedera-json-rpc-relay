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
import { defaultEvmAddress, defaultLogs1, defaultLogs2, defaultLogs3, mockData, toHex } from '../../helpers';
import { numberTo0x } from '../../../dist/formatters';
import constants from '../../../src/lib/constants';

export const BLOCK_TRANSACTION_COUNT = 77;
export const GAS_USED_1 = 200000;
export const GAS_USED_2 = 800000;
export const GAS_USED_RATIO = 0.5;
export const BLOCK_NUMBER = 3;
export const BLOCK_NUMBER_2 = 4;
export const BLOCK_NUMBER_3 = 5;
export const BLOCK_TIMESTAMP = '1651560386';
export const BLOCK_HASH_TRIMMED = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b';
export const BLOCK_HASH = `${BLOCK_HASH_TRIMMED}999fc7e86699f60f2a3fb3ed9a646c6b`;
export const BLOCK_HASH_2 = `${BLOCK_HASH_TRIMMED}999fc7e86699f60f2a3fb3ed9a646c6c`;
export const BLOCK_HASH_3 = `${BLOCK_HASH_TRIMMED}999fc7e86699f60f2a3fb3ed9a646c6d`;
export const RECEIVER_ADDRESS = '0x5b98Ce3a4D1e1AC55F15Da174D5CeFcc5b8FB994';
export const WRONG_CONTRACT_ADDRESS = '0x00000000000000000000000000000000055e';

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
export const CONTRACT_RESULT_MOCK = {
  address: '0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69',
  amount: 20,
  bloom:
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  call_result: '0x',
  contract_id: '0.0.1012',
  created_contract_ids: [],
  error_message: null,
  from: '0x00000000000000000000000000000000000003f7',
  function_parameters: '0x',
  gas_limit: 250000,
  gas_used: 200000,
  timestamp: '1692959189.214316721',
  to: '0x00000000000000000000000000000000000003f4',
  hash: '0x7e8a09541c80ccda1f5f40a1975e031ed46de5ad7f24cd4c37be9bac65149b9e',
  block_hash: '0xa414a76539f84ae1c797fa10d00e49d5e7a1adae556dcd43084551e671623d2eba825bcb7bbfd5b7e3fe59d63d8a167f',
  block_number: 61033,
  logs: [],
  result: 'SUCCESS',
  transaction_index: 2,
  state_changes: [],
  status: '0x1',
  failed_initcode: null,
  block_gas_used: 200000,
  chain_id: '0x12a',
  gas_price: '0x',
  r: '0x85b423416d0164d0b2464d880bccb0679587c00673af8e016c8f0ce573be69b2',
  s: '0x3897a5ce2ace1f242d9c989cd9c163d79760af4266f3bf2e69ee288bcffb211a',
  v: 1,
  nonce: 9,
};

export const CONTRACT_CALL_DATA = '0xef641f44';
export const ETH_FEE_HISTORY_VALUE = process.env.ETH_FEE_HISTORY_FIXED || 'true';
export const BLOCK_HASH_PREV_TRIMMED = '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298';
export const BLOCK_NUMBER_HEX = `0x${BLOCK_NUMBER.toString(16)}`;
export const MAX_GAS_LIMIT = 250000;
export const MAX_GAS_LIMIT_HEX = numberTo0x(MAX_GAS_LIMIT);
export const BLOCK_TIMESTAMP_HEX = numberTo0x(Number(BLOCK_TIMESTAMP));
export const NO_TRANSACTIONS = '?transactions=false';
export const FIRST_TRX_TIMESTAMP_SEC = '1653077541';
export const CONTRACT_TIMESTAMP_1 = `${FIRST_TRX_TIMESTAMP_SEC}.983983199`;
export const CONTRACT_TIMESTAMP_2 = '1653077542.701408897';
export const CONTRACT_TIMESTAMP_3 = '1653088542.123456789';
export const CONTRACT_TIMESTAMP_4 = `${FIRST_TRX_TIMESTAMP_SEC}.983983198`;
export const CONTRACT_HASH_1 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
export const CONTRACT_HASH_2 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
export const CONTRACT_HASH_3 = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6394';
export const CONTRACT_ADDRESS_1 = '0x000000000000000000000000000000000000055f';
export const CONTRACT_ADDRESS_2 = '0x000000000000000000000000000000000000055e';
export const CONTRACT_ADDRESS_3 = '0x000000000000000000000000000000000000255c';
export const HTS_TOKEN_ADDRESS = '0x0000000000000000000000000000000002dca431';
export const ACCOUNT_ADDRESS_1 = '0x13212A14deaf2775a5b3bEcC857806D5c719d3f2';
export const NON_EXISTENT_CONTRACT_ADDRESS = `'0x55555555555555555555555555555555555555'`;
export const DEFAULT_HTS_TOKEN = mockData.token;
export const DEPLOYED_BYTECODE =
  '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100329190';
export const MIRROR_NODE_DEPLOYED_BYTECODE =
  '0x608060405234801561001057600080fd5b5060405161078938038061078983398181016040528101906100321234';
export const TINYBAR_TO_WEIBAR_COEF_BIGINT = BigInt(constants.TINYBAR_TO_WEIBAR_COEF);
export const ONE_TINYBAR_IN_WEI_HEX = toHex(TINYBAR_TO_WEIBAR_COEF_BIGINT);

export const BASE_FEE_PER_GAS_HEX = numberTo0x(
  BigInt(DEFAULT_NETWORK_FEES.fees[2].gas) * TINYBAR_TO_WEIBAR_COEF_BIGINT,
); // '0x84b6a5c400' -> 570_000_000_000 tb
export const BASE_FEE_PER_GAS_DEFAULT = '0x33d758c09000';
export const DEF_BALANCE = 99960581137;
export const CONTRACT_ID_1 = '0.0.1375';
export const CONTRACT_ID_2 = '0.0.1374';
export const DEF_HEX_BALANCE = numberTo0x(BigInt(DEF_BALANCE) * TINYBAR_TO_WEIBAR_COEF_BIGINT);
export const BLOCK_ZERO = {
  count: 5,
  hapi_version: '0.28.1',
  hash: '0x4a7eed88145253eca01a6b5995865b68b041923772d0e504d2ae5fbbf559b68b397adfce5c52f4fa8acec860e6fbc395',
  name: '2020-08-27T23_40_52.347251002Z.rcd',
  number: 0,
  previous_hash: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  size: null,
  timestamp: {
    from: '1598571652.347251002',
    to: '1598571654.548395000',
  },
  gas_used: 0,
  logs_bloom: '0x',
};
export const DEFAULT_CONTRACT = {
  admin_key: null,
  auto_renew_account: null,
  auto_renew_period: 7776000,
  contract_id: '0.0.1052',
  created_timestamp: '1659622477.294172233',
  deleted: false,
  evm_address: null,
  expiration_timestamp: null,
  file_id: '0.0.1051',
  max_automatic_token_associations: 0,
  memo: '',
  obtainer_id: null,
  permanent_removal: null,
  proxy_account_id: null,
  timestamp: {
    from: '1659622477.294172233',
    to: null,
  },
  bytecode: '0x123456',
  runtime_bytecode: MIRROR_NODE_DEPLOYED_BYTECODE,
};
export const DEFAULT_CONTRACT_2 = {
  ...DEFAULT_CONTRACT,
  address: CONTRACT_ADDRESS_2,
  contract_id: CONTRACT_ID_2,
};
export const DEFAULT_CONTRACT_STATE_EMPTY_ARRAY = {
  state: [],
  links: {
    next: null,
  },
};
export const OLDER_BLOCK = {
  count: BLOCK_TRANSACTION_COUNT,
  hapi_version: '0.28.1',
  hash: BLOCK_HASH,
  name: '2022-05-03T06_46_26.060890949Z.rcd',
  number: BLOCK_NUMBER,
  previous_hash: '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
  size: null,
  timestamp: {
    from: `${CONTRACT_TIMESTAMP_4}`,
    to: '1651560389.060890949',
  },
  gas_used: GAS_USED_1 + GAS_USED_2,
  logs_bloom: '0x',
};
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
export const DEFAULT_OLDER_CONTRACT_STATE = {
  state: [
    {
      address: CONTRACT_ADDRESS_1,
      contract_id: CONTRACT_ID_1,
      timestamp: CONTRACT_TIMESTAMP_4,
      slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
      value: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
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
export const DEFAULT_CURRENT_CONTRACT_STATE = {
  state: [
    {
      address: CONTRACT_ADDRESS_1,
      contract_id: CONTRACT_ID_1,
      timestamp: CONTRACT_TIMESTAMP_1,
      slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
      value: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
    },
  ],
};
export const DEFAULT_CONTRACT_3_EMPTY_BYTECODE = {
  address: CONTRACT_ADDRESS_2,
  contract_id: CONTRACT_ID_2,
  admin_key: null,
  auto_renew_account: null,
  auto_renew_period: 7776000,
  created_timestamp: '1659622477.294172233',
  deleted: false,
  evm_address: null,
  expiration_timestamp: null,
  file_id: '0.0.1051',
  max_automatic_token_associations: 0,
  memo: '',
  obtainer_id: null,
  permanent_removal: null,
  proxy_account_id: null,
  timestamp: {
    from: '1659622477.294172233',
    to: null,
  },
  bytecode: '0x123456',
  runtime_bytecode: '0x',
};

export const DEFAULT_LOG_TOPICS = [
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  '0x0000000000000000000000000000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000000000000000000000000208fa13',
  '0x0000000000000000000000000000000000000000000000000000000000000005',
];

export const DEFAULT_LOG_TOPICS_1 = [
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  '0x000000000000000000000000000000000000000000000000000000000208fa13',
];

export const DEFAULT_NULL_LOG_TOPICS = [
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  '0x000000000000000000000000000000000000000000000000000000000208fa13',
  null,
  null,
];
export const LOG_BLOOM_4 = '0x4444';
export const DEFAULT_LOGS_4 = [
  {
    address: '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69',
    bloom: LOG_BLOOM_4,
    contract_id: CONTRACT_ID_2,
    data: '0x',
    index: 0,
    topics: DEFAULT_LOG_TOPICS_1,
    root_contract_id: '0.0.34806097',
    timestamp: CONTRACT_TIMESTAMP_3,
    block_hash: BLOCK_HASH_3,
    block_number: BLOCK_NUMBER_3,
    transaction_hash: CONTRACT_HASH_3,
    transaction_index: 1,
  },
];
export const DEFAULT_LOGS_3 = [
  {
    address: '0x0000000000000000000000000000000002131951',
    bloom: LOG_BLOOM_4,
    contract_id: CONTRACT_ID_2,
    data: '0x',
    index: 0,
    topics: [],
    root_contract_id: '0.0.34806097',
    timestamp: CONTRACT_TIMESTAMP_3,
    block_hash: BLOCK_HASH_3,
    block_number: BLOCK_NUMBER_3,
    transaction_hash: CONTRACT_HASH_3,
    transaction_index: 1,
  },
];
export const DEFAULT_LOGS_LIST = defaultLogs1.concat(defaultLogs2).concat(defaultLogs3);
export const DEFAULT_LOGS = {
  logs: DEFAULT_LOGS_LIST,
};
export const DEFAULT_ETH_GET_BLOCK_BY_LOGS = {
  logs: [DEFAULT_LOGS.logs[0], DEFAULT_LOGS.logs[1]],
};
export const BLOCK_BY_HASH_FROM_RELAY = {
  timestamp: '0x652dbbb7',
  difficulty: '0x0',
  extraData: '0x',
  gasLimit: '0xe4e1c0',
  baseFeePerGas: '0x1a3185c5000',
  gasUsed: '0x0',
  logsBloom:
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  miner: '0x0000000000000000000000000000000000000000',
  mixHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  nonce: '0x0000000000000000',
  receiptsRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
  sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
  size: '0x340',
  stateRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
  totalDifficulty: '0x0',
  transactions: [],
  transactionsRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
  uncles: [],
  withdrawals: [],
  withdrawalsRoot: '0x0',
  number: '0x341890',
  hash: '0x360cda6a0760c9adb0e41268edbeb6a0cb3bdaff8f1e68f6ffbd22c9c050d8af',
  parentHash: '0xf44fd739068dde2db83c114998f8218b6c9d49200642c40046b16e8f83dfdcd6',
};
export const CONTRACT_EVM_ADDRESS = '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9';
export const DEFAULT_TX_HASH = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392';
export const DEFAULT_TRANSACTION = {
  accessList: [],
  blockHash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
  blockNumber: '0x11',
  chainId: '0x12a',
  from: `${defaultEvmAddress}`,
  gas: '0x7b',
  gasPrice: '0x4a817c80',
  hash: DEFAULT_TX_HASH,
  input: '0x0707',
  maxFeePerGas: null,
  maxPriorityFeePerGas: null,
  nonce: 1,
  r: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
  s: '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
  to: '0x0000000000000000000000000000000000001389',
  transactionIndex: '0x1',
  type: 2,
  v: 1,
  value: '0x77359400',
};
export const DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH = {
  address: '0xd8db0b1dbf8ba6721ef5256ad5fe07d72d1d04b9',
  amount: 2000000000,
  bloom:
    '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  call_result: '0x0606',
  contract_id: '0.0.5001',
  created_contract_ids: ['0.0.7001'],
  error_message: null,
  from: '0x0000000000000000000000000000000000001f41',
  function_parameters: '0x0707',
  gas_limit: 1000000,
  gas_used: 123,
  timestamp: '167654.000123456',
  to: '0x0000000000000000000000000000000000001389',
  block_hash: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042000102030405060708090a0b0c0d0e0f',
  block_number: 17,
  logs: [
    {
      address: '0x0000000000000000000000000000000000001389',
      bloom:
        '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      contract_id: '0.0.5001',
      data: '0x0123',
      index: 0,
      topics: ['0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750'],
    },
  ],
  result: 'SUCCESS',
  transaction_index: 1,
  hash: '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
  state_changes: [
    {
      address: '0x0000000000000000000000000000000000001389',
      contract_id: '0.0.5001',
      slot: '0x0000000000000000000000000000000000000000000000000000000000000101',
      value_read: '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
      value_written: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
    },
  ],
  status: '0x1',
  access_list: '0x',
  block_gas_used: 50000000,
  chain_id: '0x12a',
  gas_price: '0x4a817c80',
  max_fee_per_gas: '0x',
  max_priority_fee_per_gas: '0x',
  r: '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
  s: '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
  type: 2,
  v: 1,
  nonce: 1,
};
export const DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH_REVERTED = {
  ...DEFAULT_DETAILED_CONTRACT_RESULT_BY_HASH,
  ...{
    result: 'CONTRACT_REVERT_EXECUTED',
    status: '0x0',
    error_message:
      '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000',
  },
};

// URLS:
export const CONTRACT_RESULTS_WITH_FILTER_URL = `contracts/results?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`;
export const CONTRACTS_LOGS_WITH_FILTER = `contracts/${CONTRACT_ADDRESS_1}/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`;
export const CONTRACT_RESULTS_LOGS_WITH_FILTER_URL = `contracts/results/logs?timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&limit=100&order=asc`;
export const BLOCKS_LIMIT_ORDER_URL = 'blocks?limit=1&order=desc';
export const CONTRACTS_RESULTS_NEXT_URL = `contracts/results?timestamp=lte:${DEFAULT_BLOCK.timestamp.to}&timestamp=gte:${DEFAULT_BLOCK.timestamp.from}&limit=100&order=asc`; // just flip the timestamp parameters for simplicity

//responce objects
export const MOCK_BLOCK_NUMBER_1000_RES = {
  blocks: [
    {
      number: 10000,
    },
  ],
};
export const MOCK_BALANCE_RES = {
  account: CONTRACT_ADDRESS_1,
  balance: {
    balance: DEF_BALANCE,
  },
};
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
export const MOCK_BLOCKS_FOR_BALANCE_RES = {
  blocks: [
    {
      number: 10000,
      timestamp: {
        from: `${BLOCK_TIMESTAMP}.060890919`,
        to: '1651560389.060890949',
      },
    },
  ],
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
export const NO_SUCH_CONTRACT_RESULT = {
  _status: {
    messages: [{ message: 'No such contract result exists' }],
  },
};
export const DETAILD_CONTRACT_RESULT_NOT_FOUND = {
  _status: {
    messages: [{ message: 'No correlating transaction' }],
  },
};
export const EMPTY_RES = {
  results: [],
};
//
