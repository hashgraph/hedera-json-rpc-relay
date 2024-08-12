/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import { expect } from 'chai';
import {
  JsonRpcError,
  ParseError,
  InvalidRequest,
  MethodNotFound,
  InvalidParams,
  InternalError,
  Unauthorized,
  ServerError,
  IPRateLimitExceeded,
  HBARRateLimitExceeded,
} from '../../../src/koaJsonRpc/lib/RpcError';

describe('RpcErrors', () => {
  describe('JsonRpcError', () => {
    it('should set the message, code, and data correctly', () => {
      const error = new JsonRpcError('Test message', -32000, { additional: 'data' });
      expect(error.message).to.equal('Test message');
      expect(error.code).to.equal(-32000);
      expect(error.data).to.deep.equal({ additional: 'data' });
    });

    it('should set data as undefined if not provided', () => {
      const error = new JsonRpcError('Test message', -32000);
      expect(error.message).to.equal('Test message');
      expect(error.code).to.equal(-32000);
      expect(error.data).to.be.undefined;
    });
  });

  describe('ParseError', () => {
    it('should create a ParseError with correct message and code', () => {
      const error = new ParseError();
      expect(error.message).to.equal('Parse error');
      expect(error.code).to.equal(-32700);
      expect(error.data).to.be.undefined;
    });
  });

  describe('InvalidRequest', () => {
    it('should create an InvalidRequest with correct message and code', () => {
      const error = new InvalidRequest();
      expect(error.message).to.equal('Invalid Request');
      expect(error.code).to.equal(-32600);
      expect(error.data).to.be.undefined;
    });
  });

  describe('MethodNotFound', () => {
    it('should create a MethodNotFound with correct message and code', () => {
      const methodName = 'testMethod';
      const error = new MethodNotFound(methodName);
      expect(error.message).to.equal(`Method ${methodName} not found`);
      expect(error.code).to.equal(-32601);
      expect(error.data).to.be.undefined;
    });
  });

  describe('InvalidParams', () => {
    it('should create an InvalidParams with correct message and code', () => {
      const error = new InvalidParams();
      expect(error.message).to.equal('Invalid params');
      expect(error.code).to.equal(-32602);
      expect(error.data).to.be.undefined;
    });
  });

  describe('InternalError', () => {
    it('should create an InternalError with provided error message and code', () => {
      const err = new Error('Specific internal error');
      const error = new InternalError(err);
      expect(error.message).to.equal('Specific internal error');
      expect(error.code).to.equal(-32603);
      expect(error.data).to.be.undefined;
    });

    it('should create an InternalError with default message when no error is provided', () => {
      const error = new InternalError(undefined);
      expect(error.message).to.equal('Internal error');
      expect(error.code).to.equal(-32603);
      expect(error.data).to.be.undefined;
    });
  });

  describe('Unauthorized', () => {
    it('should create an Unauthorized error with correct message and code', () => {
      const error = new Unauthorized();
      expect(error.message).to.equal('Unauthorized');
      expect(error.code).to.equal(-32604);
      expect(error.data).to.be.undefined;
    });
  });

  describe('ServerError', () => {
    it('should create a ServerError with correct message and code within valid range', () => {
      const error = new ServerError(-32000);
      expect(error.message).to.equal('Server error');
      expect(error.code).to.equal(-32000);
      expect(error.data).to.be.undefined;
    });

    it('should throw an error when creating a ServerError with an invalid code', () => {
      expect(() => new ServerError(-32100)).to.throw('Invalid error code');
      expect(() => new ServerError(-31999)).to.throw('Invalid error code');
    });
  });

  describe('IPRateLimitExceeded', () => {
    it('should create an IPRateLimitExceeded error with correct message and code', () => {
      const methodName = 'testMethod';
      const error = new IPRateLimitExceeded(methodName);
      expect(error.message).to.equal(`IP Rate limit exceeded on ${methodName}`);
      expect(error.code).to.equal(-32605);
      expect(error.data).to.be.undefined;
    });
  });

  describe('HBARRateLimitExceeded', () => {
    it('should create an HBARRateLimitExceeded error with correct message and code', () => {
      const error = new HBARRateLimitExceeded();
      expect(error.message).to.equal('HBAR Rate limit exceeded');
      expect(error.code).to.equal(-32606);
      expect(error.data).to.be.undefined;
    });
  });
});
