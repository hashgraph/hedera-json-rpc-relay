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
const JSON_RPC_ERROR = "JSON RPC ERROR";
const METHOD_NOT_FOUND = "METHOD NOT FOUND";
const REQUEST_ID_HEADER_NAME = "X-Request-Id";

const responseSuccessStatusCode = '200';

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
  private readonly requestIdIsOptional = process.env.REQUEST_ID_IS_OPTIONAL == 'true';

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
      let body, result;

      this.requestId = ctx.state.reqId;
      ctx.set(REQUEST_ID_HEADER_NAME, this.requestId);
      
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

      ctx.state.methodName = body.method;
      const methodName = body.method;

      if (
        body.jsonrpc !== '2.0' ||
        !hasOwnProperty(body, 'method') ||
        this.hasInvalidReqestId(body) ||
        !hasOwnProperty(body, 'id') ||
        ctx.request.method !== 'POST'
      ) {
        ctx.body = jsonResp(body.id || null, new InvalidRequest(), undefined);
        ctx.status = 400;
        ctx.state.status = `${ctx.status} (${INVALID_REQUEST})`;
        this.logger.warn(`[${this.getRequestId()}] Invalid request, body.jsonrpc: ${body.jsonrpc}, body[method]: ${body.method}, body[id]: ${body.id}, ctx.request.method: ${ctx.request.method}`);
        return;
      }

      if (!this.registry[body.method]) {
        ctx.body = jsonResp(body.id, new MethodNotFound(), undefined);
        ctx.status = 400;
        ctx.state.status = `${ctx.status} (${METHOD_NOT_FOUND})`;
        return;
      }

 
      const methodTotalLimit = this.registryTotal[methodName];
      if (this.rateLimit.shouldRateLimit(ctx.ip, methodName, methodTotalLimit, this.requestId)) {
        ctx.body = jsonResp(body.id, new IPRateLimitExceeded(methodName), undefined);
        ctx.status = 409;
        ctx.state.status = `${ctx.status} (${IP_RATE_LIMIT_EXCEEDED})`;
        return;
      }

      try {
        result = await this.registry[body.method](body.params);
        ctx.state.status = responseSuccessStatusCode;
      } catch (e: any) {
        if (e instanceof InvalidParamsError) {
          ctx.body = jsonResp(body.id, new InvalidParamsError(e.message), undefined);
          ctx.status = 400;
          ctx.state.status = `${ctx.status} (${INVALID_PARAMS_ERROR})`;
          return;
        }
        ctx.body = jsonResp(body.id, new InternalError(e.message), undefined);
        ctx.status = 500;
        ctx.state.status = `${ctx.status} (${INTERNAL_ERROR})`;
        return;
      }

      ctx.body = jsonResp(body.id, null, result);
      if (result instanceof JsonRpcError) {
        ctx.status = (result.code == -32603) ? 500 : 400;
        ctx.state.status = `${ctx.status} (${JSON_RPC_ERROR})`;
      }
    };
  }

  getKoaApp(): Koa<Koa.DefaultState, Koa.DefaultContext> {
    return this.koaApp;
  }

  getRequestId(): string {
    return this.requestId;
  }

  hasInvalidReqestId(body): boolean {
    const hasId = hasOwnProperty(body, 'id');
    if (this.requestIdIsOptional && !hasId)
    {          
      // If the request is invalid, we still want to return a valid JSON-RPC response, default id to 0
      body.id = '0';
      this.logger.warn(`[${this.getRequestId()}] Optional JSON-RPC 2.0 request id encountered. Will continue and default id to 0 in response`);
      return false;
    }

    return !hasId;
  }
}
