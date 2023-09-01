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

//Relay Calls
const ETH_ENDPOINTS = {
  WEB3_CLIENT_VERSION: "web3_client_version",
  WEB3_CLIENTVERSION: "web3_clientVersion",
  ETH_CALL: "eth_call",
  ETH_SEND_RAW_TRANSACTION: "eth_sendRawTransaction",
  ETH_GET_TRANSACTION_RECEIPT: "eth_getTransactionReceipt",
  ETH_GET_TRANSACTION_BY_HASH: "eth_getTransactionByHash",
  ETH_FEE_HISTORY: "eth_feeHistory",
  ETH_GET_STORAGE_AT: "eth_getStorageAt",
  ETH_GET_CODE: "eth_getCode",
  ETH_SIGN_TRANSACTION: "eth_signTransaction",
  ETH_SIGN: "eth_sign",
  ETH_PROTOCOL_VERSION: "eth_protocolVersion",
  ETH_SEND_TRANSACTION: "eth_sendTransaction",
  ETH_COINBASE: "eth_coinbase",
  ETH_GET_WORK: "eth_getWork",
  ETH_SUBMIT_HASH_RATE: "eth_submitHashrate",
  ETH_MAX_PRIORITY_FEE_PER_GAS: "eth_maxPriorityFeePerGas",
  ETH_SYNCING: "eth_syncing",
  ETH_SUBMIT_WORK: "eth_submitWork",
  ETH_MINING: "eth_mining",
  ETH_HASH_RATE: "eth_hashrate",
  ETH_ACCOUNTS: "eth_accounts",
  ETH_GET_UNCLE_COUNT_BY_BLOCK_NUMBER: "eth_getUncleCountByBlockNumber",
  ETH_GET_UNCLE_COUNT_BY_BLOCK_HASH: "eth_getUncleCountByBlockHash",
  ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX: "eth_getUncleByBlockNumberAndIndex",
  ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX: "eth_getUncleByBlockHashAndIndex",
  NET_VERSION: "net_version",
  NET_LISTENING: "net_listening",
  ETH_CHAIN_ID: "eth_chainId",
  ETH_GET_BALANCE: "eth_getBalance",
  ETH_BLOCK_NUMBER: "eth_blockNumber",
  ETH_GET_LOGS: "eth_getLogs",
  ETH_GET_BLOCK_BY_HASH: "eth_getBlockByHash",
  ETH_GET_BLOCK_BY_NUMBER: "eth_getBlockByNumber",
  ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER: "eth_getBlockTransactionCountByNumber",
  ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH: "eth_getBlockTransactionCountByHash",
  ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX: "eth_getTransactionByBlockHashAndIndex",
  ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX: "eth_getTransactionByBlockNumberAndIndex",
  ETH_GET_TRANSACTION_COUNT: "eth_getTransactionCount",
  ETH_ESTIMATE_GAS: "eth_estimateGas",
  ETH_GAS_PRICE: "eth_gasPrice",
  WEB3_SHA: "web3_sha",
  NET_PEER_COUNT: "net_peerCount",
  ETH_SIGN_TYPED_DATA: "eth_signTypedData",
  ETH_GET_PROOF: "eth_getProof",
  ETH_NEW_FILTER: "eth_newFilter",
  ETH_NEW_BLOCK_FILTER: "eth_newBlockFilter",
  ETH_NEW_PENDING_TRANSACTION_FILTER: "eth_newPendingTransactionFilter",
  ETH_UNINSTALL_FILTER: "eth_uninstallFilter",
  ETH_GET_FILTER_CHANGES: "eth_getFilterChanges",
};

//Events
const HTS_CONTRACT_EVENTS = {
  ResponseCode: "ResponseCode",
  AllowanceValue: "AllowanceValue",
  ApprovedAddress: "ApprovedAddress",
  Approved: "Approved",
  Frozen: "Frozen",
  KycGranted: "KycGranted",
  TokenCustomFees: "TokenCustomFees",
  TokenDefaultFreezeStatus: "TokenDefaultFreezeStatus",
  TokenDefaultKycStatus: "TokenDefaultKycStatus",
  TokenExpiryInfo: "TokenExpiryInfo",
  FungibleTokenInfo: "FungibleTokenInfo",
  TokenInfo: "TokenInfo",
  TokenKey: "TokenKey",
  NonFungibleTokenInfo: "NonFungibleTokenInfo",
  IsToken: "IsToken",
  TokenType: "TokenType",
  Approval: "Approval",
  PausedToken: "PausedToken",
  UnpausedToken: "UnpausedToken",
  CreatedToken: "CreatedToken",
  MintedToken: "MintedToken",
  DefaultFreezeStatusChanged: "DefaultFreezeStatusChanged",
  Transfer: "Transfer",
};

const GAS = {
  LIMIT_50_000: { gasLimit: 50_000 },
  LIMIT_1_000_000: { gasLimit: 1_000_000 },
  LIMIT_5_000_000: { gasLimit: 5_000_000 },
  LIMIT_10_000_000: { gasLimit: 10_000_000 },
  LIMIT_15_000_000: { gasLimit: 15_000_000 },
};

const NON_EXISTING_ADDRESS = "0x5555555555555555555555555555555555555555";
const NON_EXISTING_TX_HASH = "0x5555555555555555555555555555555555555555555555555555555555555555";
const NON_EXISTING_BLOCK_HASH = "0x5555555555555555555555555555555555555555555555555555555555555555";
const NON_EXISTING_BLOCK_NUMBER = "0x5F5E0FF"; //99999999
const NON_EXISTING_INDEX = "0xF423F"; //999999
const ZERO_HEX = "0x0000000000000000000000000000000000000000";

const CALL_EXCEPTION = "CALL_EXCEPTION";

export default {
  ETH_ENDPOINTS,
  HTS_CONTRACT_EVENTS,
  GAS,
  NON_EXISTING_ADDRESS,
  NON_EXISTING_TX_HASH,
  NON_EXISTING_BLOCK_HASH,
  NON_EXISTING_BLOCK_NUMBER,
  NON_EXISTING_INDEX,
  ZERO_HEX,
  CALL_EXCEPTION,
};
