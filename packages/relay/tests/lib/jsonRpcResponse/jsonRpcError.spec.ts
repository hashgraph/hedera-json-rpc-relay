// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';

import { JsonRpcError } from '../../../src/lib/jsonRpcResponse/jsonRpcError';

describe('JsonRpcError', () => {
  const testCases = [
    {
      name: 'should create an error with the specified code and message',
      code: -32600,
      message: 'Invalid request',
      data: undefined,
    },
    {
      name: 'should create an error with optional data',
      code: -32603,
      message: 'Internal error',
      data: 'Additional error details',
    },
    {
      name: 'should implement IJsonRpcError interface correctly',
      code: -32601,
      message: 'Method not found',
      data: undefined,
      additionalChecks: (error: JsonRpcError) => {
        // Verify the object structure matches the interface
        expect(error).to.haveOwnProperty('code');
        expect(error).to.haveOwnProperty('message');
        expect(typeof error.code).to.equal('number');
        expect(typeof error.message).to.equal('string');
      },
    },
  ];

  testCases.forEach(({ name, code, message, data, additionalChecks }) => {
    it(name, () => {
      const error = new JsonRpcError(code, message, data);

      expect(error.code).to.equal(code);
      expect(error.message).to.equal(message);

      if (data !== undefined) {
        expect(error.data).to.equal(data);
      } else {
        expect(error.data).to.be.undefined;
      }

      if (additionalChecks) {
        additionalChecks(error);
      }
    });
  });
});
