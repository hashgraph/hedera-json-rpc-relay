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
import jsonResp from '../../../src/koaJsonRpc/lib/RpcResponse';

describe('jsonResp', () => {
  it('should return a valid JSON-RPC response with result', () => {
    const id = 1;
    const result = { key: 'value' };

    const response = jsonResp(id, null, result);

    expect(response).to.deep.equal({
      jsonrpc: '2.0',
      id: 1,
      result: { key: 'value' },
    });
  });

  it('should return a valid JSON-RPC response with error', () => {
    const id = 1;
    const error = { code: 123, message: 'An error occurred' };

    const response = jsonResp(id, error, undefined);

    expect(response).to.deep.equal({
      jsonrpc: '2.0',
      id: 1,
      error: { code: 123, message: 'An error occurred' },
    });
  });

  it('should throw an error when both error and result are provided', () => {
    const id = 1;
    const result = { key: 'value' };
    const error = { code: 123, message: 'An error occurred' };

    expect(() => jsonResp(id, error, result)).to.throw('Mutually exclusive error and result exist');
  });

  it('should throw a TypeError for invalid id type', () => {
    const id = {};
    const result = { key: 'value' };

    expect(() => jsonResp(id as any, null, result)).to.throw(TypeError, 'Invalid id type object');
  });

  it('should throw a TypeError for invalid error code type', () => {
    const id = 1;
    const error = { code: 'invalid_code', message: 'An error occurred' };

    expect(() => jsonResp(id, error as any, undefined)).to.throw(TypeError, 'Invalid error code type string');
  });

  it('should throw a TypeError for invalid error message type', () => {
    const id = 1;
    const error = { code: 123, message: 456 };

    expect(() => jsonResp(id, error as any, undefined)).to.throw(TypeError, 'Invalid error message type number');
  });

  it('should throw an error when neither result nor error is provided', () => {
    const id = 1;

    expect(() => jsonResp(id, null, undefined)).to.throw('Missing result or error');
  });

  it('should handle null id and return a valid response', () => {
    const id = null;
    const result = { key: 'value' };

    const response = jsonResp(id, null, result);

    expect(response).to.deep.equal({
      jsonrpc: '2.0',
      id: null,
      result: { key: 'value' },
    });
  });

  it('should handle string id and return a valid response', () => {
    const id = 'request-1';
    const result = { key: 'value' };

    const response = jsonResp(id, null, result);

    expect(response).to.deep.equal({
      jsonrpc: '2.0',
      id: 'request-1',
      result: { key: 'value' },
    });
  });
});
