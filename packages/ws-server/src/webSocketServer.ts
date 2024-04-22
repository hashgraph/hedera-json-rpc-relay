/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import Koa from 'koa';
import path from 'path';
import pino from 'pino';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
import websockify from 'koa-websocket';
import { Registry } from 'prom-client';
import { WS_CONSTANTS } from './utils/constants';
import { formatIdMessage } from './utils/formatters';
import { handleConnectionClose } from './utils/utils';
import WsMetricRegistry from './metrics/wsMetricRegistry';
import ConnectionLimiter from './metrics/connectionLimiter';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import KoaJsonRpc from '@hashgraph/json-rpc-server/dist/koaJsonRpc';
import { Validator } from '@hashgraph/json-rpc-server/dist/validator';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import { type Relay, RelayImpl, predefined, JsonRpcError } from '@hashgraph/json-rpc-relay';
import {
  handleEthCall,
  handleEthGetLogs,
  handleEthGetCode,
  handleEthSubsribe,
  handleEthGasPrice,
  handleEthGetBalance,
  handleEthEstimateGas,
  handleEthBlockNumber,
  handleEthUnsubscribe,
  handleEthGetStorageAt,
  handleEthGetBlockByHash,
  handleEthGetBlockByNumber,
  handleEthSendRawTransaction,
  handleEthGetTransactionCount,
  handleEthGetTransactionByHash,
  handleEthGetTransactionReceipt,
} from './controllers';

const mainLogger = pino({
  name: 'hedera-json-rpc-relay',
  level: process.env.LOG_LEVEL || 'trace',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
    },
  },
});
const register = new Registry();
const logger = mainLogger.child({ name: 'rpc-ws-server' });
const relay: Relay = new RelayImpl(logger, register);

const mirrorNodeClient = relay.mirrorClient();
const limiter = new ConnectionLimiter(logger, register);
const wsMetricRegistry = new WsMetricRegistry(register);

const pingInterval = Number(process.env.WS_PING_INTERVAL || 1000);

