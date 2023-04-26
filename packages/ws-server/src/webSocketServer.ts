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
import constants from "@hashgraph/json-rpc-relay/dist/lib/constants";
import {MirrorNodeClient} from "@hashgraph/json-rpc-relay/dist/lib/clients";
import {EthSubscribeLogsParamsObject} from "@hashgraph/json-rpc-server/dist/validator";
import KoaJsonRpc from "@hashgraph/json-rpc-server/dist/koaJsonRpc";

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
const limiter = new ConnectionLimiter(logger, register);
const mirrorNodeClient = new MirrorNodeClient(
    process.env.MIRROR_NODE_URL || '',
    logger.child({ name: `mirror-node` }),
    register,
    undefined,
    process.env.MIRROR_NODE_URL_WEB3 || process.env.MIRROR_NODE_URL || '',
);

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

function getMultipleAddressesEnabled() {
    return process.env.WS_MULTIPLE_ADDRESSES_ENABLED === 'true';
}

async function validateIsContractAddress(address, requestId) {
    const isContract = await mirrorNodeClient.resolveEntityType(address, requestId, [constants.TYPE_CONTRACT]);
    if (!isContract) {
        throw new JsonRpcError(predefined.INVALID_PARAMETER(`filters.address`, `${address} is not a valid contract type or does not exists`), requestId);
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
                await validateIsContractAddress(address, requestId);
            }
        } else {
            await validateIsContractAddress(paramsObject.address, requestId);
        }
    }
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
                    try {
                        await validateSubscribeEthLogsParams(filters, request.id);
                    } catch (error) {
                        response = jsonResp(request.id, error, undefined);
                        ctx.websocket.send(JSON.stringify(response));
                        return;
                    }

                    if(!getMultipleAddressesEnabled() && Array.isArray(filters.address) && filters.address.length > 1) {
                        response = jsonResp(request.id, predefined.INVALID_PARAMETER("filters.address", 'Only one contract address is allowed'), undefined);
                    } else {
                        subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, filters);
                    }
                }
                else if (event === 'newHeads') {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
                }
                else if (event === 'newPendingTransactions') {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
                }
                else {
                    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
                }

                limiter.incrementSubs(ctx);

                if(subscriptionId) {
                    response = jsonResp(request.id, null, subscriptionId);
                }
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

const httpApp = (new KoaJsonRpc(logger, register)).getKoaApp();

httpApp.use(async (ctx, next) => {
    /**
     * prometheus metrics exposure
     */
    if (ctx.url === '/metrics') {
        ctx.status = 200;
        ctx.body = await register.metrics();
    }

    /**
     * liveness endpoint
     */
    else if (ctx.url === '/health/liveness') {
        ctx.status = 200;
    }

    /**
     * readiness endpoint
     */
    else if (ctx.url === '/health/readiness') {
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
    }
    else {
        return next();
    }
});

export {
    app,
    httpApp
};
