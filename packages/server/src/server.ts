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

import { Relay, RelayImpl } from '@hashgraph/json-rpc-relay';
import Koa from 'koa';
import koaJsonRpc from 'koa-jsonrpc';
import { collectDefaultMetrics, Counter, Registry } from 'prom-client';

import pino from 'pino';

const mainLogger = pino({
  name: 'hedera-json-rpc-relay',
  level: process.env.LOG_LEVEL || 'trace',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true
    }
  }
});
const logger = mainLogger.child({ name: 'rpc-server' });

const relay: Relay = new RelayImpl(logger);
const cors = require('koa-cors');
const app = new Koa();
const rpc = koaJsonRpc();

const register = new Registry();
collectDefaultMetrics({ register, prefix: 'rpc_relay_' });
const methodCounter = new Counter({ name: 'rpc_method_counter', help: 'JSON RPC method counter', labelNames: ['method'], registers: [register] });
const successCounter = new Counter({ name: 'rpc_success_counter', help: 'JSON RPC success counter', labelNames: ['success'], registers: [register] });

/**
 * middleware for request timing
 */
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(`[${ctx.method}]: ${ctx.url} ${ms} ms`);

  if (ctx.method === 'POST') {
    const success = ctx.body.result ? 'true' : 'false';
    successCounter.inc({ success: success });
  }
});

/**
 * prometheus metrics exposure
 */
app.use(async (ctx, next) => {
  if (ctx.url === '/metrics') {
    ctx.status = 200;
    ctx.body = await register.metrics();
  } else {
    return next();
  }
});

/**
 * liveness endpoint
 */
app.use(async (ctx, next) => {
  if (ctx.url === '/health/liveness') {
    ctx.status = 200;
  } else {
    return next();
  }
});

/**
 * readiness endpoint
 */
app.use(async (ctx, next) => {
  if (ctx.url === '/health/readiness') {
    try {
      const result = relay.eth().chainId();
      if (result.indexOf('0x12') > 0) {
        ctx.status = 200;
        ctx.body = 'OK';
      } else {
        ctx.body = 'DOWN';
        ctx.status = 503; // UNAVAILABLE
      }
    } catch (e) {
      logger.error(e);
      throw e;
    }
  } else {
    return next();
  }
});

/**
 * returns: false
 */
rpc.use('net_listening', async () => {
  logger.debug('net_listening');
  return '' + relay.net().listening();
});

/**
 *  Returns the current network ID
 */
rpc.use('net_version', async () => {
  methodCounter.inc({ method: 'net_version' });
  logger.debug("net_version");
  return relay.net().version();
});

/**
 * Returns the number of most recent block.
 *
 * returns: Block number - hex encoded integer
 */
rpc.use('eth_blockNumber', async () => {
  methodCounter.inc({ method: 'eth_blockNumber' });
  logger.debug("eth_blockNumber");
  return toHexString(await relay.eth().blockNumber());
});

/**
 * Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
 * params: Transaction Call
 *
 * returns: Gas used - hex encoded integer
 */
rpc.use('eth_estimateGas', async (params: any) => {
  logger.debug("eth_estimateGas");
  return toHexString(await relay.eth().estimateGas());
});

/**
 * Returns the balance of the account of given address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Balance - hex encoded integer
 */
rpc.use('eth_getBalance', async (params: any) => {
  logger.debug("eth_getBalance");
  return relay.eth().getBalance(params?.[0], params?.[1]);
});

/**
 * Returns code at a given address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Bytecode - hex encoded bytes
 */
rpc.use('eth_getCode', async (params: any) => {
  logger.debug("eth_getCode");
  return relay.eth().getCode(params?.[0], params?.[1]);
});

/**
 * Returns the chain ID of the current network.
 *
 * returns: Chain ID - integer
 */
rpc.use('eth_chainId', async () => {
  methodCounter.inc({ method: 'eth_chainId' });
  logger.debug("eth_chainId");
  const result = relay.eth().chainId();
  logger.debug(result);
  return result;
});

/**
 * Returns information about a block by number.
 * params: Block number - hex encoded integer
 *         Show Transaction Details Flag - boolean
 *
 * returns: Block object
 */
rpc.use('eth_getBlockByNumber', async (params: any) => {
  logger.debug("eth_getBlockByNumber");
  return relay.eth().getBlockByNumber(Number(params?.[0]), Boolean(params?.[1]));
});

/**
 * Returns information about a block by hash.
 * params: Block hash - 32 byte hex value
 *         Show Transaction Details Flag - boolean
 *
 * returns: Block object
 */
