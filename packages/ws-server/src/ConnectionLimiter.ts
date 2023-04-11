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

import { Logger } from "pino";
import {WebSocketError} from "@hashgraph/json-rpc-relay";

type IpCounter = {
    [key: string]: number;
};

const IP_LIMIT_ERROR = WebSocketError.CONNECTION_IP_LIMIT_EXCEEDED;
const TTL_EXPIRED = WebSocketError.TTL_EXPIRED;

export default class ConnectionLimiter {
    private connectedClients: number;
    private clientIps: IpCounter;
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        this.connectedClients = 0;
        this.clientIps = {};
    }


    public incrementCounters(ctx) {
        const {ip} = ctx.request;

        this.connectedClients = ctx.app.server._connections;

        if (!this.clientIps[ip]) {
            this.clientIps[ip] = 1;
        }
        else {
            this.clientIps[ip]++;
        }
        ctx.websocket.ipCounted = true;

        ctx.websocket.subscriptions = 0;
    }

    public decrementCounters(ctx) {
        if (ctx.websocket.ipCounted) {
            const {ip} = ctx.request;
            this.clientIps[ip]--;
            if (this.clientIps[ip] === 0) delete this.clientIps[ip];
        }
        this.connectedClients--;
    }

    public applyLimits(ctx) {
        const {ip} = ctx.request;

        // Limit connections from a single IP address
        const limitPerIp = parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP || '10');
        if (this.clientIps[ip] && this.clientIps[ip] > limitPerIp) {
            this.logger.info(`Maximum allowed connections from a single IP (${this.clientIps[ip]}) exceeded for address ${ip}`);
            ctx.websocket.close(IP_LIMIT_ERROR.code, IP_LIMIT_ERROR.message);
            return;
        }

        // Limit connection TTL and close connection if its reached
        const maxConnectionTTL = parseInt(process.env.WS_MAX_CONNECTION_TTL || '300000');
        setTimeout(() => {
            if (ctx.websocket.readyState !== 3) { // 3 = CLOSED, Avoid closing already closed connections
                this.logger.debug(`Closing connection ${ctx.websocket.id} due to reaching TTL of ${maxConnectionTTL}ms`);
                try {
                    ctx.websocket.close(TTL_EXPIRED.code, TTL_EXPIRED.message);
                } catch (e) {
                    this.logger.error(`${ctx.websocket.id}: ${e}`);
                }
            }
        }, maxConnectionTTL);
    }

    public verifyClient(info, done) {
        if (this.connectedClients >= parseInt(process.env.CONNECTION_LIMIT || '10')) {
            return done(false, 429, 'Connection limit exceeded');
        }
        done(true);
    }

    public incrementSubs(ctx) {
        ctx.websocket.subscriptions++;
    }

    public decrementSubs(ctx, amount = 1) {
        ctx.websocket.subscriptions -= amount;
    }

    public validateSubscriptionLimit(ctx) {
        return ctx.websocket.subscriptions < parseInt(process.env.WS_SUBSCRIPTION_LIMIT || '10');
    }
}