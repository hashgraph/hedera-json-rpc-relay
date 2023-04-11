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
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Koa from 'koa';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import websockify from 'koa-websocket';
import {Relay, RelayImpl, predefined, JsonRpcError} from '@hashgraph/json-rpc-relay';
import { Registry } from 'prom-client';
import pino from 'pino';

import ConnectionLimiter from "./ConnectionLimiter";

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
const register = new Registry();
const relay: Relay = new RelayImpl(logger, register);
const limiter = new ConnectionLimiter(logger);

const app = websockify(new Koa(), {
    verifyClient: limiter.verifyClient
});

const CHAIN_ID = relay.eth().chainId();
const DEFAULT_ERROR = predefined.INTERNAL_ERROR();

async function handleConnectionClose(ctx) {
    relay.subs()?.unsubscribe(ctx.websocket);

    limiter.decrementCounters(ctx);

    ctx.websocket.terminate();
}

app.ws.use(async (ctx) => {
    ctx.websocket.id = relay.subs()?.generateId();
    logger.info(`New connection ${ctx.websocket.id}`);

    // Close event handle
    ctx.websocket.on('close', async (code, message) => {
        logger.info(`Closing connection ${ctx.websocket.id} | code: ${code}, message: ${message}`);
        await handleConnectionClose(ctx);
    });

    // Increment limit counters
    limiter.incrementCounters(ctx);

    // Limit checks
    limiter.applyLimits(ctx);

    ctx.websocket.on('message', async (msg) => {
        ctx.websocket.id = relay.subs()?.generateId();
        let request;
        try {
            request = JSON.parse(msg.toString('ascii'));
        } catch (e) {
            logger.error(`${ctx.websocket.id}: ${e}`);
            ctx.websocket.send(JSON.stringify(new JsonRpcError(predefined.INVALID_REQUEST, undefined)));
            return;
        }
        const {method, params} = request;
        let response;

        if (method === 'eth_subscribe') {
            if (limiter.validateSubscriptionLimit(ctx)) {
                const event = params[0];
                const filters = params[1];
                let subscriptionId;

                if (event === 'logs') {
                    subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, filters);
                }
                else if (event === 'newHeads') {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, null);
                }
                else if (event === 'newPendingTransactions') {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, null);
                }
                else {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, null);
                }

                limiter.incrementSubs(ctx);

                response = jsonResp(request.id, null, subscriptionId);
            }
            else {
                response = jsonResp(request.id, predefined.MAX_SUBSCRIPTIONS, undefined);
            }
        }
        else if (method === 'eth_unsubscribe') {
            const subId = params[0];
            logger.info(`eth_unsubscribe: ${subId} ${ctx.websocket.id}`);
            const unsubbedCount = relay.subs()?.unsubscribe(ctx.websocket, subId);
            const success = unsubbedCount !== 0;
            if (success) {
                limiter.decrementSubs(ctx, unsubbedCount);
            }

            response = jsonResp(request.id, null, success);
        }

        // Clients want to know the chainId after connecting
        else if (method === 'eth_chainId') {
            response = jsonResp(request.id, null, CHAIN_ID);
        }
        else {
            response = jsonResp(request.id, DEFAULT_ERROR, null);
        }

        ctx.websocket.send(JSON.stringify(response));
    });

});

export default app;