rpc.use('eth_getBlockByHash', async (params: any) => {
  logger.debug("eth_getBlockByHash");
  return relay.eth().getBlockByHash(params?.[0], Boolean(params?.[1]));
});

/**
 * Returns the current price per gas in wei.
 *
 * returns: Gas price - hex encoded integer
 */
rpc.use('eth_gasPrice', async () => {
  logger.debug("eth_gasPrice");
  return toHexString(await relay.eth().gasPrice());
});

/**
 * Returns the number of transactions sent from an address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Transaction count - hex encoded integer
 */
rpc.use('eth_getTransactionCount', async (params: any) => {
  logger.debug("eth_getTransactionCount");
  try {
    return toHexString(await relay.eth().getTransactionCount(params?.[0], params?.[1]));
  } catch (e) {
    logger.error(e);
    throw e;
  }
});

/**
 * Executes a new message call immediately without creating a transaction on the block chain.
 * params: Transaction Call
 *
 * returns: Value - hex encoded bytes
 */
rpc.use('eth_call', async (params: any) => {
  logger.debug("eth_call");
  try {
    return relay.eth().call(params?.[0], params?.[1]);
  } catch (e) {
    logger.error(e);
    throw e;
  }
});

/**
 * Submits a raw transaction.
 * params: Transaction Data - Signed transaction data
 *
 * returns: Transaction hash - 32 byte hex value
 */
rpc.use('eth_sendRawTransaction', async (params: any) => {
  logger.debug("eth_sendRawTransaction");
  return relay.eth().sendRawTransaction(params?.[0]);
});

/**
 * Returns the receipt of a transaction by transaction hash.
 * params: Transaction hash - 32 byte hex value
 *
 * returns: Transaction Receipt - object
 */
rpc.use('eth_getTransactionReceipt', async (params: any) => {
  return relay.eth().getTransactionReceipt(params?.[0]);
});

rpc.use('web3_clientVersion', async (params: any) => {
  logger.debug("web3_clientVersion");
  return relay.web3().clientVersion();
});

/**
 * Returns an empty array.
 *
 * returns: Accounts - hex encoded address
 */
rpc.use('eth_accounts', async () => {
  logger.debug("eth_accounts");
  return relay.eth().accounts();
});

/**
 * Returns the information about a transaction requested by transaction hash.
 * params: Transaction hash - 32 byte hex value
 *
 * returns: Transaction Object
 */
