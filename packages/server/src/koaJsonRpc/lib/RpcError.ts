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

export class JsonRpcError extends Error {
  code: any;
  data: any;
  constructor(message, code, data) {
    super();

    this.message = message;
    this.code = code;

    if (typeof data !== 'undefined') {
      this.data = data;
    }
  }
}

export class ParseError extends JsonRpcError {
  constructor() {
    super('Parse error', -32700, undefined);
  }
}

export class InvalidRequest extends JsonRpcError {
  constructor() {
    super('Invalid Request', -32600, undefined);
  }
}

export class MethodNotFound extends JsonRpcError {
  constructor() {
    super('Method not found', -32601, undefined);
  }
}

export class InvalidParams extends JsonRpcError {
  constructor() {
    super('Invalid params', -32602, undefined);
  }
}

export class InternalError extends JsonRpcError {
  constructor(err) {
    let message;
    if (err && err.message) {
      message = err.message;
    } else {
      message = 'Internal error';
    }
    super(message, -32603, undefined);
  }
}

export class Unauthorized extends JsonRpcError {
  constructor() {
    super('Unauthorized', -32604, undefined);
  }
}

export class ServerError extends JsonRpcError {
  constructor(code) {
    if (code < -32099 || code > -32000) {
      throw new Error('Invalid error code');
    }
    super('Server error', code, undefined);
  }
}

export class IPRateLimitExceeded extends JsonRpcError {
  constructor(methodName) {
    super(`IP Rate limit exceeded on ${methodName}`, -32605, undefined);
  }
}

export class HBARRateLimitExceeded extends JsonRpcError {
  constructor() {
    super('HBAR Rate limit exceeded', -32606, undefined);
  }
}