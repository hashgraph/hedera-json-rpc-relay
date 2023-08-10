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

import { Relay, RelayImpl, JsonRpcError, predefined, MirrorNodeClientError } from '@hashgraph/json-rpc-relay';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import KoaJsonRpc from './koaJsonRpc';
import { Validator } from './validator';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { formatRequestIdMessage } from './formatters';

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

const cors = require('koa-cors');
const logger = mainLogger.child({ name: 'rpc-server' });
const register = new Registry();
const relay: Relay = new RelayImpl(logger.child({ name: 'relay' }), register);
const app = new KoaJsonRpc(logger.child({ name: 'koa-rpc' }), register, {
  limit: process.env.INPUT_SIZE_LIMIT ? process.env.INPUT_SIZE_LIMIT + 'mb' : null
});

collectDefaultMetrics({ register, prefix: 'rpc_relay_' });

// clear and create metric in registry
const metricHistogramName = 'rpc_relay_method_response';
register.removeSingleMetric(metricHistogramName);
const methodResponseHistogram = new Histogram({
  name: metricHistogramName,
  help: 'JSON RPC method statusCode latency histogram',
  labelNames: ['method', 'statusCode'],
  registers: [register],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000, 40000, 50000, 60000] // ms (milliseconds)
});

// set cors
app.getKoaApp().use(cors());

/**
 * middleware for non POST request timing
 */
app.getKoaApp().use(async (ctx, next) => {
  const start = Date.now();
  ctx.state.start = start;
  await next();

  const ms = Date.now() - start;
  if (ctx.method !== 'POST') {
    logger.info(`[${ctx.method}]: ${ctx.url} ${ctx.status} ${ms} ms`);
  } else {
    // log call type, method, status code and latency
    logger.info(`${formatRequestIdMessage(ctx.state.reqId)} [${ctx.method}]: ${ctx.state.methodName} ${ctx.state.status} ${ms} ms`);
    methodResponseHistogram.labels(ctx.state.methodName, `${ctx.status}`).observe(ms);
  }
});

/**
 * prometheus metrics exposure
 */
