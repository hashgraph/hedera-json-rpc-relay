// SPDX-License-Identifier: Apache-2.0

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
