// SPDX-License-Identifier: Apache-2.0

import { JsonRpcError } from '@hashgraph/json-rpc-relay';
import { IJsonRpcResponse } from './IJsonRpcResponse';

export default function jsonResp(
  id: string | number | null,
  error: JsonRpcError | null,
  result: any,
): IJsonRpcResponse {
  const response: IJsonRpcResponse = {} as IJsonRpcResponse;

  if (error && result) {
    throw new Error('Mutually exclusive error and result exist');
  }

  if (id !== null && typeof id !== 'string' && typeof id !== 'number') {
    throw new TypeError(`Invalid id type ${typeof id}`);
  }

  if (typeof result !== 'undefined') {
    response.result = result;
  } else if (error) {
    if (typeof error.code !== 'number') {
      throw new TypeError(`Invalid error code type ${typeof error.code}`);
    }

    if (typeof error.message !== 'string') {
      throw new TypeError(`Invalid error message type ${typeof error.message}`);
    }

    response.error = error;
  } else {
    throw new Error('Missing result or error');
  }

  response.jsonrpc = '2.0';
  response.id = id;
  return response;
}
