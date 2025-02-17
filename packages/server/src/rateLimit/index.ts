// SPDX-License-Identifier: Apache-2.0

import { Logger } from 'pino';
import { formatRequestIdMessage } from '../formatters';
import { Counter, Registry } from 'prom-client';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

export default class RateLimit {
  private duration: number;
  private database: any;
  private logger: Logger;
  private ipRateLimitCounter: Counter;

  constructor(logger: Logger, register: Registry, duration: number) {
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
    if (ConfigService.get('RATE_LIMIT_DISABLED')) {
      return false;
    }

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
