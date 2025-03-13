// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';

import { JsonRpcError } from '../../../src/lib/jsonRpcResponse/jsonRpcError';
import { JsonRpcResponse } from '../../../src/lib/jsonRpcResponse/jsonRpcResponse';

describe('JsonRpcResponse', () => {
  const testIds = {
    string: '123',
    number: 456,
    null: null,
  };

  const testData = {
    result: { value: 42 },
    error: new JsonRpcError(-32600, 'Invalid request'),
  };

  function validateResponse(response: JsonRpcResponse, id: any, result?: any, error?: JsonRpcError) {
    expect(response.jsonrpc).to.equal('2.0');
    expect(response.id).to.equal(id);

    if (result !== undefined) {
      expect((response as any).result).to.equal(result);
      expect((response as any).error).to.be.undefined;
    } else if (error !== undefined) {
      expect((response as any).error).to.equal(error);
      expect((response as any).result).to.be.undefined;
    }
  }

  it('should create a success response with result', () => {
    const response = new JsonRpcResponse(testIds.string, testData.result);
    validateResponse(response, testIds.string, testData.result);
  });

  it('should create an error response', () => {
    const response = new JsonRpcResponse(testIds.number, undefined, testData.error);
    validateResponse(response, testIds.number, undefined, testData.error);
  });

  it('should throw error when both result and error are provided', () => {
    expect(() => {
      new JsonRpcResponse(testIds.string, testData.result, testData.error);
    }).to.throw('JSON-RPC response cannot have both result and error');
  });

  it('should throw error when neither result nor error is provided', () => {
    expect(() => {
      new JsonRpcResponse(testIds.string);
    }).to.throw('JSON-RPC response must have either result or error');
  });

  it('should create a success response using static factory method', () => {
    const customResult = { data: 'success-data' };
    const response = JsonRpcResponse.success('success-id', customResult);
    validateResponse(response, 'success-id', customResult);
  });

  it('should create an error response using static factory method', () => {
    const customError = new JsonRpcError(-32601, 'Method not found');
    const response = JsonRpcResponse.error('error-id', customError);
    validateResponse(response, 'error-id', undefined, customError);
  });

  it('should accept null as a valid id', () => {
    const response = new JsonRpcResponse(testIds.null, testData.result);
    validateResponse(response, testIds.null, testData.result);
  });

  it('should ensure error property is not present in success response', () => {
    const response = new JsonRpcResponse(testIds.string, testData.result);
    expect(response).to.have.property('result');
    expect(response).to.not.have.property('error');
  });

  it('should ensure result property is not present in error response', () => {
    const response = new JsonRpcResponse(testIds.string, undefined, testData.error);
    expect(response).to.have.property('error');
    expect(response).to.not.have.property('result');
  });
});
