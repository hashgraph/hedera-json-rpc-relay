/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import { methodConfiguration } from './lib/methodConfiguration';
import InvalidParamsError from './lib/RpcInvalidError';
import jsonResp from './lib/RpcResponse';
import RateLimit from '../rateLimit';
import parse from 'co-body';
import dotenv from 'dotenv';
import path from 'path';
import { Logger } from 'pino';
import { formatRequestIdMessage } from '../formatters';

import {
  ParseError,
  InvalidRequest,
  InternalError,
  IPRateLimitExceeded,
  MethodNotFound,
  Unauthorized
} from './lib/RpcError';
import Koa from 'koa';
import { Registry } from 'prom-client';
import { JsonRpcError } from '@hashgraph/json-rpc-relay';

const hasOwnProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import constants from "@hashgraph/json-rpc-relay/dist/lib/constants";

const INTERNAL_ERROR = "INTERNAL ERROR";
const INVALID_PARAMS_ERROR = "INVALID PARAMS ERROR";
const INVALID_REQUEST = "INVALID REQUEST";
const IP_RATE_LIMIT_EXCEEDED = "IP RATE LIMIT EXCEEDED";
const JSON_RPC_ERROR = "JSON RPC ERROR"
const METHOD_NOT_FOUND = "METHOD NOT FOUND";

export default class KoaJsonRpc {
  private registry: any;
  private registryTotal: any;
  private token: any;
  private methodConfig: any;
  private duration: number;
  private limit: string;
  private rateLimit: RateLimit;
  private koaApp: Koa<Koa.DefaultState, Koa.DefaultContext>;
  private requestId: string;
  private logger: Logger;
  private startTimestamp!: number;

  constructor(logger: Logger, register: Registry, opts?) {
    this.koaApp = new Koa();
    this.requestId = '';
    this.limit = '1mb';
    this.duration = process.env.LIMIT_DURATION ? parseInt(process.env.LIMIT_DURATION) : constants.DEFAULT_RATE_LIMIT.DURATION;
    this.registry = Object.create(null);
    this.registryTotal = Object.create(null);
    this.methodConfig = methodConfiguration;
    if (opts) {
      this.limit = opts.limit || this.limit;
    }
    this.logger = logger;
    this.rateLimit = new RateLimit(logger.child({ name: 'ip-rate-limit' }), register, this.duration);
  }

  useRpc(name, func) {
    this.registry[name] = func;
    this.registryTotal[name] = this.methodConfig[name].total;

    if (!this.registryTotal[name]) {
      this.registryTotal[name] = process.env.DEFAULT_RATE_LIMIT || 200;
    }
  }

  rpcApp() {
    return async (ctx, next) => {
      this.startTimestamp = ctx.state.start;
      let body, ms, result;

      this.requestId = ctx.state.reqId;
      const requestIdPrefix =  formatRequestIdMessage(this.requestId);
      
      if (this.token) {
        const headerToken = ctx.get('authorization').split(' ').pop();
        if (headerToken !== this.token) {
          ctx.body = jsonResp(null, new Unauthorized(), undefined);
          return;
        }
      }

      try {
        body = await parse.json(ctx, { limit: this.limit });
      } catch (err) {
        const errBody = jsonResp(null, new ParseError(), undefined);
        ctx.body = errBody;
        return;
      }

      const methodName = body.method;
      const messagePrefix = `${requestIdPrefix} [POST] ${methodName}:`;

      if (
        body.jsonrpc !== '2.0' ||
        !hasOwnProperty(body, 'method') ||
        !hasOwnProperty(body, 'id') ||
        ctx.request.method !== 'POST'
      ) {
        ctx.body = jsonResp(body.id || null, new InvalidRequest(), undefined);
        ctx.status = 400;
        ms = Date.now() - this.startTimestamp;
        this.logger.error(`${messagePrefix} ${ctx.status} (${INVALID_REQUEST}) ${ms} ms`);
        return;
      }

      if (!this.registry[body.method]) {
        ctx.body = jsonResp(body.id, new MethodNotFound(), undefined);
        ctx.status = 400;
        ms = Date.now() - this.startTimestamp;
        this.logger.error(`${messagePrefix} ${ctx.status} (${METHOD_NOT_FOUND}) ${ms} ms`);
        return;
      }

 
      const methodTotalLimit = this.registryTotal[methodName];
      if (this.rateLimit.shouldRateLimit(ctx.ip, methodName, methodTotalLimit, this.requestId)) {
        ctx.body = jsonResp(body.id, new IPRateLimitExceeded(methodName), undefined);
        ctx.status = 409;
        ms = Date.now() - this.startTimestamp;
        this.logger.warn(`${messagePrefix} ${ctx.status} (${IP_RATE_LIMIT_EXCEEDED}) ${ms} ms`);
        return;
      }

      try {
        result = await this.registry[body.method](body.params);
      } catch (e: any) {
        if (e instanceof InvalidParamsError) {
          ctx.body = jsonResp(body.id, new InvalidParamsError(e.message), undefined);
          ctx.status = 400;
          ms = Date.now() - this.startTimestamp;
          this.logger.error(`${messagePrefix} ${ctx.status} (${INVALID_PARAMS_ERROR}) ${ms} ms`);
          return;
        }
        ctx.body = jsonResp(body.id, new InternalError(e.message), undefined);
        ctx.status = 500;
        ms = Date.now() - this.startTimestamp;
        this.logger.error(`${messagePrefix} ${ctx.status} (${INTERNAL_ERROR}) ${ms} ms`);
        return;
      }

      ctx.body = jsonResp(body.id, null, result);
      if (result instanceof JsonRpcError) {
        ctx.status = (result.code == -32603) ? 500 : 400;
        ms = Date.now() - this.startTimestamp;
        this.logger.error(`${messagePrefix} ${ctx.status} (${result.code}) (${JSON_RPC_ERROR}) ${ms} ms`);
      }
    };
  }

  getKoaApp(): Koa<Koa.DefaultState, Koa.DefaultContext> {
    return this.koaApp;
  }

  getRequestId(): string {
    return this.requestId;
  }

  getStartTimestamp(): number {
    return this.startTimestamp;
  }
}
