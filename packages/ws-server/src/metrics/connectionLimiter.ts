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

import { Logger } from 'pino';
import { WS_CONSTANTS } from '../utils/constants';
import { Gauge, Registry, Counter } from 'prom-client';
import { WebSocketError } from '@hashgraph/json-rpc-relay';

type IpCounter = {
  [key: string]: number;
};

const { CONNECTION_IP_LIMIT_EXCEEDED, TTL_EXPIRED, CONNECTION_LIMIT_EXCEEDED } = WebSocketError;

export default class ConnectionLimiter {
  private connectedClients: number;
  private clientIps: IpCounter;
  private logger: Logger;
  private activeConnectionsGauge: Gauge;
  private activeConnectionsGaugeByIP: Gauge;
  private ipConnectionLimitCounter: Counter;
  private connectionLimitCounter: Counter;
  private inactivityTTLCounter: Counter;
  private register: Registry;

  constructor(logger: Logger, register: Registry) {
    this.logger = logger;
    this.register = register;
    this.connectedClients = 0;
    this.clientIps = {};

    this.register.removeSingleMetric(WS_CONSTANTS.connLimiter.activeConnectionsMetric.name);
    this.activeConnectionsGauge = new Gauge({
      name: WS_CONSTANTS.connLimiter.activeConnectionsMetric.name,
      help: WS_CONSTANTS.connLimiter.activeConnectionsMetric.help,
      registers: [register],
    });

    this.register.removeSingleMetric(WS_CONSTANTS.connLimiter.ipConnectionsMetric.name);
    this.activeConnectionsGaugeByIP = new Gauge({
      name: WS_CONSTANTS.connLimiter.ipConnectionsMetric.name,
      help: WS_CONSTANTS.connLimiter.ipConnectionsMetric.help,
      labelNames: WS_CONSTANTS.connLimiter.ipConnectionsMetric.labelNames,
      registers: [register],
    });

    this.register.removeSingleMetric(WS_CONSTANTS.connLimiter.connectionLimitMetric.name);
    this.connectionLimitCounter = new Counter({
      name: WS_CONSTANTS.connLimiter.connectionLimitMetric.name,
      help: WS_CONSTANTS.connLimiter.connectionLimitMetric.help,
      registers: [register],
    });

    this.register.removeSingleMetric(WS_CONSTANTS.connLimiter.ipConnectionLimitMetric.name);
    this.ipConnectionLimitCounter = new Counter({
      name: WS_CONSTANTS.connLimiter.ipConnectionLimitMetric.name,
      help: WS_CONSTANTS.connLimiter.ipConnectionLimitMetric.help,
      labelNames: WS_CONSTANTS.connLimiter.ipConnectionLimitMetric.labelNames,
      registers: [register],
    });

    this.register.removeSingleMetric(WS_CONSTANTS.connLimiter.inactivityTTLLimitMetric.name);
    this.inactivityTTLCounter = new Counter({
      name: WS_CONSTANTS.connLimiter.inactivityTTLLimitMetric.name,
      help: WS_CONSTANTS.connLimiter.inactivityTTLLimitMetric.help,
      registers: [register],
    });
  }

  public incrementCounters(ctx) {
    const { ip } = ctx.request;

    this.connectedClients = ctx.app.server._connections;

    if (!this.clientIps[ip]) {
      this.clientIps[ip] = 1;
    } else {
      this.clientIps[ip]++;
    }
    ctx.websocket.ipCounted = true;

    ctx.websocket.subscriptions = 0;

    this.activeConnectionsGauge.set(this.connectedClients);
    this.activeConnectionsGaugeByIP.labels(ip).set(this.clientIps[ip]);
  }

  public decrementCounters(ctx) {
    if (ctx.websocket.ipCounted) {
      const { ip } = ctx.request;
      this.clientIps[ip]--;
      this.activeConnectionsGaugeByIP.labels(ip).set(this.clientIps[ip]);
      if (this.clientIps[ip] === 0) delete this.clientIps[ip];
    }
    this.connectedClients--;
    this.activeConnectionsGauge.set(this.connectedClients);
  }

  public applyLimits(ctx) {
    // Limit total connections
    const MAX_CONNECTION_LIMIT = process.env.WS_CONNECTION_LIMIT || '10';
    if (this.connectedClients > parseInt(MAX_CONNECTION_LIMIT)) {
      this.logger.info(
        `Closing connection ${ctx.websocket.id} due to exceeded maximum connections (max_con=${MAX_CONNECTION_LIMIT})`,
      );
      this.connectionLimitCounter.inc();
      ctx.websocket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          error: `Closing current connection due to exceeded maximum connections (max_con=${MAX_CONNECTION_LIMIT})`,
          id: '1',
        }),
      );
      ctx.websocket.close(CONNECTION_LIMIT_EXCEEDED.code, CONNECTION_LIMIT_EXCEEDED.message);
      return;
    }

    // Limit connections from a single IP address
    const { ip } = ctx.request;
    const MAX_CONNECTION_LIMIT_PER_IP = process.env.WS_CONNECTION_LIMIT_PER_IP || '10';
    if (this.clientIps[ip] && this.clientIps[ip] > parseInt(MAX_CONNECTION_LIMIT_PER_IP)) {
      this.logger.info(
        `Closing connection ${ctx.websocket.id} due to exceeded maximum connections from a single IP: address ${ip} - ${this.clientIps[ip]} connections. (max_con=${MAX_CONNECTION_LIMIT_PER_IP})`,
      );
      this.ipConnectionLimitCounter.labels(ip).inc();
      ctx.websocket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          error: `Closing current connection due to exceeded maximum connections from a single IP: address ${ip} - ${this.clientIps[ip]} connections. (max_con=${MAX_CONNECTION_LIMIT_PER_IP})`,
          id: '1',
        }),
      );
      ctx.websocket.close(CONNECTION_IP_LIMIT_EXCEEDED.code, CONNECTION_IP_LIMIT_EXCEEDED.message);
      return;
    }

    // Limit connection TTL and close connection when it is reached
    this.startInactivityTTLTimer(ctx.websocket);
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

  // Starts a timeout timer that closes the connection
  public startInactivityTTLTimer(websocket) {
    const maxInactivityTTL = parseInt(process.env.WS_MAX_INACTIVITY_TTL || '300000');
    websocket.inactivityTTL = setTimeout(() => {
      if (websocket.readyState !== 3) {
        // 3 = CLOSED, Avoid closing already closed connections
        this.logger.debug(`Closing connection ${websocket.id} due to reaching TTL (${maxInactivityTTL}ms)`);
        try {
          this.inactivityTTLCounter.inc();
          websocket.send(
            JSON.stringify({
              jsonrpc: '2.0',
              error: `Closing current connection due to reaching TTL (${maxInactivityTTL}ms)`,
              id: '1',
            }),
          );
          websocket.close(TTL_EXPIRED.code, TTL_EXPIRED.message);
        } catch (e) {
          this.logger.error(`${websocket.id}: ${e}`);
        }
      }
    }, maxInactivityTTL);
  }

  // Resets the inactivity TTL timer
  public resetInactivityTTLTimer(websocket) {
    if (websocket?.inactivityTTL) {
      clearTimeout(websocket.inactivityTTL);
    }

    this.startInactivityTTLTimer(websocket);
  }
}
