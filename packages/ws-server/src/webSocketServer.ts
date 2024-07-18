/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { getRequestResult } from './controllers';
import { WS_CONSTANTS } from './utils/constants';
import { formatIdMessage } from './utils/formatters';
import WsMetricRegistry from './metrics/wsMetricRegistry';
import ConnectionLimiter from './metrics/connectionLimiter';
import KoaJsonRpc from '@hashgraph/json-rpc-server/dist/koaJsonRpc';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import { JsonRpcError, predefined, type Relay, RelayImpl } from '@hashgraph/json-rpc-relay';
import { getBatchRequestsMaxSize, getWsBatchRequestsEnabled, handleConnectionClose, sendToClient } from './utils/utils';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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

const pingInterval = Number(process.env.WS_PING_INTERVAL || 100000);

const app = websockify(new Koa());
app.ws.use(async (ctx) => {
  // Increment the total opened connections
  wsMetricRegistry.getCounter('totalOpenedConnections').inc();

  // Record the start time when the connection is established
  const startTime = process.hrtime();

  ctx.websocket.id = relay.subs()?.generateId();
  ctx.websocket.requestId = uuid();

  ctx.websocket.limiter = limiter;
  ctx.websocket.wsMetricRegistry = wsMetricRegistry;
  const connectionIdPrefix = formatIdMessage('Connection ID', ctx.websocket.id);
  const requestIdPrefix = formatIdMessage('Request ID', ctx.websocket.requestId);
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
      logger.warn(
        `${connectionIdPrefix} ${requestIdPrefix}: Could not decode message from connection, message: ${msg}, error: ${e}`,
      );
      ctx.websocket.send(JSON.stringify(new JsonRpcError(predefined.INVALID_REQUEST, undefined)));
      return;
    }

    // check if request is a batch request (array) or a signle request (JSON)
    if (Array.isArray(request)) {
      logger.trace(`${connectionIdPrefix} ${requestIdPrefix}: Receive batch request=${JSON.stringify(request)}`);

      // Increment metrics for batch_requests
      wsMetricRegistry.getCounter('methodsCounter').labels(WS_CONSTANTS.BATCH_REQUEST_METHOD_NAME).inc();
      wsMetricRegistry
        .getCounter('methodsCounterByIp')
        .labels(ctx.request.ip, WS_CONSTANTS.BATCH_REQUEST_METHOD_NAME)
        .inc();

      // send error if batch request feature is not enabled
      if (!getWsBatchRequestsEnabled()) {
        const batchRequestDisabledError = predefined.WS_BATCH_REQUESTS_DISABLED;
        logger.warn(`${connectionIdPrefix} ${requestIdPrefix}: ${JSON.stringify(batchRequestDisabledError)}`);
        ctx.websocket.send(JSON.stringify([jsonResp(null, batchRequestDisabledError, undefined)]));
        return;
      }

      // send error if batch request exceed max batch size
      if (request.length > getBatchRequestsMaxSize()) {
        const batchRequestAmountMaxExceed = predefined.BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED(
          request.length,
          getBatchRequestsMaxSize(),
        );
        logger.warn(`${connectionIdPrefix} ${requestIdPrefix}: ${JSON.stringify(batchRequestAmountMaxExceed)}`);
        ctx.websocket.send(JSON.stringify([jsonResp(null, batchRequestAmountMaxExceed, undefined)]));
        return;
      }

      // process requests
      const requestPromises = request.map((item: any) => {
        return getRequestResult(
          ctx,
          relay,
          logger,
          item,
          limiter,
          requestIdPrefix,
          connectionIdPrefix,
          mirrorNodeClient,
          wsMetricRegistry,
        );
      });

      // resolve all promises
      const responses = await Promise.all(requestPromises);

      // send to client
      sendToClient(ctx.websocket, request, responses, logger, requestIdPrefix, connectionIdPrefix);
    } else {
      logger.trace(`${connectionIdPrefix} ${requestIdPrefix}: Receive single request=${JSON.stringify(request)}`);

      // process requests
      const response = await getRequestResult(
        ctx,
        relay,
        logger,
        request,
        limiter,
        requestIdPrefix,
        connectionIdPrefix,
        mirrorNodeClient,
        wsMetricRegistry,
      );

      // send to client
      sendToClient(ctx.websocket, request, response, logger, requestIdPrefix, connectionIdPrefix);
    }

    // Calculate the duration of the connection
    const msgEndTime = process.hrtime(msgStartTime);
    const msgDurationInMiliSeconds = (msgEndTime[0] + msgEndTime[1] / 1e9) * 1000; // Convert duration to miliseconds

    // Update the connection duration histogram with the calculated duration
    const methodLabel = Array.isArray(request) ? WS_CONSTANTS.BATCH_REQUEST_METHOD_NAME : request.method;
    wsMetricRegistry.getHistogram('messageDuration').labels(methodLabel).observe(msgDurationInMiliSeconds);
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
