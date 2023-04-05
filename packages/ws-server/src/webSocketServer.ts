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

import Koa from 'koa';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import websockify from 'koa-websocket';
import {Relay, RelayImpl, predefined, JsonRpcError} from '@hashgraph/json-rpc-relay';
import { Registry } from 'prom-client';
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
const register = new Registry();
const relay: Relay = new RelayImpl(logger, register);
let connectedClients = 0;
const MAX_CONNECTIONS = parseInt(process.env.CONNECTION_LIMIT || '10');

const app = websockify(new Koa(), { 
        verifyClient: function(info, done) {
            if (connectedClients >= MAX_CONNECTIONS) {
                return done(false, 429, 'Connection limit exceeded');
            }
            done(true);
        }
});

const LOGGER_PREFIX = 'WebSocket:';

const CHAIN_ID = relay.eth().chainId();
const DEFAULT_ERROR = predefined.INTERNAL_ERROR();

// function to get max connection TTL from ENV variable
function getMaxConnectionTTL() {
    // 5 minutes in ms by default 5 * 60 * 1000 = 300000
    return parseInt(process.env.WS_MAX_CONNECTION_TTL || '300000');
}

app.ws.use((ctx) => {
    ctx.websocket.id = relay.subs()?.generateId();
    logger.info(`${LOGGER_PREFIX} new connection ${ctx.websocket.id}`);
    connectedClients = ctx.app.server._connections;
    // Limit connection TTL and close connection if its reached
    const maxConnectionTTL = getMaxConnectionTTL();
    setTimeout(() => {
        if (ctx.websocket.readyState !== 3) { // 3 = CLOSED, Avoid closing already closed connections
            logger.debug(`${LOGGER_PREFIX} closing connection ${ctx.websocket.id} due to reaching TTL of ${maxConnectionTTL}ms`);
            try {
                ctx.websocket.close();
            } catch (e) {
                logger.error(`${LOGGER_PREFIX} ${ctx.websocket.id} ${e}`);
            }
        }
    }, maxConnectionTTL);

    ctx.websocket.on('message', async (msg) => {
        ctx.websocket.id = relay.subs()?.generateId();
        let request;
        try {
            request = JSON.parse(msg.toString('ascii'));
        } catch (e) {
            logger.error(`${LOGGER_PREFIX} ${ctx.websocket.id} ${e}`);
            ctx.websocket.send(JSON.stringify(new JsonRpcError(predefined.INVALID_REQUEST, undefined)));
            return;
        }
        const {method, params} = request;
        let response;

        if (method === 'eth_subscribe') {
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

            response = jsonResp(request.id, null, subscriptionId);
        }
        else if (method === 'eth_unsubscribe') {
            const subId = params[0];
            logger.info(`${LOGGER_PREFIX} eth_unsubscribe ${subId} ${ctx.websocket.id}`);
            const result = relay.subs()?.unsubscribe(ctx.websocket, subId);
            response = jsonResp(request.id, null, result);
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

    ctx.websocket.on('error', console.error);

    ctx.websocket.on('close', function () {
        relay.subs()?.unsubscribe(ctx.websocket);
        console.log('stopping client interval');
        connectedClients--;
        ctx.websocket.terminate();
    });

});

export default app;
