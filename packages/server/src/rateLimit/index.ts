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
import { formatRequestIdMessage } from '../formatters';
import { Counter, Registry } from 'prom-client';

export default class RateLimit {
  private duration: number;
  private database: any;
  private logger: Logger;
  private ipRateLimitCounter: Counter;

  constructor(logger: Logger, register: Registry, duration) {
    this.logger = logger;
    this.duration = duration;
    this.database = Object.create(null);

    const metricCounterName = 'rpc_relay_ip_rate_limit';
    register.removeSingleMetric(metricCounterName);
    this.ipRateLimitCounter = new Counter({
      name: metricCounterName,
      help: 'Relay ip rate limit counter',
      labelNames: ['methodName'],
      registers: [register],
    });
  }

  shouldRateLimit(ip: string, methodName: string, total: number, requestId: string): boolean {
    if (process.env.RATE_LIMIT_DISABLED && process.env.RATE_LIMIT_DISABLED === 'true') return false;
    this.precheck(ip, methodName, total);
    if (!this.shouldReset(ip)) {
      if (this.checkRemaining(ip, methodName)) {
        this.decreaseRemaining(ip, methodName);
        return false;
      }

      const requestIdPrefix = formatRequestIdMessage(requestId);
      this.logger.warn(
        `${requestIdPrefix}, Rate limit call to ${methodName}, ${this.database[ip].methodInfo[methodName].remaining} out of ${total} calls remaining`,
      );

      this.ipRateLimitCounter.labels(methodName).inc(1);

      return true;
    } else {
      this.reset(ip, methodName, total);
      this.decreaseRemaining(ip, methodName);
      return false;
    }
  }

  private precheck(ip: string, methodName: string, total: number) {
    if (!this.checkIpExist(ip)) {
      this.setNewIp(ip);
    }

    if (!this.checkMethodExist(ip, methodName)) {
      this.setNewMethod(ip, methodName, total);
    }
  }

  private setNewIp(ip: string) {
    const entry: DatabaseEntry = {
      reset: Date.now() + this.duration,
      methodInfo: {},
    };
    this.database[ip] = entry;
  }

  private setNewMethod(ip: string, methodName: string, total: number) {
    const entry: MethodDatabase = {
      methodName: methodName,
      remaining: total,
      total: total,
    };
    this.database[ip].methodInfo[methodName] = entry;
  }

  private checkIpExist(ip: string): boolean {
    return this.database[ip] !== undefined ? true : false;
  }

  private checkMethodExist(ip: string, method: string): boolean {
    return this.database[ip].methodInfo[method] !== undefined ? true : false;
  }

  private checkRemaining(ip: string, methodName: string): boolean {
    return this.database[ip].methodInfo[methodName].remaining > 0 ? true : false;
  }

  private shouldReset(ip: string): boolean {
    return this.database[ip].reset < Date.now() ? true : false;
  }

  private reset(ip: string, methodName: string, total: number) {
    this.database[ip].reset = Date.now() + this.duration;
    for (const [key] of Object.entries(this.database[ip].methodInfo)) {
      this.database[ip].methodInfo[key].remaining = this.database[ip].methodInfo[key].total;
    }
    this.database[ip].methodInfo[methodName].remaining = total;
  }

  private decreaseRemaining(ip: string, methodName: string) {
    const remaining =
      this.database[ip].methodInfo[methodName].remaining > 0
        ? this.database[ip].methodInfo[methodName].remaining - 1
        : 0;

    this.database[ip].methodInfo[methodName].remaining = remaining;
  }
}

interface DatabaseEntry {
  reset: number;
  methodInfo: any;
}

interface MethodDatabase {
  methodName: string;
  remaining: number;
  total: number;
}
