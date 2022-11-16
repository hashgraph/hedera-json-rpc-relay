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
import RateLimit from '../ratelimit';
import parse from 'co-body';
import dotenv from 'dotenv';
import path from 'path';
import { Logger } from 'pino';
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

const hasOwnProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export default class KoaJsonRpc {
  private registry: any;
  private registryTotal: any;
  private token: any;
  private methodConfig: any;
  private duration: number;
  private limit: string;
  private ratelimit: RateLimit;
  private koaApp: Koa<Koa.DefaultState, Koa.DefaultContext>;

  constructor(logger: Logger, register: Registry, opts?) {
    this.koaApp = new Koa();
    this.limit = '1mb';
    this.duration = parseInt(process.env.LIMIT_DURATION!) || 60000;
    this.registry = Object.create(null);
    this.registryTotal = Object.create(null);
    this.methodConfig = methodConfiguration;
    if (opts) {
      this.limit = opts.limit || this.limit;
    }
    this.ratelimit = new RateLimit(logger.child({ name: 'ip-rate-limit' }), register, this.duration);
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
      let body, result;

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

      if (
        body.jsonrpc !== '2.0' ||
        !hasOwnProperty(body, 'method') ||
        !hasOwnProperty(body, 'id') ||
        ctx.request.method !== 'POST'
      ) {
        ctx.body = jsonResp(body.id || null, new InvalidRequest(), undefined);
        return;
      }

      if (!this.registry[body.method]) {
        ctx.body = jsonResp(body.id, new MethodNotFound(), undefined);
        return;
      }

      const methodName = body.method;
      const methodTotalLimit = this.registryTotal[methodName];
      if (this.ratelimit.shouldRateLimit(ctx.ip, methodName, methodTotalLimit)) {
        ctx.body = jsonResp(body.id, new IPRateLimitExceeded(methodName), undefined);
        return;
      }

      try {
        result = await this.registry[body.method](body.params);
      } catch (e: any) {
        if (e instanceof InvalidParamsError) {
          ctx.body = jsonResp(body.id, new InvalidParamsError(e.message), undefined);
          return;
        }
        ctx.body = jsonResp(body.id, new InternalError(e.message), undefined);
        return;
      }

      ctx.body = jsonResp(body.id, null, result);
    };
  }

  getKoaApp(): Koa<Koa.DefaultState, Koa.DefaultContext> {
    return this.koaApp;
  }
}
