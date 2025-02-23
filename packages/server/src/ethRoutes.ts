/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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
const defineEthRoutes = function (app, relay, logAndHandleResponse) {
  /**
   * Filter related endpoints:
   */

  /**
   * Returns a filterId to be later used by eth_getFilterChanges for getting the logs since the last query
   *
   * returns: string
   */
  app.useRpc('eth_newFilter', async (params: any) => {
    const filter = params[0];
    return logAndHandleResponse('eth_newFilter', [], (requestDetails) =>
      relay
        .eth()
        .filterService()
        .newFilter(filter?.fromBlock, filter?.toBlock, requestDetails, filter?.address, filter?.topics),
    );
  });

  app.useRpc('eth_getFilterLogs', async (params: any) => {
    return logAndHandleResponse('eth_getFilterLogs', params, (requestDetails) =>
      relay
        .eth()
        .filterService()
        .getFilterLogs(params?.[0], requestDetails),
    );
  });

  app.useRpc('eth_getFilterChanges', async (params: any) => {
    const filterId = params[0];
    return logAndHandleResponse('eth_getFilterChanges', [], (requestDetails) =>
      relay.eth().filterService().getFilterChanges(filterId, requestDetails),
    );
  });

  /**
   * Returns a filterId to be later used by eth_getFilterChanges for getting the block hashes since the last query
   *
   * returns: string
   */
  app.useRpc('eth_newBlockFilter', async (params: any) => {
    return logAndHandleResponse('eth_newBlockFilter', [], (requestDetails) =>
      relay.eth().filterService().newBlockFilter(requestDetails),
    );
  });

  /**
   * Not Supported
   */
  app.useRpc('eth_newPendingTransactionFilter', async () => {
    return logAndHandleResponse('eth_newPendingTransactionFilter', [], (requestDetails) =>
      relay.eth().filterService().newPendingTransactionFilter(requestDetails),
    );
  });

  /**
   * It returns true if the filter was successfully uninstalled, otherwise false
   * params: Filter Id - string
   *
   * returns: boolean
   */
  app.useRpc('eth_uninstallFilter', async (params: any) => {
    return logAndHandleResponse('eth_uninstallFilter', params, (requestDetails) =>
      relay
        .eth()
        .filterService()
        .uninstallFilter(params?.[0], requestDetails),
    );
  });

  /**
   * Not supported
   */
  app.useRpc('eth_submitHashrate', async () => {
    return logAndHandleResponse('eth_submitHashrate', [], (requestDetails) =>
      relay.eth().submitHashrate(requestDetails),
    );
  });

  app.useRpc('eth_signTransaction', async () => {
    return logAndHandleResponse('eth_signTransaction', [], (requestDetails) =>
      relay.eth().signTransaction(requestDetails),
    );
  });

  app.useRpc('eth_sign', async () => {
    return logAndHandleResponse('eth_sign', [], (requestDetails) => relay.eth().sign(requestDetails));
  });

  app.useRpc('eth_sendTransaction', async () => {
    return logAndHandleResponse('eth_sendTransaction', [], (requestDetails) =>
      relay.eth().sendTransaction(requestDetails),
    );
  });

  app.useRpc('eth_protocolVersion', async () => {
    return logAndHandleResponse('eth_protocolVersion', [], (requestDetails) =>
      relay.eth().protocolVersion(requestDetails),
    );
  });

  app.useRpc('eth_coinbase', async () => {
    return logAndHandleResponse('eth_coinbase', [], (requestDetails) => relay.eth().coinbase(requestDetails));
  });

  /**
   * Returns a fee per gas that is an estimate of how much you can pay as a priority fee,
   * or 'tip', to get a transaction included in the current block.
   *
   * Since Hedera doesn't have a concept of tipping nodes to promote any behavior, this method will return a static response.
   *
   * returns: 0x0
   */
  app.useRpc('eth_maxPriorityFeePerGas', async () => {
    return logAndHandleResponse('eth_maxPriorityFeePerGas', [], (requestDetails) =>
      relay.eth().maxPriorityFeePerGas(requestDetails),
    );
  });

  /**
   * Returns an empty array.
   *
   * returns: Accounts - hex encoded address
   */
  app.useRpc('eth_accounts', async () => {
    return logAndHandleResponse('eth_accounts', [], (requestDetails) => relay.eth().accounts(requestDetails));
  });

  /**
   * Returns the information about a transaction requested by transaction hash.
   * params: Transaction hash - 32 byte hex value
   *
   * returns: Transaction Object
   */
  app.useRpc('eth_getTransactionByHash', async (params: any) => {
    return logAndHandleResponse('eth_getTransactionByHash', params, (requestDetails) =>
      relay.eth().getTransactionByHash(params[0], requestDetails),
    );
  });

  /**
   * params:
   *      - Block Count: The number of blocks requested.
   *      - Newest Block: The highest number block of the range.
   *      - Reward Percentiles: List of percentiles used to sample from each block.
   *
   * returns:
   *      - baseFeePerGas - Array of block base fees per gas.
   *      - gasUsedRatio - Array of block gas used ratios.
   *      - oldestBlock - Lowest number block in the range.
   *      - reward - Array of effective priority fee per gas data.
   */
  app.useRpc('eth_feeHistory', async (params: any) => {
    return logAndHandleResponse('eth_feeHistory', params, (requestDetails) =>
      relay.eth().feeHistory(Number(params?.[0]), params?.[1], params?.[2], requestDetails),
    );
  });

  /**
   * Returns the number of transactions in a block, queried by hash.
   * params: Block Hash
   *
   * returns: Block Transaction Count - Hex encoded integer
   */
  app.useRpc('eth_getBlockTransactionCountByHash', async (params: any) => {
    return logAndHandleResponse('eth_getBlockTransactionCountByHash', params, (requestDetails) =>
      relay.eth().getBlockTransactionCountByHash(params?.[0], requestDetails),
    );
  });

  /**
   * Returns the number of transactions in a block, queried by block number.
   * params: Block Number
   *
   * returns: Block Transaction Count - Hex encoded integer
   */
  app.useRpc('eth_getBlockTransactionCountByNumber', async (params: any) => {
    return logAndHandleResponse('eth_getBlockTransactionCountByNumber', params, (requestDetails) =>
      relay.eth().getBlockTransactionCountByNumber(params?.[0], requestDetails),
    );
  });

  /**
   * Return the logs, filtered based on the parameters.
   * params: Filter
   *
   * returns: Logs - Array of log objects
   */
  app.useRpc('eth_getLogs', async (params: any) => {
    const filter = params[0];

    return logAndHandleResponse('eth_getLogs', params, (requestDetails) =>
      relay
        .eth()
        .getLogs(filter.blockHash, filter.fromBlock, filter.toBlock, filter.address, filter.topics, requestDetails),
    );
  });

  /**
   * Retrieves an address’ storage information.
   * params: Address - 20 byte hex value
   *         Storage Slot
   *         Block Number
   *
   * returns: Value - The storage value
   */
  app.useRpc('eth_getStorageAt', async (params: any) => {
    return logAndHandleResponse('eth_getStorageAt', params, (requestDetails) =>
      relay.eth().getStorageAt(params?.[0], params?.[1], requestDetails, params?.[2]),
    );
  });

  /**
   * Returns transaction information by block hash and transaction index.
   * params: Block Hash - 32 byte block hash
   *         Transaction Index - The position of the transaction within the block.
   *
   * returns: Transaction
   */
  app.useRpc('eth_getTransactionByBlockHashAndIndex', async (params: any) => {
    return logAndHandleResponse('eth_getTransactionByBlockHashAndIndex', params, (requestDetails) =>
      relay.eth().getTransactionByBlockHashAndIndex(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Returns transaction information by block number and transaction index.
   * params: Block Number
   *         Transaction Index - The position of the transaction within the block.
   *
   * returns: Transaction
   */
  app.useRpc('eth_getTransactionByBlockNumberAndIndex', async (params: any) => {
    return logAndHandleResponse('eth_getTransactionByBlockNumberAndIndex', params, (requestDetails) =>
      relay.eth().getTransactionByBlockNumberAndIndex(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Return uncle information about a block by hash and index.
   * Since Hedera does not have an uncle concept, this method will return an empty response.
   *
   * params: Block Hash
   *         Uncle Index
   *
   * returns: null
   */
  app.useRpc('eth_getUncleByBlockHashAndIndex', async () => {
    return logAndHandleResponse('eth_getUncleByBlockHashAndIndex', [], (requestDetails) =>
      relay.eth().getUncleByBlockHashAndIndex(requestDetails),
    );
  });

  /**
   * Return uncle information about a block by number and index.
   * Since Hedera does not have an uncle concept, this method will return an empty response.
   * params: Block Number
   *         Uncle Index
   *
   * returns: null
   */
  app.useRpc('eth_getUncleByBlockNumberAndIndex', async () => {
    return logAndHandleResponse('eth_getUncleByBlockNumberAndIndex', [], (requestDetails) =>
      relay.eth().getUncleByBlockNumberAndIndex(requestDetails),
    );
  });

  /**
   * Return the number of uncles in a block by hash.
   * Since Hedera does not have an uncle concept, this method will return a static response.
   * params: Block Hash
   *
   * returns: 0x0
   */
  app.useRpc('eth_getUncleCountByBlockHash', async () => {
    return logAndHandleResponse('eth_getUncleCountByBlockHash', [], (requestDetails) =>
      relay.eth().getUncleCountByBlockHash(requestDetails),
    );
  });

  /**
   * Return the number of uncles in a block by number.
   * Since Hedera does not have an uncle concept, this method will return a static response.
   * params: Block Number
   *
   * returns: 0x0
   */
  app.useRpc('eth_getUncleCountByBlockNumber', async () => {
    return logAndHandleResponse('eth_getUncleCountByBlockNumber', [], (requestDetails) =>
      relay.eth().getUncleCountByBlockNumber(requestDetails),
    );
  });

  /**
   * Returns the mining work information.
   * Since Hedera is a proof-of-stake network, this method is not applicable.
   *
   * returns: code: -32000
   */
  app.useRpc('eth_getWork', async () => {
    return logAndHandleResponse('eth_getWork', [], (requestDetails) => relay.eth().getWork(requestDetails));
  });

  /**
   * Returns the current hash rate nodes are mining.
   * Since Hedera is a proof-of-stake network, this method is not applicable and
   * returns a static response.
   *
   * returns: 0x0
   */
  app.useRpc('eth_hashrate', async () => {
    return logAndHandleResponse('eth_hashrate', [], (requestDetails) => relay.eth().hashrate(requestDetails));
  });

  /**
   * Returns whether the client is mining.
   * Since Hedera is a proof-of-stake network, this method is not applicable and
   * returns a static response.
   *
   * returns: false
   */
  app.useRpc('eth_mining', async () => {
    return logAndHandleResponse('eth_mining', [], (requestDetails) => relay.eth().mining(requestDetails));
  });

  /**
   * Used for proof-of-work submission.
   * Since Hedera is a proof-of-stake network, this method is not applicable and
   * returns a static response.
   *
   * returns: false
   */
  app.useRpc('eth_submitWork', async () => {
    return logAndHandleResponse('eth_submitWork', [], (requestDetails) => relay.eth().submitWork(requestDetails));
  });

  /**
   * Returns the sync status of the network. Due to the nature of hashgraph,
   * it is always up to date.
   *
   * returns: false
   */
  app.useRpc('eth_syncing', async () => {
    return logAndHandleResponse('eth_syncing', [], (requestDetails) => relay.eth().syncing(requestDetails));
  });

  /**
   * Returns the number of most recent block.
   *
   * returns: Block number - hex encoded integer
   */
  app.useRpc('eth_blockNumber', async () => {
    return logAndHandleResponse('eth_blockNumber', [], (requestDetails) => relay.eth().blockNumber(requestDetails));
  });

  /**
   * Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
   * params: Transaction Call
   *
   * returns: Gas used - hex encoded integer
   */
  app.useRpc('eth_estimateGas', async (params: any) => {
    // HotFix for Metamask sending `0x` on data param
    if (params?.[0]?.data === '0x') {
      delete params[0].data;
    }

    return logAndHandleResponse('eth_estimateGas', params, (requestDetails) =>
      relay.eth().estimateGas(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Returns the balance of the account of given address.
   * params: Address - hex encoded address
   *         Block number
   *
   * returns: Balance - hex encoded integer
   */
  app.useRpc('eth_getBalance', async (params: any) => {
    return logAndHandleResponse('eth_getBalance', params, (requestDetails) =>
      relay.eth().getBalance(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Returns code at a given address.
   * params: Address - hex encoded address
   *         Block number
   *
   * returns: Bytecode - hex encoded bytes
   */
  app.useRpc('eth_getCode', async (params: any) => {
    return logAndHandleResponse('eth_getCode', params, (requestDetails) =>
      relay.eth().getCode(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Returns the chain ID of the current network.
   *
   * returns: Chain ID - integer
   */
  app.useRpc('eth_chainId', async () => {
    return logAndHandleResponse('eth_chainId', [], (requestDetails) => relay.eth().chainId(requestDetails));
  });

  /**
   * Returns information about a block by number.
   * params: Block number - hex encoded integer
   *         Show Transaction Details Flag - boolean
   *
   * returns: Block object
   */
  app.useRpc('eth_getBlockByNumber', async (params: any) => {
    return logAndHandleResponse('eth_getBlockByNumber', params, (requestDetails) =>
      relay.eth().getBlockByNumber(params?.[0], Boolean(params?.[1]), requestDetails),
    );
  });

  /**
   * Returns information about a block by hash.
   * params: Block hash - 32 byte hex value
   *         Show Transaction Details Flag - boolean
   *
   * returns: Block object
   */
  app.useRpc('eth_getBlockByHash', async (params: any) => {
    return logAndHandleResponse('eth_getBlockByHash', params, (requestDetails) =>
      relay.eth().getBlockByHash(params?.[0], Boolean(params?.[1]), requestDetails),
    );
  });

  /**
   * Returns the current price per gas in wei.
   *
   * returns: Gas price - hex encoded integer
   */
  app.useRpc('eth_gasPrice', async () => {
    return logAndHandleResponse('eth_gasPrice', [], (requestDetails) => relay.eth().gasPrice(requestDetails));
  });

  /**
   * Returns the number of transactions sent from an address.
   * params: Address - hex encoded address
   *         Block number
   *
   * returns: Transaction count - hex encoded integer
   */
  app.useRpc('eth_getTransactionCount', async (params: any) => {
    return logAndHandleResponse('eth_getTransactionCount', params, (requestDetails) =>
      relay.eth().getTransactionCount(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Executes a new message call immediately without creating a transaction on the block chain.
   * params: Transaction Call
   *
   * returns: Value - hex encoded bytes
   */
  app.useRpc('eth_call', async (params: any) => {
    return logAndHandleResponse('eth_call', params, (requestDetails) =>
      relay.eth().call(params?.[0], params?.[1], requestDetails),
    );
  });

  /**
   * Submits a raw transaction.
   * params: Transaction Data - Signed transaction data
   *
   * returns: Transaction hash - 32 byte hex value
   */
  app.useRpc('eth_sendRawTransaction', async (params: any) => {
    return logAndHandleResponse('eth_sendRawTransaction', params, (requestDetails) =>
      relay.eth().sendRawTransaction(params?.[0], requestDetails),
    );
  });

  /**
   * Returns the receipt of a transaction by transaction hash.
   * params: Transaction hash - 32 byte hex value
   *
   * returns: Transaction Receipt - object
   */
  app.useRpc('eth_getTransactionReceipt', async (params: any) => {
    return logAndHandleResponse('eth_getTransactionReceipt', params, (requestDetails) =>
      relay.eth().getTransactionReceipt(params?.[0], requestDetails),
    );
  });
};

export { defineEthRoutes };
