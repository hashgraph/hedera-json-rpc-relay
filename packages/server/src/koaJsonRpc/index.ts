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

import { methodConfiguration } from './lib/methodConfiguration';
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
  Unauthorized,
  JsonRpcError as JsonRpcErrorServer,
} from './lib/RpcError';
import Koa from 'koa';
import { Registry } from 'prom-client';
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';

const hasOwnProperty = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';

const INTERNAL_ERROR = 'INTERNAL ERROR';
const INVALID_PARAMS_ERROR = 'INVALID PARAMS ERROR';
const INVALID_REQUEST = 'INVALID REQUEST';
const IP_RATE_LIMIT_EXCEEDED = 'IP RATE LIMIT EXCEEDED';
const JSON_RPC_ERROR = 'JSON RPC ERROR';
const CONTRACT_REVERT = 'CONTRACT REVERT';
const METHOD_NOT_FOUND = 'METHOD NOT FOUND';
const REQUEST_ID_HEADER_NAME = 'X-Request-Id';

const responseSuccessStatusCode = '200';
const BATCH_REQUEST_METHOD_NAME = 'batch_request';

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
  private readonly requestIdIsOptional = process.env.REQUEST_ID_IS_OPTIONAL == 'true'; // default to false
  private readonly batchRequestsMaxSize: number = process.env.BATCH_REQUESTS_MAX_SIZE
    ? parseInt(process.env.BATCH_REQUESTS_MAX_SIZE)
    : 100; // default to 100

  constructor(logger: Logger, register: Registry, opts?) {
    this.koaApp = new Koa();
    this.requestId = '';
    this.limit = '1mb';
    this.duration = process.env.LIMIT_DURATION
      ? parseInt(process.env.LIMIT_DURATION)
      : constants.DEFAULT_RATE_LIMIT.DURATION;
    this.registry = Object.create(null);
    this.registryTotal = Object.create(null);
    this.methodConfig = methodConfiguration;
    if (opts) {
      this.limit = opts.limit || this.limit;
    }
    this.logger = logger;
    this.rateLimit = new RateLimit(logger.child({ name: 'ip-rate-limit' }), register, this.duration);
  }

  // we do it as a method so we can mock it in tests, since by default is false, but we need to test it as true
  private getBatchRequestsEnabled(): boolean {
    return process.env.BATCH_REQUESTS_ENABLED == 'true'; // default to false
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

      this.requestId = ctx.state.reqId;
      ctx.set(REQUEST_ID_HEADER_NAME, this.requestId);

      if (ctx.request.method !== 'POST') {
        ctx.body = jsonResp(null, new InvalidRequest(), undefined);
        ctx.status = 400;
        ctx.state.status = `${ctx.status} (${INVALID_REQUEST})`;
        return;
      }

      if (this.token) {
        const headerToken = ctx.get('authorization').split(' ').pop();
        if (headerToken !== this.token) {
          ctx.body = jsonResp(null, new Unauthorized(), undefined);
          return;
        }
      }

      let body: any;
      try {
        body = await parse.json(ctx, { limit: this.limit });
      } catch (err) {
        const errBody = jsonResp(null, new ParseError(), undefined);
        ctx.body = errBody;
        return;
      }

      //check if body is array or object
      if (Array.isArray(body)) {
        await this.handleMultipleRequest(ctx, body);
      } else {
        await this.handleSingleRequest(ctx, body);
      }
    };
  }

  private async handleSingleRequest(ctx, body: any): Promise<void> {
    ctx.state.methodName = body.method;
    const response = await this.getRequestResult(body, ctx.ip);
    ctx.body = response;
    const errorOrResult = response.error || response.result;
    if (errorOrResult instanceof JsonRpcError || errorOrResult instanceof JsonRpcErrorServer) {
      // What HTTP Status code to return for JsonRpcError
      switch (errorOrResult.code) {
        // INTERNAL_ERROR
        case -32603:
          ctx.status = 500;
          ctx.state.status = `${ctx.status} (${INTERNAL_ERROR})`;
          break;

        // CONTRACT_REVERT
        case -32008:
          ctx.status = 200;
          ctx.state.status = `${ctx.status} (${CONTRACT_REVERT})`;
          break;

        // INVALID_REQUEST
        case -32600:
          ctx.status = 400;
          ctx.state.status = `${ctx.status} (${INVALID_REQUEST})`;
          break;

        // INVALID_PARAMS
        case -32602:
          ctx.status = 400;
          ctx.state.status = `${ctx.status} (${INVALID_PARAMS_ERROR})`;
          break;

        // METHOD_NOT_FOUND
        case -32601:
          ctx.status = 400;
          ctx.state.status = `${ctx.status} (${METHOD_NOT_FOUND})`;
          break;

        // IP_RATE_LIMIT_EXCEEDED
        case -32605:
          ctx.status = 409;
          ctx.state.status = `${ctx.status} (${IP_RATE_LIMIT_EXCEEDED})`;
          break;

        // ANYTHING ELSE
        default:
          ctx.status = 400;
          ctx.state.status = `${ctx.status} (${JSON_RPC_ERROR})`;
          break;
      }
    }
  }

  private async handleMultipleRequest(ctx, body: any): Promise<void> {
    // verify that batch requests are enabled
    if (!this.getBatchRequestsEnabled()) {
      ctx.body = jsonResp(null, predefined.BATCH_REQUESTS_DISABLED, undefined);
      ctx.status = 400;
      ctx.state.status = `${ctx.status} (${INVALID_REQUEST})`;
      return;
    }

    // verify max batch size
    if (body.length > this.batchRequestsMaxSize) {
      ctx.body = jsonResp(
        null,
        predefined.BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED(body.length, this.batchRequestsMaxSize),
        undefined,
      );
      ctx.status = 400;
      ctx.state.status = `${ctx.status} (${INVALID_REQUEST})`;
      return;
    }

    // verify rate limit for batch request
    const batchRequestTotalLimit = this.registryTotal[BATCH_REQUEST_METHOD_NAME];
    // check rate limit for method and ip
    if (this.rateLimit.shouldRateLimit(ctx.ip, BATCH_REQUEST_METHOD_NAME, batchRequestTotalLimit, this.requestId)) {
      return jsonResp(null, new IPRateLimitExceeded(BATCH_REQUEST_METHOD_NAME), undefined);
    }

    const response: any[] = [];
    ctx.state.methodName = BATCH_REQUEST_METHOD_NAME;

    // we do the requests in parallel to save time, but we need to keep track of the order of the responses (since the id might be optional)
    const promises = body.map((item: any) => this.getRequestResult(item, ctx.ip));
    const results = await Promise.all(promises);
    response.push(...results);

    // for batch requests, always return 200 http status, this is standard for JSON-RPC 2.0 batch requests
    ctx.body = response;
    ctx.status = 200;
    ctx.state.status = responseSuccessStatusCode;
  }

  async getRequestResult(request: any, ip: any): Promise<any> {
    try {
      const methodName = request.method;

      // validate it has the correct jsonrpc version, method, and id
      if (!this.validateJsonRpcRequest(request)) {
        return jsonResp(request.id || null, new InvalidRequest(), undefined);
      }

      // validate the method exists
      if (!this.verifyMethodExists(methodName)) {
        return jsonResp(request.id, new MethodNotFound(methodName), undefined);
      }

      // check rate limit for method and ip
      const methodTotalLimit = this.registryTotal[methodName];
      if (this.rateLimit.shouldRateLimit(ip, methodName, methodTotalLimit, this.requestId)) {
        return jsonResp(request.id, new IPRateLimitExceeded(methodName), undefined);
      }

      // execute the method and return the result
      const result = await this.registry[methodName](request.params);

      if (result instanceof JsonRpcError) {
        return jsonResp(request.id, result, undefined);
      } else {
        return jsonResp(request.id, null, result);
      }
    } catch (err: any) {
      return jsonResp(request.id, new InternalError(err.message), undefined);
    }
  }

  validateJsonRpcRequest(body): boolean {
    // validate it has the correct jsonrpc version, method, and id
    if (
      body.jsonrpc !== '2.0' ||
      !hasOwnProperty(body, 'method') ||
      this.hasInvalidReqestId(body) ||
      !hasOwnProperty(body, 'id')
    ) {
      this.logger.warn(
        `[${this.getRequestId()}] Invalid request, body.jsonrpc: ${body.jsonrpc}, body[method]: ${
          body.method
        }, body[id]: ${body.id}, ctx.request.method: ${body.method}`,
      );
      return false;
    }

    return true;
  }

  verifyMethodExists(methodName: string): boolean {
    if (this.registry[methodName]) {
      return true;
    }

    this.logger.warn(`[${this.getRequestId()}] Method not found: ${methodName}`);
    return false;
  }

  getKoaApp(): Koa<Koa.DefaultState, Koa.DefaultContext> {
    return this.koaApp;
  }

  getRequestId(): string {
    return this.requestId;
  }

  hasInvalidReqestId(body): boolean {
    const hasId = hasOwnProperty(body, 'id');
    if (this.requestIdIsOptional && !hasId) {
      // If the request is invalid, we still want to return a valid JSON-RPC response, default id to 0
      body.id = '0';
      this.logger.warn(
        `[${this.getRequestId()}] Optional JSON-RPC 2.0 request id encountered. Will continue and default id to 0 in response`,
      );
      return false;
    }

    return !hasId;
  }
}
