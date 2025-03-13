// SPDX-License-Identifier: Apache-2.0

/**
 * Centralized constants for all supported JSON-RPC method names.
 * This helps maintain consistency, prevents typos, and provides a single source of truth.
 */
export const JsonRpcMethods = {
  /**
   * Ethereum (eth_) method names
   */
  // Block related
  ETH_BLOCK_NUMBER: 'eth_blockNumber',
  ETH_GET_BLOCK_BY_NUMBER: 'eth_getBlockByNumber',
  ETH_GET_BLOCK_BY_HASH: 'eth_getBlockByHash',
  ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH: 'eth_getBlockTransactionCountByHash',
  ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER: 'eth_getBlockTransactionCountByNumber',

  // Account related
  ETH_GET_BALANCE: 'eth_getBalance',
  ETH_GET_CODE: 'eth_getCode',
  ETH_GET_TRANSACTION_COUNT: 'eth_getTransactionCount',
  ETH_GET_STORAGE_AT: 'eth_getStorageAt',
  ETH_ACCOUNTS: 'eth_accounts',

  // Network info
  ETH_CHAIN_ID: 'eth_chainId',
  ETH_GAS_PRICE: 'eth_gasPrice',
  ETH_MAX_PRIORITY_FEE_PER_GAS: 'eth_maxPriorityFeePerGas',
  ETH_FEE_HISTORY: 'eth_feeHistory',
  ETH_SYNCING: 'eth_syncing',
  ETH_MINING: 'eth_mining',
  ETH_HASHRATE: 'eth_hashrate',
  ETH_COINBASE: 'eth_coinbase',
  ETH_PROTOCOL_VERSION: 'eth_protocolVersion',

  // Transaction related
  ETH_CALL: 'eth_call',
  ETH_ESTIMATE_GAS: 'eth_estimateGas',
  ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
  ETH_GET_TRANSACTION_BY_HASH: 'eth_getTransactionByHash',
  ETH_GET_TRANSACTION_RECEIPT: 'eth_getTransactionReceipt',
  ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX: 'eth_getTransactionByBlockHashAndIndex',
  ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX: 'eth_getTransactionByBlockNumberAndIndex',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN: 'eth_sign',

  // Filter related
  ETH_GET_LOGS: 'eth_getLogs',
  ETH_NEW_FILTER: 'eth_newFilter',
  ETH_NEW_BLOCK_FILTER: 'eth_newBlockFilter',
  ETH_NEW_PENDING_TRANSACTION_FILTER: 'eth_newPendingTransactionFilter',
  ETH_UNINSTALL_FILTER: 'eth_uninstallFilter',
  ETH_GET_FILTER_CHANGES: 'eth_getFilterChanges',
  ETH_GET_FILTER_LOGS: 'eth_getFilterLogs',

  // Mining related (mostly unsupported/static responses)
  ETH_GET_WORK: 'eth_getWork',
  ETH_SUBMIT_WORK: 'eth_submitWork',
  ETH_SUBMIT_HASHRATE: 'eth_submitHashrate',

  // Uncle related (mostly unsupported/static responses)
  ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX: 'eth_getUncleByBlockHashAndIndex',
  ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX: 'eth_getUncleByBlockNumberAndIndex',
  ETH_GET_UNCLE_COUNT_BY_BLOCK_HASH: 'eth_getUncleCountByBlockHash',
  ETH_GET_UNCLE_COUNT_BY_BLOCK_NUMBER: 'eth_getUncleCountByBlockNumber',

  /**
   * Web3 (web3_) method names
   */
  WEB3_CLIENT_VERSION: 'web3_clientVersion',
  WEB3_SHA3: 'web3_sha3',

  /**
   * Network (net_) method names
   */
  NET_LISTENING: 'net_listening',
  NET_VERSION: 'net_version',
  NET_PEER_COUNT: 'net_peerCount',

  /**
   * Debug (debug_) method names
   */
  DEBUG_TRACE_TRANSACTION: 'debug_traceTransaction',
};

/**
 * Export as default for named import convenience
 */
export default JsonRpcMethods;
