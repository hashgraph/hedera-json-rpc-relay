/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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
import dotenv from 'dotenv';
import path from 'path';

import Koa from 'koa';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import KoaJsonRpc from '@hashgraph/json-rpc-server/dist/koaJsonRpc';
import websockify from 'koa-websocket';
import { type Relay, RelayImpl, predefined, JsonRpcError } from '@hashgraph/json-rpc-relay';
import { Registry, Counter } from 'prom-client';
import pino from 'pino';

import ConnectionLimiter from './ConnectionLimiter';
import { formatRequestIdMessage } from '@hashgraph/json-rpc-relay/dist/formatters';
import { EthSubscribeLogsParamsObject } from '@hashgraph/json-rpc-server/dist/validator';
import { v4 as uuid } from 'uuid';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { log } from 'console';
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

const pingInterval = Number(process.env.WS_PING_INTERVAL || 1000);

const logger = mainLogger.child({ name: 'rpc-ws-server' });
const register = new Registry();
const relay: Relay = new RelayImpl(logger, register);
const limiter = new ConnectionLimiter(logger, register);
const mirrorNodeClient = relay.mirrorClient();

const app = websockify(new Koa());

const CHAIN_ID = relay.eth().chainId();
const DEFAULT_ERROR = predefined.INTERNAL_ERROR();

const methodsCounterName = 'rpc_websocket_method_counter';
register.removeSingleMetric(methodsCounterName);
const methodsCounter = new Counter({
  name: 'rpc_websocket_method_counter',
  help: 'Relay websocket total methods called',
  labelNames: ['method'],
  registers: [register],
});

const methodsCounterByIpName = 'rpc_websocket_method_by_ip_counter';
register.removeSingleMetric(methodsCounterByIpName);
const methodsCounterByIp = new Counter({
  name: methodsCounterByIpName,
  help: 'Relay websocket methods called by ip',
  labelNames: ['ip', 'method'],
  registers: [register],
});

async function handleConnectionClose(ctx) {
  relay.subs()?.unsubscribe(ctx.websocket);

  limiter.decrementCounters(ctx);

  ctx.websocket.terminate();
}

function getMultipleAddressesEnabled() {
  return process.env.WS_MULTIPLE_ADDRESSES_ENABLED === 'true';
}

async function validateIsContractOrTokenAddress(address, requestId) {
  const isContractOrToken = await mirrorNodeClient.resolveEntityType(
    address,
    [constants.TYPE_CONTRACT, constants.TYPE_TOKEN],
    constants.METHODS.ETH_SUBSCRIBE,
    requestId,
  );
  if (!isContractOrToken) {
    throw new JsonRpcError(
      predefined.INVALID_PARAMETER(
        'filters.address',
        `${address} is not a valid contract or token type or does not exists`,
      ),
      requestId,
    );
  }
}

async function validateSubscribeEthLogsParams(filters: any, requestId: string) {
  // validate address exists and is correct lengh and type
  // validate topics if exists and is array and each one is correct lengh and type
  const paramsObject = new EthSubscribeLogsParamsObject(filters);
  paramsObject.validate();

  // validate address or addresses are an existing smart contract
  if (paramsObject.address) {
    if (Array.isArray(paramsObject.address)) {
      for (const address of paramsObject.address) {
        await validateIsContractOrTokenAddress(address, requestId);
      }
    } else {
      await validateIsContractOrTokenAddress(paramsObject.address, requestId);
    }
  }
}