app.getKoaApp().use(async (ctx, next) => {
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
app.getKoaApp().use(async (ctx, next) => {
  if (ctx.url === '/health/liveness') {
    ctx.status = 200;
  } else {
    return next();
  }
});

/**
 * readiness endpoint
 */
app.getKoaApp().use(async (ctx, next) => {
  if (ctx.url === '/health/readiness') {
    try {
      const result = relay.eth().chainId();
      if (result.indexOf('0x12') >= 0) {
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
 * openrpc endpoint
 */
app.getKoaApp().use(async (ctx, next) => {
  if (ctx.url === '/openrpc') {
    ctx.status = 200;
    ctx.body = JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/openrpc.json')).toString()), null, 2);
  } else {
    return next();
  }
});

/**
 * middleware to end for non POST requests asides health, metrics and openrpc
 */
app.getKoaApp().use(async (ctx, next) => {
  if (ctx.method === 'POST') {
    await next();
  } else if (ctx.method === 'OPTIONS') {
    // support CORS preflight
    ctx.status = 200;
  } else {
    logger.warn(`skipping HTTP method: [${ctx.method}], url: ${ctx.url}, status: ${ctx.status}`);
  }
});

app.getKoaApp().use(async (ctx, next) => {
  const options = {
    expose: ctx.get('Request-Id'),
    header: ctx.get('Request-Id'),
    query: ctx.get('query')
  };

  for (const key in options) {
    if (typeof options[key] !== 'boolean' && typeof options[key] !== 'string') {
      throw new Error(`Option \`${key}\` requires a boolean or a string`);
    }
  }

  let id = '';

  if (options.query) {
    id = options.query as string;
  }

  if (!id && options.header) {
    id = options.header;
  }

  if (!id) {
    id = uuid();
  }

  if (options.expose) {
    ctx.set(options.expose, id);
  }

  ctx.state.reqId = id;

  return next();
});

const logAndHandleResponse = async (methodName: any, methodParams: any, methodFunction: any) => {
  const requestId = app.getRequestId();
  const requestIdPrefix = requestId ? formatRequestIdMessage(requestId) : '';

  try {

    const methodValidations = Validator.METHODS[methodName];
    if (methodValidations) {
      Validator.validateParams(methodParams, methodValidations);
    }

    const response = await methodFunction(requestIdPrefix);
    if (response instanceof JsonRpcError) {
      logger.error(`${requestIdPrefix} ${response.message}`);
      return new JsonRpcError({
        name: response.name,
        code: response.code,
        message: response.message,
        data: response.data
      }, requestId);
    }
    return response;
  } catch (e: any) {
    let error = predefined.INTERNAL_ERROR();
    if (e instanceof MirrorNodeClientError) {
      if (e.isTimeout()) {
        error = predefined.REQUEST_TIMEOUT;
      }
    }
    else if (e instanceof JsonRpcError) {
      error = e;
    }

    logger.error(`${requestIdPrefix} ${error.message}`);
    return new JsonRpcError({
      name: error.name,
      code: error.code,
      message: error.message,
      data: error.data,
    }, requestId);
  }
};

/**
 * returns: false
 */
app.useRpc('net_listening', async () => {
  return logAndHandleResponse('net_listening', [], () => '' + relay.net().listening());
});

/**
 *  Returns the current network ID
 */
app.useRpc('net_version', async () => {
  return logAndHandleResponse('net_version', [], () => relay.net().version());
});

/**
 * Returns the number of most recent block.
 *
 * returns: Block number - hex encoded integer
 */
app.useRpc('eth_blockNumber', async () => {
  return logAndHandleResponse('eth_blockNumber', [], (requestId) => relay.eth().blockNumber(requestId));
});

/**
 * Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
 * params: Transaction Call
 *
 * returns: Gas used - hex encoded integer
 */
app.useRpc('eth_estimateGas', async (params: any) => {
  return logAndHandleResponse('eth_estimateGas', params, (requestId) =>
      relay.eth().estimateGas(params?.[0], params?.[1], requestId));
});

/**
 * Returns the balance of the account of given address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Balance - hex encoded integer
 */
app.useRpc('eth_getBalance', async (params: any) => {
  return logAndHandleResponse('eth_getBalance', params, (requestId) =>
      relay.eth().getBalance(params?.[0], params?.[1], requestId));
});

/**
 * Returns code at a given address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Bytecode - hex encoded bytes
 */
app.useRpc('eth_getCode', async (params: any) => {
  return logAndHandleResponse('eth_getCode', params, (requestId) =>
      relay.eth().getCode(params?.[0], params?.[1], requestId));
});

/**
 * Returns the chain ID of the current network.
 *
 * returns: Chain ID - integer
 */
app.useRpc('eth_chainId', async () => {
  return logAndHandleResponse('eth_chainId', [], (requestId) =>
      relay.eth().chainId(requestId));
});

/**
 * Returns information about a block by number.
 * params: Block number - hex encoded integer
 *         Show Transaction Details Flag - boolean
 *
 * returns: Block object
 */
app.useRpc('eth_getBlockByNumber', async (params: any) => {
  return logAndHandleResponse('eth_getBlockByNumber', params, (requestId) =>
      relay.eth().getBlockByNumber(params?.[0], Boolean(params?.[1]), requestId));
});

/**
 * Returns information about a block by hash.
 * params: Block hash - 32 byte hex value
 *         Show Transaction Details Flag - boolean
 *
 * returns: Block object
 */
app.useRpc('eth_getBlockByHash', async (params: any) => {
  return logAndHandleResponse('eth_getBlockByHash', params, (requestId) =>
      relay.eth().getBlockByHash(params?.[0], Boolean(params?.[1]), requestId));
});

/**
 * Returns the current price per gas in wei.
 *
 * returns: Gas price - hex encoded integer
 */
app.useRpc('eth_gasPrice', async () => {
  return logAndHandleResponse('eth_gasPrice', [], (requestId) => relay.eth().gasPrice(requestId));
});

/**
 * Returns the number of transactions sent from an address.
 * params: Address - hex encoded address
 *         Block number
 *
 * returns: Transaction count - hex encoded integer
 */
app.useRpc('eth_getTransactionCount', async (params: any) => {
  return logAndHandleResponse('eth_getTransactionCount', params, (requestId) =>
      relay.eth().getTransactionCount(params?.[0], params?.[1], requestId));
});

/**
 * Executes a new message call immediately without creating a transaction on the block chain.
 * params: Transaction Call
 *
 * returns: Value - hex encoded bytes
 */
app.useRpc('eth_call', async (params: any) => {
  return logAndHandleResponse('eth_call', params, (requestId) =>
      relay.eth().call(params?.[0], params?.[1], requestId));
});

/**
 * Submits a raw transaction.
 * params: Transaction Data - Signed transaction data
 *
 * returns: Transaction hash - 32 byte hex value
 */
app.useRpc('eth_sendRawTransaction', async (params: any) => {
  return logAndHandleResponse('eth_sendRawTransaction', params, (requestId) =>
      relay.eth().sendRawTransaction(params?.[0], requestId));
});

/**
 * Returns the receipt of a transaction by transaction hash.
 * params: Transaction hash - 32 byte hex value
 *
 * returns: Transaction Receipt - object
 */
app.useRpc('eth_getTransactionReceipt', async (params: any) => {
  return logAndHandleResponse('eth_getTransactionReceipt', params, (requestId) =>
      relay.eth().getTransactionReceipt(params?.[0], requestId));
});

app.useRpc('web3_clientVersion', async () => {
  return logAndHandleResponse('web3_clientVersion', [], () => relay.web3().clientVersion());
});

/**
 * Returns an empty array.
 *
 * returns: Accounts - hex encoded address
 */
app.useRpc('eth_accounts', async () => {
  return logAndHandleResponse('eth_accounts', [], (requestId) => relay.eth().accounts(requestId));
});

/**
 * Returns the information about a transaction requested by transaction hash.
 * params: Transaction hash - 32 byte hex value
 *
 * returns: Transaction Object
 */
app.useRpc('eth_getTransactionByHash', async (params: any) => {
  return logAndHandleResponse('eth_getTransactionByHash', params, (requestId) =>
      relay.eth().getTransactionByHash(params[0], requestId));
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
  return logAndHandleResponse('eth_feeHistory', params, (requestId) =>
      relay.eth().feeHistory(Number(params?.[0]), params?.[1], params?.[2], requestId));
});

/**
 * Returns the number of transactions in a block, queried by hash.
 * params: Block Hash
 *
 * returns: Block Transaction Count - Hex encoded integer
 */
app.useRpc('eth_getBlockTransactionCountByHash', async (params: any) => {
  return logAndHandleResponse('eth_getBlockTransactionCountByHash', params, (requestId) =>
      relay.eth().getBlockTransactionCountByHash(params?.[0], requestId));
});

/**
 * Returns the number of transactions in a block, queried by block number.
 * params: Block Number
 *
 * returns: Block Transaction Count - Hex encoded integer
 */
app.useRpc('eth_getBlockTransactionCountByNumber', async (params: any) => {
  return logAndHandleResponse('eth_getBlockTransactionCountByNumber', params, (requestId) =>
      relay.eth().getBlockTransactionCountByNumber(params?.[0], requestId));
});

/**
 * Return the logs, filtered based on the parameters.
 * params: Filter
 *
 * returns: Logs - Array of log objects
 */
app.useRpc('eth_getLogs', async (params: any) => {
  const filter = params[0];

  return logAndHandleResponse('eth_getLogs', params, (requestId) => relay.eth().getLogs(
      filter.blockHash,
      filter.fromBlock,
      filter.toBlock,
      filter.address,
      filter.topics,
      requestId
  ));
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
  return logAndHandleResponse('eth_getStorageAt', params, (requestId) =>
      relay.eth().getStorageAt(params?.[0], params?.[1], params?.[2], requestId));
});

/**
 * Returns transaction information by block hash and transaction index.
 * params: Block Hash - 32 byte block hash
 *         Transaction Index - The position of the transaction within the block.
 *
 * returns: Transaction
 */
app.useRpc('eth_getTransactionByBlockHashAndIndex', async (params: any) => {
  return logAndHandleResponse('eth_getTransactionByBlockHashAndIndex', params, (requestId) =>
      relay.eth().getTransactionByBlockHashAndIndex(params?.[0], params?.[1], requestId));
});

/**
 * Returns transaction information by block number and transaction index.
 * params: Block Number
 *         Transaction Index - The position of the transaction within the block.
 *
 * returns: Transaction
 */
app.useRpc('eth_getTransactionByBlockNumberAndIndex', async (params: any) => {
  return logAndHandleResponse('eth_getTransactionByBlockNumberAndIndex', params, (requestId) =>
      relay.eth().getTransactionByBlockNumberAndIndex(params?.[0], params?.[1], requestId));
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
  return logAndHandleResponse('eth_getUncleByBlockHashAndIndex', [], (requestId) =>
      relay.eth().getUncleByBlockHashAndIndex(requestId));
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
  return logAndHandleResponse('eth_getUncleByBlockNumberAndIndex', [], (requestId) =>
      relay.eth().getUncleByBlockNumberAndIndex(requestId));
});

/**
 * Return the number of uncles in a block by hash.
 * Since Hedera does not have an uncle concept, this method will return a static response.
 * params: Block Hash
 *
 * returns: 0x0
 */
app.useRpc('eth_getUncleCountByBlockHash', async () => {
  return logAndHandleResponse('eth_getUncleCountByBlockHash', [], (requestId) =>
      relay.eth().getUncleCountByBlockHash(requestId));
});

/**
 * Return the number of uncles in a block by number.
 * Since Hedera does not have an uncle concept, this method will return a static response.
 * params: Block Number
 *
 * returns: 0x0
 */
app.useRpc('eth_getUncleCountByBlockNumber', async () => {
  return logAndHandleResponse('eth_getUncleCountByBlockNumber', [], (requestId) =>
      relay.eth().getUncleCountByBlockNumber(requestId));
});

/**
 * Returns the mining work information.
 * Since Hedera is a proof-of-stake network, this method is not applicable.
 *
 * returns: code: -32000
 */
app.useRpc('eth_getWork', async () => {
  return logAndHandleResponse('eth_getWork', [], (requestId) => relay.eth().getWork(requestId));
});

/**
 * Returns the current hash rate nodes are mining.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: 0x0
 */
app.useRpc('eth_hashrate', async () => {
  return logAndHandleResponse('eth_hashrate', [], (requestId) => relay.eth().hashrate(requestId));
});

/**
 * Returns whether the client is mining.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: false
 */
app.useRpc('eth_mining', async () => {
  return logAndHandleResponse('eth_mining', [], (requestId) => relay.eth().mining(requestId));
});

/**
 * Used for proof-of-work submission.
 * Since Hedera is a proof-of-stake network, this method is not applicable and
 * returns a static response.
 *
 * returns: false
 */
app.useRpc('eth_submitWork', async () => {
  return logAndHandleResponse('eth_submitWork', [], (requestId) => relay.eth().submitWork(requestId));
});

/**
 * Returns the sync status of the network. Due to the nature of hashgraph,
 * it is always up to date.
 *
 * returns: false
 */
app.useRpc('eth_syncing', async () => {
  return logAndHandleResponse('eth_syncing', [], (requestId) => relay.eth().syncing(requestId));
});

/**
 * Returns the JSON-RPC Relay version number.
 *
 * returns: string
 */
app.useRpc('web3_client_version', async () => {
  return logAndHandleResponse('web3_client_version', [], () => relay.web3().clientVersion());
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
  return logAndHandleResponse('eth_maxPriorityFeePerGas', [], (requestId) => relay.eth().maxPriorityFeePerGas(requestId));
});

/**
 * Filter related endpoints:
 */

app.useRpc('eth_newFilter', async (params: any) => {
  const filter = params[0];
  return logAndHandleResponse('eth_newFilter', [], (requestId) => relay.eth().filterService().newFilter(
      filter?.fromBlock,
      filter?.toBlock,
      filter?.address,
      filter?.topics,
      requestId));
});

app.useRpc('eth_getFilterLogs', async (params: any) => {
  return logAndHandleResponse('eth_getFilterLogs', params, (requestId) =>
    relay.eth().filterService().getFilterLogs(params?.[0], requestId));
});

/**
 * Not supported
 */
app.useRpc('eth_submitHashrate', async () => {
  return logAndHandleResponse('eth_submitHashrate', [], (requestId) => relay.eth().submitHashrate(requestId));
});

app.useRpc('eth_signTransaction', async () => {
  return logAndHandleResponse('eth_signTransaction', [], (requestId) => relay.eth().signTransaction(requestId));
});

app.useRpc('eth_sign', async () => {
  return logAndHandleResponse('eth_sign', [], (requestId) => relay.eth().sign(requestId));
});

app.useRpc('eth_sendTransaction', async () => {
  return logAndHandleResponse('eth_sendTransaction', [], (requestId) => relay.eth().sendTransaction(requestId));
});

app.useRpc('eth_protocolVersion', async () => {
  return logAndHandleResponse('eth_protocolVersion', [], (requestId) => relay.eth().protocolVersion(requestId));
});

app.useRpc('eth_coinbase', async () => {
  return logAndHandleResponse('eth_coinbase', [], (requestId) => relay.eth().coinbase(requestId));
});

app.useRpc('eth_newPendingTransactionFilter', async () => {
  return logAndHandleResponse('eth_newPendingTransactionFilter', [], (requestId) => relay.eth().filterService().newPendingTransactionFilter(requestId));
});

/**
 * It returns true if the filter was successfully uninstalled, otherwise false
 * params: Filter Id - string
 *
 * returns: boolean
 */
app.useRpc('eth_uninstallFilter', async (params: any) => {
  return logAndHandleResponse('eth_uninstallFilter', params, (requestId) =>
      relay.eth().filterService().uninstallFilter(params?.[0], requestId));
});

const rpcApp = app.rpcApp();

app.getKoaApp().use(async (ctx, next) => {
  await rpcApp(ctx, next);
  // Handle custom errors
  if (ctx.body && ctx.body.result instanceof JsonRpcError) {
    ctx.body.error = { ...ctx.body.result };
    delete ctx.body.result;
  }
});

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Unhandled Rejection at: Promise: ${JSON.stringify(p)}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception!');
});

export default app.getKoaApp();
