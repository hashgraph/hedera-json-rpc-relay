// SPDX-License-Identifier: Apache-2.0

import { IJsonRpcError, IJsonRpcResponse } from './interfaces';

/**
 * Represents a JSON-RPC 2.0 response object as defined by the specification.
 * Either result or error must be present, but not both.
 */
export class JsonRpcResponse implements IJsonRpcResponse {
  /**
   * A String specifying the version of the JSON-RPC protocol.
   * MUST be exactly "2.0".
   */
  public readonly jsonrpc: string = '2.0';

  /**
   * Creates a new JSON-RPC 2.0 response.
   *
   * @param id An identifier established by the Client that MUST contain a String, Number, or NULL value if included.
   * @param result This member is REQUIRED on success. This member MUST NOT exist if there was an error invoking the method.
   * @param error This member is REQUIRED on error. This member MUST NOT exist if there was no error triggered during invocation.
   * @throws Error if both result and error are provided or neither is provided
   */
  constructor(
    public readonly id: string | number | null,
    result?: any,
    error?: IJsonRpcError,
  ) {
    // Enforce mutual exclusivity between result and error
    const hasResult = result !== undefined;
    const hasError = error !== undefined;

    if (hasResult && hasError) {
      throw new Error('JSON-RPC response cannot have both result and error');
    }

    if (!hasResult && !hasError) {
      throw new Error('JSON-RPC response must have either result or error');
    }

    // Create a plain object instance
    const responseObj: any = {
      jsonrpc: this.jsonrpc,
      id: id,
    };

    // Only add result or error property when they have values
    if (hasResult) {
      responseObj.result = result;
    }

    if (hasError) {
      responseObj.error = error;
    }

    // Copy all properties from the plain object to this instance
    Object.assign(this, responseObj);
  }

  /**
   * Factory method to create a success response
   */
  public static success(id: string | number | null, result: any): JsonRpcResponse {
    return new JsonRpcResponse(id, result);
  }

  /**
   * Factory method to create an error response
   */
  public static error(id: string | number | null, error: IJsonRpcError): JsonRpcResponse {
    return new JsonRpcResponse(id, undefined, error);
  }
}
