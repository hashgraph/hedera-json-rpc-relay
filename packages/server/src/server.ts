// SPDX-License-Identifier: Apache-2.0

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { JsonRpcError, MirrorNodeClientError, predefined, Relay, RelayImpl } from '@hashgraph/json-rpc-relay/dist';
import { ITracerConfig, RequestDetails } from '@hashgraph/json-rpc-relay/src/lib/types';
import fs from 'fs';
import cors from 'koa-cors';
import path from 'path';
import pino from 'pino';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { v4 as uuid } from 'uuid';

import { formatRequestIdMessage } from './formatters';
import KoaJsonRpc from './koaJsonRpc';
import { TracerType, TYPES, Validator } from './validator';

const mainLogger = pino({
  name: 'hedera-json-rpc-relay',
  // Pino requires the default level to be explicitly set; without fallback value ("trace"), an invalid or missing value could trigger the "default level must be included in custom levels" error.
  level: ConfigService.get('LOG_LEVEL') || 'trace',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
    },
  },
});

const logger = mainLogger.child({ name: 'rpc-server' });
const register = new Registry();
const relay: Relay = new RelayImpl(logger.child({ name: 'relay' }), register);
const app = new KoaJsonRpc(logger.child({ name: 'koa-rpc' }), register, {
  limit: ConfigService.get('INPUT_SIZE_LIMIT') + 'mb',
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
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000, 40000, 50000, 60000], // ms (milliseconds)
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
    logger.info(
      `${formatRequestIdMessage(ctx.state.reqId)} [${ctx.method}]: ${ctx.state.methodName} ${ctx.status} ${ms} ms`,
    );
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
      const result = relay.eth().chainId(app.getRequestDetails());
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
    ctx.body = JSON.stringify(
      JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/openrpc.json')).toString()),
      null,
      2,
    );
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
    query: ctx.get('query'),
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

const logAndHandleResponse = async (methodName: string, methodParams: any[], methodFunction: any) => {
  const requestDetails = app.getRequestDetails();

  try {
    const methodValidations = Validator.METHODS[methodName];
    if (methodValidations) {
      if (logger.isLevelEnabled('debug')) {
        logger.debug(
          `${
            requestDetails.formattedRequestId
          } Validating method parameters for ${methodName}, params: ${JSON.stringify(methodParams)}`,
        );
      }
      Validator.validateParams(methodParams, methodValidations);
    }
    const response = await methodFunction(requestDetails);
    if (response instanceof JsonRpcError) {
      // log error only if it is not a contract revert, otherwise log it as debug
      if (response.code === predefined.CONTRACT_REVERT().code) {
        if (logger.isLevelEnabled('debug')) {
          logger.debug(`${requestDetails.formattedRequestId} ${response.message}`);
        }
      } else {
        logger.error(`${requestDetails.formattedRequestId} ${response.message}`);
      }

      return new JsonRpcError(
        {
          code: response.code,
          message: response.message,
          data: response.data,
        },
        requestDetails.requestId,
      );
    }
    return response;
  } catch (e: any) {
    let error = predefined.INTERNAL_ERROR();
    if (e instanceof MirrorNodeClientError) {
      if (e.isTimeout()) {
        error = predefined.REQUEST_TIMEOUT;
      }
    } else if (e instanceof JsonRpcError) {
      error = e;
    } else {
      logger.error(`${requestDetails.formattedRequestId} ${e.message}`);
    }

    logger.error(`${requestDetails.formattedRequestId} ${error.message}`);
    return new JsonRpcError(
      {
        code: error.code,
        message: error.message,
        data: error.data,
      },
      requestDetails.requestId,
    );
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

app.useRpc('web3_clientVersion', async () => {
  return logAndHandleResponse('web3_clientVersion', [], () => relay.web3().clientVersion());
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
  return logAndHandleResponse('eth_maxPriorityFeePerGas', [], (requestDetails) =>
    relay.eth().maxPriorityFeePerGas(requestDetails),
  );
});

/**
 * Debug related endpoints:
 */

app.useRpc('debug_traceTransaction', async (params: any) => {
  return logAndHandleResponse('debug_traceTransaction', params, (requestDetails: RequestDetails) => {
    const transactionIdOrHash = params[0];
    let tracer: TracerType = TracerType.OpcodeLogger;
    let tracerConfig: ITracerConfig = {};

    // Second param can be either a TracerType string, or an object for TracerConfig or TracerConfigWrapper
    if (TYPES.tracerType.test(params[1])) {
      tracer = params[1];
      if (TYPES.tracerConfig.test(params[2])) {
        tracerConfig = params[2];
      }
    } else if (TYPES.tracerConfig.test(params[1])) {
      tracerConfig = params[1];
    } else if (TYPES.tracerConfigWrapper.test(params[1])) {
      if (TYPES.tracerType.test(params[1].tracer)) {
        tracer = params[1].tracer;
      }
      if (TYPES.tracerConfig.test(params[1].tracerConfig)) {
        tracerConfig = params[1].tracerConfig;
      }
    }

    return relay.eth().debugService().debug_traceTransaction(transactionIdOrHash, tracer, tracerConfig, requestDetails);
  });
});

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
  return logAndHandleResponse('eth_submitHashrate', [], (requestDetails) => relay.eth().submitHashrate(requestDetails));
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

const rpcApp = app.rpcApp();

app.getKoaApp().use(async (ctx, next) => {
  await rpcApp(ctx, next);
});

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Unhandled Rejection at: Promise: ${JSON.stringify(p)}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception!');
});

export default app.getKoaApp();