const app = websockify(new Koa());
app.ws.use(async (ctx) => {
  // Increment the total opened connections
  wsMetricRegistry.getCounter('totalOpenedConnections').inc();

  // Record the start time when the connection is established
  const startTime = process.hrtime();

  ctx.websocket.id = relay.subs()?.generateId();
  ctx.websocket.limiter = limiter;
  ctx.websocket.wsMetricRegistry = wsMetricRegistry;
  const connectionIdPrefix = formatIdMessage('Connection ID', ctx.websocket.id);
  const requestIdPrefix = formatIdMessage('Request ID', uuid());
  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix} New connection established. Current active connections: ${ctx.app.server._connections}`,
  );

  // Close event handle
  ctx.websocket.on('close', async (code, message) => {
    logger.info(
      `${connectionIdPrefix} ${requestIdPrefix} Closing connection ${ctx.websocket.id} | code: ${code}, message: ${message}`,
    );
    await handleConnectionClose(ctx, relay, limiter, wsMetricRegistry, startTime);
  });

  // Increment limit counters
  limiter.incrementCounters(ctx);

  // Limit checks
  limiter.applyLimits(ctx);

  // listen on message event
  ctx.websocket.on('message', async (msg) => {
    // Increment the total messages counter for each message received
    wsMetricRegistry.getCounter('totalMessageCounter').inc();

    // Record the start time when a new message is received
    const msgStartTime = process.hrtime();

    // Reset the TTL timer for inactivity upon receiving a message from the client
    limiter.resetInactivityTTLTimer(ctx.websocket);

    // parse the received message from the client into a JSON object
    let request;
    try {
      request = JSON.parse(msg.toString('ascii'));
    } catch (e) {
      // Log an error if the message cannot be decoded and send an invalid request error to the client
      logger.error(
        `${connectionIdPrefix} ${requestIdPrefix}: Could not decode message from connection, message: ${msg}, error: ${e}`,
      );
      ctx.websocket.send(JSON.stringify(new JsonRpcError(predefined.INVALID_REQUEST, undefined)));
      return;
    }

    // Extract the method and parameters from the received request
    const { method, params } = request;
    logger.debug(`${connectionIdPrefix} ${requestIdPrefix}: Method: ${method}. Params: ${JSON.stringify(params)}`);

    // Increment metrics for the received method
    wsMetricRegistry.getCounter('methodsCounter').labels(method).inc();
    wsMetricRegistry.getCounter('methodsCounterByIp').labels(ctx.request.ip, method).inc();

    // Validate request's params
    try {
      const methodValidations = Validator.METHODS[method];
      if (methodValidations) {
        Validator.validateParams(params, methodValidations);
      }
    } catch (error) {
      logger.error(
        error,
        `${connectionIdPrefix} ${requestIdPrefix} Error in parameter validation. Method: ${method}, params: ${JSON.stringify(
          params,
        )}.`,
      );
      ctx.websocket.send(JSON.stringify(jsonResp(request.id, error, undefined)));
      return;
    }

    // Check if the subscription limit is exceeded for ETH_SUBSCRIBE method
    let response;
    if (method === WS_CONSTANTS.METHODS.ETH_SUBSCRIBE && !limiter.validateSubscriptionLimit(ctx)) {
      response = jsonResp(request.id, predefined.MAX_SUBSCRIPTIONS, undefined);
      ctx.websocket.send(JSON.stringify(response));
      return;
    }

    // method logics
    try {
      const sharedParams = { ctx, params, logger, relay, request, method, requestIdPrefix, connectionIdPrefix };

      switch (method) {
        case WS_CONSTANTS.METHODS.ETH_SUBSCRIBE:
          response = await handleEthSubsribe({ ...sharedParams, limiter, mirrorNodeClient });
          break;
        case WS_CONSTANTS.METHODS.ETH_UNSUBSCRIBE:
          response = handleEthUnsubscribe(ctx, params, request, relay, limiter);
          break;
        case WS_CONSTANTS.METHODS.ETH_CHAIN_ID:
          response = jsonResp(request.id, null, relay.eth().chainId());
          break;
        case WS_CONSTANTS.METHODS.ETH_SEND_RAW_TRANSACTION:
          await handleEthSendRawTransaction(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_CODE:
          await handleEthGetCode(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_ESTIMATE_GAS:
          await handleEthEstimateGas(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_TRANSACTION_BY_HASH:
          await handleEthGetTransactionByHash(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_TRANSACTION_RECEIPT:
          await handleEthGetTransactionReceipt(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_TRANSACTION_COUNT:
          await handleEthGetTransactionCount(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_BLOCK_BY_HASH:
          await handleEthGetBlockByHash(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_BLOCK_BY_NUMBER:
          await handleEthGetBlockByNumber(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_BLOCK_NUMBER:
          await handleEthBlockNumber(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GAS_PRICE:
          await handleEthGasPrice(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_BALANCE:
          await handleEthGetBalance(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_STORAGE_AT:
          await handleEthGetStorageAt(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_GET_LOGS:
          await handleEthGetLogs(sharedParams);
          break;
        case WS_CONSTANTS.METHODS.ETH_CALL:
          await handleEthCall(sharedParams);
          break;
        default:
          response = jsonResp(request.id, predefined.INTERNAL_ERROR(), null);
      }
    } catch (error) {
      logger.error(
        error,
        `${connectionIdPrefix} ${requestIdPrefix} Encountered error on connectionID: ${
          ctx.websocket.id
        }, method: ${method}, params: ${JSON.stringify(params)}`,
      );
      response = jsonResp(request.id, error, undefined);
    }

    if (response) {
      ctx.websocket.send(JSON.stringify(response));
    }

    // Calculate the duration of the connection
    const msgEndTime = process.hrtime(msgStartTime);
    const msgDurationInMiliSeconds = (msgEndTime[0] + msgEndTime[1] / 1e9) * 1000; // Convert duration to miliseconds

    // Update the connection duration histogram with the calculated duration
    wsMetricRegistry.getHistogram('messageDuration').labels(method).observe(msgDurationInMiliSeconds);
  });

  if (pingInterval > 0) {
    setInterval(async () => {
      ctx.websocket.send(JSON.stringify(jsonResp(null, null, null)));
    }, pingInterval);
  }
});

const httpApp = new KoaJsonRpc(logger, register).getKoaApp();
httpApp.use(async (ctx, next) => {
  // prometheus metrics exposure
  if (ctx.url === '/metrics') {
    ctx.status = 200;
    ctx.body = await register.metrics();
  } else if (ctx.url === '/health/liveness') {
    //liveness endpoint
    ctx.status = 200;
  } else if (ctx.url === '/health/readiness') {
    // readiness endpoint
    try {
      const result = relay.eth().chainId();
      if (result.includes('0x12')) {
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
    return await next();
  }
});

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Unhandled Rejection at: Promise: ${JSON.stringify(p)}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception!');
});

export { app, httpApp };
