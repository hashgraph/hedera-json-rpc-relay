// SPDX-License-Identifier: Apache-2.0

import { IJsonRpcError } from './interfaces';

/**
 * Represents a JSON-RPC 2.0 Error object as defined in the specification.
 *
 * When a JSON-RPC call encounters an error, the Response Object must contain
 * an error member with a value that is an object with the following members:
 *
 * Reserved error codes (from -32768 to -32000):
 * - -32700: Parse error - Invalid JSON was received by the server
 * - -32600: Invalid Request - The JSON sent is not a valid Request object
 * - -32601: Method not found - The method does not exist / is not available
 * - -32602: Invalid params - Invalid method parameter(s)
 * - -32603: Internal error - Internal JSON-RPC error
 * - -32000 to -32099: Server error - Reserved for implementation-defined server-errors
 *
 * The remainder of the space is available for application defined errors.
 *
 * @see https://www.jsonrpc.org/specification
 */
export class JsonRpcError implements IJsonRpcError {
  /**
   * Creates a new JSON-RPC Error object.
   *
   * @param code A Number that indicates the error type that occurred. This MUST be an integer.
   * @param message A String providing a short description of the error. The message SHOULD be limited to a concise single sentence.
   * @param data A Primitive or Structured value that contains additional information about the error. This may be omitted. The value of this member is defined by the Server (e.g. detailed error information, nested errors etc.).
   */
  constructor(
    public code: number,
    public message: string,
    public data?: string,
  ) {}
}
