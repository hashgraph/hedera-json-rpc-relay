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
import {Histogram, Gauge, Registry, Counter} from "prom-client";

type IpCounter = {
    [key: string]: number;
};

const {CONNECTION_IP_LIMIT_EXCEEDED, TTL_EXPIRED, CONNECTION_LIMIT_EXCEEDED} = WebSocketError;

export default class ConnectionLimiter {
    private connectedClients: number;
    private clientIps: IpCounter;
    private logger: Logger;
    private activeConnectionsGauge: Gauge;
    private ipConnectionsGauge: Gauge;
    private ipConnectionLimitCounter: Counter;
    private connectionLimitCounter: Counter;
    private connectionTTLCounter: Counter;
    private register: Registry;

    constructor(logger: Logger, register: Registry) {
        this.logger = logger;
        this.register = register;
        this.connectedClients = 0;
        this.clientIps = {};

        const activeConnectionsMetric = 'rpc_websocket_active_connections';
        this.register.removeSingleMetric(activeConnectionsMetric);

        this.activeConnectionsGauge = new Gauge({
            name: activeConnectionsMetric,
            help: 'Relay websocket active connections',
            registers: [register]
        });

        const ipConnectionsMetric = 'rpc_websocket_active_connections_per_ip';
        this.register.removeSingleMetric(ipConnectionsMetric);
        this.ipConnectionsGauge = new Gauge({
            name: ipConnectionsMetric,
            help: 'Relay websocket active connections by ip',
            labelNames: ['ip'],
            registers: [register]
        });

        const connectionLimitMetric = 'rpc_websocket_total_connection_limit_enforced';
        this.register.removeSingleMetric(connectionLimitMetric);
        this.connectionLimitCounter = new Counter({
            name: connectionLimitMetric,
            help: 'Relay websocket total connection limits enforced',
            registers: [register]
        });

        const ipConnectionLimitMetric = 'rpc_websocket_total_connection_limit_by_ip_enforced';
        this.register.removeSingleMetric(ipConnectionLimitMetric);
        this.ipConnectionLimitCounter = new Counter({
            name: ipConnectionLimitMetric,
            help: 'Relay websocket total connection limits by ip enforced',
            labelNames: ['ip'],
            registers: [register]
        });

        const connectionTTLLimitMetric = 'rpc_websocket_total_connection_limit_by_ttl_enforced';
        this.register.removeSingleMetric(connectionTTLLimitMetric);
        this.connectionTTLCounter = new Counter({
            name: connectionTTLLimitMetric,
            help: 'Relay websocket total connection ttl limits enforced',
            registers: [register]
        });
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

        this.activeConnectionsGauge.set(this.connectedClients);
        this.ipConnectionsGauge.labels(ip).set(this.clientIps[ip]);
    }

    public decrementCounters(ctx) {
        if (ctx.websocket.ipCounted) {
            const {ip} = ctx.request;
            this.clientIps[ip]--;
            this.ipConnectionsGauge.labels(ip).set(this.clientIps[ip]);
            if (this.clientIps[ip] === 0) delete this.clientIps[ip];
        }
        this.connectedClients--;
        this.activeConnectionsGauge.set(this.connectedClients);
    }

    public applyLimits(ctx) {
        // Limit total connections
        if (this.connectedClients > parseInt(process.env.WS_CONNECTION_LIMIT || '10')) {
            this.logger.info(`Closing connection ${ctx.websocket.id} due to exceeded maximum connections (${process.env.WS_CONNECTION_LIMIT})`);
            this.connectionLimitCounter.inc();
            ctx.websocket.close(CONNECTION_LIMIT_EXCEEDED.code, CONNECTION_LIMIT_EXCEEDED.message);
            return;
        }

        const {ip} = ctx.request;

        // Limit connections from a single IP address
        const limitPerIp = parseInt(process.env.WS_CONNECTION_LIMIT_PER_IP || '10');
        if (this.clientIps[ip] && this.clientIps[ip] > limitPerIp) {
            this.logger.info(`Closing connection ${ctx.websocket.id} due to exceeded maximum connections from a single IP (${this.clientIps[ip]}) for address ${ip}`);
            this.ipConnectionLimitCounter.labels(ip).inc();
            ctx.websocket.close(CONNECTION_IP_LIMIT_EXCEEDED.code, CONNECTION_IP_LIMIT_EXCEEDED.message);
            return;
        }

        // Limit connection TTL and close connection if its reached
        const maxConnectionTTL = parseInt(process.env.WS_MAX_CONNECTION_TTL || '300000');
        setTimeout(() => {
            if (ctx.websocket.readyState !== 3) { // 3 = CLOSED, Avoid closing already closed connections
                this.logger.debug(`Closing connection ${ctx.websocket.id} due to reaching TTL of ${maxConnectionTTL}ms`);
                try {
                    this.connectionTTLCounter.inc();
                    ctx.websocket.close(TTL_EXPIRED.code, TTL_EXPIRED.message);
                } catch (e) {
                    this.logger.error(`${ctx.websocket.id}: ${e}`);
                }
            }
        }, maxConnectionTTL);
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