rpc.use('eth_getTransactionByHash', async (params: any) => {
  logger.debug("eth_getTransactionByHash");
  return relay.eth().getTransactionByHash(params[0]);
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
rpc.use('eth_feeHistory', async (params: any) => {
  logger.debug("eth_feeHistory");
  return relay.eth().feeHistory(Number(params?.[0]), params?.[1], params?.[2]);
});


/**
 * Returns the number of transactions in a block, queried by hash.
 * params: Block Hash
 *
 * returns: Block Transaction Count - Hex encoded integer
 */
rpc.use('eth_getBlockTransactionCountByHash', async (params: any) => {
  logger.debug("eth_getBlockTransactionCountByHash");
  return relay.eth().getBlockTransactionCountByHash(params?.[0]);
});

/**
 * Returns the number of transactions in a block, queried by block number.
 * params: Block Number
 *
 * returns: Block Transaction Count - Hex encoded integer
 */
rpc.use('eth_getBlockTransactionCountByNumber', async (params: any) => {
  logger.debug("eth_getBlockTransactionCountByNumber");
  return relay.eth().getBlockTransactionCountByNumber(params?.[0]);
});

/**
 * Return the logs, filtered based on the parameters.
 * params: Filter
 *
 * returns: Logs - Array of log objects
 */
rpc.use('eth_getLogs', async (params: any) => {
  logger.debug("eth_getLogs");
  //TODO
});


/**
 * Retrieves an address’ storage information.
 * params: Address - 20 byte hex value
 *         Storage Slot
 *         Block Number
 *
 * returns: Value - The storage value
 */
rpc.use('eth_getStorageAt', async (params: any) => {
  logger.debug("eth_getStorageAt");
  //TODO
});

/**
 * Returns transaction information by block hash and transaction index.
 * params: Block Hash - 32 byte block hash
 *         Transaction Index - The position of the transaction within the block.
 *
 * returns: Transaction
 */
rpc.use('eth_getTransactionByBlockHashAndIndex', async (params: any) => {
  logger.debug("eth_getTransactionByBlockHashAndIndex");
  return relay.eth().getTransactionByBlockHashAndIndex(params?.[0], params?.[1]);
});

/**
 * Returns transaction information by block number and transaction index.
 * params: Block Number
 *         Transaction Index - The position of the transaction within the block.
 *
 * returns: Transaction
 */
rpc.use('eth_getTransactionByBlockNumberAndIndex', async (params: any) => {
  logger.debug("eth_getTransactionByBlockNumberAndIndex");
  return relay.eth().getTransactionByBlockNumberAndIndex(params?.[0], params?.[1]);
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
rpc.use('eth_getUncleByBlockHashAndIndex', async (params: any) => {
  logger.debug("eth_getUncleByBlockHashAndIndex");
  return relay.eth().getUncleByBlockHashAndIndex();
});

/**
 * Return uncle information about a block by number and index.
 * Since Hedera does not have an uncle concept, this method will return an empty response.
 * params: Block Number
 *         Uncle Index
 *
 * returns: null
 */
rpc.use('eth_getUncleByBlockNumberAndIndex', async (params: any) => {
  logger.debug("eth_getUncleByBlockNumberAndIndex");
  return relay.eth().getUncleByBlockNumberAndIndex();
});

/**
 * Return the number of uncles in a block by hash.
 * Since Hedera does not have an uncle concept, this method will return a static response.
 * params: Block Hash
 *
 * returns: 0x0
 */
rpc.use('eth_getUncleCountByBlockHash', async (params: any) => {
  logger.debug("eth_getUncleCountByBlockHash");
  return relay.eth().getUncleCountByBlockHash();
});

/**
 * Return the number of uncles in a block by number.
 * Since Hedera does not have an uncle concept, this method will return a static response.
 * params: Block Number
 *
 * returns: 0x0
 */
rpc.use('eth_getUncleCountByBlockNumber', async (params: any) => {
  logger.debug("eth_getUncleCountByBlockNumber");
  return relay.eth().getUncleCountByBlockNumber();
});

/**
 * Returns the mining work information.
 * Since Hedera is a proof-of-stake network, this method is not applicable.
 *
 * returns: code: -32000
 */
rpc.use('eth_getWork', async (params: any) => {
  logger.debug("eth_getWork");
  //TODO
});

/**
 * Returns the current hash rate nodes are mining.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: 0x0
 */
rpc.use('eth_hashrate', async (params: any) => {
  logger.debug("eth_hashrate");
  return relay.eth().hashrate();
});

/**
 * Returns whether the client is mining.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: false
 */
rpc.use('eth_mining', async (params: any) => {
  logger.debug("eth_mining");
  return relay.eth().mining();
});

/**
 * Used for proof-of-work submission.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: false
 */
rpc.use('eth_submitWork', async (params: any) => {
  logger.debug("eth_submitWork");
  return relay.eth().submitWork();
});

/**
 * Returns the sync status of the network. Due to the nature of hashgraph,
 * it is always up to date.
 *
 * returns: false
 */
rpc.use('eth_syncing', async (params: any) => {
  logger.debug("eth_syncing");
  return relay.eth().syncing();
});

/**
 * Returns the JSON-RPC Relay version number.
 *
 * returns: string
 */
rpc.use('web3_client_version', async (params: any) => {
  methodCounter.inc({ method: 'web3_client_version' });
  logger.debug("web3_client_version");
  return relay.web3().clientVersion();
});

/**
 * Not supported
 */
// rpc.use('web3_sha', async (params: any) => { });
// rpc.use('parity_nextNonce', async (params: any) => { });
// rpc.use('net_peerCount', async (params: any) => { });
// rpc.use('eth_submitHashrate', async (params: any) => { });
// rpc.use('eth_signTypedData', async (params: any) => { });
// rpc.use('eth_signTransaction', async (params: any) => { });
// rpc.use('eth_sign', async (params: any) => { });
// rpc.use('eth_sendTransaction', async (params: any) => { });
// rpc.use('eth_protocolVersion', async (params: any) => { });
// rpc.use('eth_getProof', async (params: any) => { });
// rpc.use('eth_coinbase', async (params: any) => { });


// app.use(logger({
//   getRequestLogLevel: (ctx) => 'debug',
//   getResponseLogLevel: (ctx) => 'debug',
//   getErrorLogLevel: (ctx) => 'debug',
// }));
app.use(cors());
app.use(rpc.app());

export default app;

function toHexString(num: number) {
  return '0x' + num.toString(16);
}