app.ws.use(async (ctx) => {
  ctx.websocket.id = relay.subs()?.generateId();
  ctx.websocket.limiter = limiter;
  const connectionIdPrefix = formatConnectionIdMessage(ctx.websocket.id);
  const connectionRequestIdPrefix = formatRequestIdMessage(uuid());
  logger.info(
    `${connectionIdPrefix} ${connectionRequestIdPrefix} New connection established. Current active connections: ${ctx.app.server._connections}`,
  );

  // Close event handle
  ctx.websocket.on('close', async (code, message) => {
    logger.info(
      `${connectionIdPrefix} ${connectionRequestIdPrefix} Closing connection ${ctx.websocket.id} | code: ${code}, message: ${message}`,
    );
    await handleConnectionClose(ctx);
  });

  // Increment limit counters
  limiter.incrementCounters(ctx);

  // Limit checks
  limiter.applyLimits(ctx);

  ctx.websocket.on('message', async (msg) => {
    // Receiving a message from the client resets the TTL timer
    limiter.resetInactivityTTLTimer(ctx.websocket);
    const requestIdPrefix = formatRequestIdMessage(uuid());
    let request;
    try {
      request = JSON.parse(msg.toString('ascii'));
    } catch (e) {
      logger.error(
        `${connectionIdPrefix} ${requestIdPrefix} ${ctx.websocket.id}: Could not decode message from connection, message: ${msg}, error: ${e}`,
      );
      ctx.websocket.send(JSON.stringify(new JsonRpcError(predefined.INVALID_REQUEST, undefined)));
      return;
    }
    const { method, params } = request;
    let response;

    logger.debug(
      `${connectionIdPrefix} ${requestIdPrefix} Received message from ${
        ctx.websocket.id
      }. Method: ${method}. Params: ${JSON.stringify(params)}`,
    );

    methodsCounter.labels(method).inc();
    methodsCounterByIp.labels(ctx.request.ip, method).inc();

    // Early return if subscription limit is exceeded
    if (method === constants.METHODS.ETH_SUBSCRIBE && !limiter.validateSubscriptionLimit(ctx)) {
      response = jsonResp(request.id, predefined.MAX_SUBSCRIPTIONS, undefined);
      ctx.websocket.send(JSON.stringify(response));
      return;
    }

    try {
      switch (method) {
        case constants.METHODS.ETH_SUBSCRIBE: {
          const event = params[0];
          const filters = params[1];
          let subscriptionId;

          switch (event) {
            case constants.SUBSCRIBE_EVENTS.LOGS:
              ({ response, subscriptionId } = await handleEthSubscribeLogs(
                filters,
                requestIdPrefix,
                response,
                request,
                subscriptionId,
                ctx,
                event,
              ));
              break;

            case constants.SUBSCRIBE_EVENTS.NEW_HEADS:
              ({ response, subscriptionId } = handleEthSubscribeNewHeads(
                response,
                subscriptionId,
                filters,
                request,
                ctx,
                event,
              ));
              break;
            case constants.SUBSCRIBE_EVENTS.NEW_PENDING_TRANSACTIONS:
              response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
              break;

            default:
              response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
          }

          limiter.incrementSubs(ctx);
          response = response ?? (subscriptionId ? jsonResp(request.id, null, subscriptionId) : undefined);
          break;
        }
        case constants.METHODS.ETH_UNSUBSCRIBE: {
          const subId = params[0];
          const unsubbedCount = relay.subs()?.unsubscribe(ctx.websocket, subId);
          limiter.decrementSubs(ctx, unsubbedCount);
          response = jsonResp(request.id, null, unsubbedCount !== 0);
          break;
        }
        case constants.METHODS.ETH_CHAIN_ID:
          response = jsonResp(request.id, null, CHAIN_ID);
          break;
        default:
          response = jsonResp(request.id, DEFAULT_ERROR, null);
      }
    } catch (error) {
      logger.error(
        error,
        `${connectionIdPrefix} ${requestIdPrefix} Encountered error on ${
          ctx.websocket.id
        }, method: ${method}, params: ${JSON.stringify(params)}`,
      );
      response = jsonResp(request.id, error, undefined);
    }

    if (response) {
      ctx.websocket.send(JSON.stringify(response));
    }
  });

  if (pingInterval > 0) {
    setInterval(async () => {
      ctx.websocket.send(JSON.stringify(jsonResp(null, null, null)));
    }, pingInterval);
  }
});

const httpApp = new KoaJsonRpc(logger, register).getKoaApp();

httpApp.use(async (ctx, next) => {
  /**
   * prometheus metrics exposure
   */
  if (ctx.url === '/metrics') {
    ctx.status = 200;
    ctx.body = await register.metrics();
  } else if (ctx.url === '/health/liveness') {
    /**
     * liveness endpoint
     */
    ctx.status = 200;
  } else if (ctx.url === '/health/readiness') {
    /**
     * readiness endpoint
     */
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

const formatConnectionIdMessage = (connectionId?: string): string => {
  return connectionId ? `[Connection ID: ${connectionId}]` : '';
};

process.on('unhandledRejection', (reason, p) => {
  logger.error(`Unhandled Rejection at: Promise: ${JSON.stringify(p)}, reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception!');
});

export { app, httpApp };
function handleEthSubscribeNewHeads(
  response: any,
  subscriptionId: any,
  filters: any,
  request: any,
  ctx: any,
  event: any,
) {
  if (process.env.WS_NEW_HEADS_ENABLED === 'true') {
    ({ response, subscriptionId } = subscribeToNewHeads(filters, response, request, subscriptionId, ctx, event));
  } else {
    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
  }
  return { response, subscriptionId };
}

async function handleEthSubscribeLogs(
  filters: any,
  requestIdPrefix: string,
  response: any,
  request: any,
  subscriptionId: any,
  ctx: any,
  event: any,
) {
  await validateSubscribeEthLogsParams(filters, requestIdPrefix);
  if (!getMultipleAddressesEnabled() && Array.isArray(filters.address) && filters.address.length > 1) {
    response = jsonResp(
      request.id,
      predefined.INVALID_PARAMETER('filters.address', 'Only one contract address is allowed'),
      undefined,
    );
  } else {
    subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, filters);
  }
  return { response, subscriptionId };
}

function subscribeToNewHeads(filters: any, response: any, request: any, subscriptionId: any, ctx: any, event: any) {
  if (filters !== undefined) {
    response = jsonResp(
      request.id,
      predefined.INVALID_PARAMETER('filters', 'Filters should be undefined for newHeads event'),
      undefined,
    );
  }
  subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, 'newHeads');
  logger.info(`Subscribed to newHeads, subscriptionId: ${subscriptionId}`);
  return { response, subscriptionId };
}
