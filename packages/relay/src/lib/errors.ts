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

export class JsonRpcError {
  public code: number;
  public message: string;
  public name: string;

  constructor(args: { name: string, code: number, message: string }) {
    this.code = args.code;
    this.name = args.name;
    this.message = args.message;
  }
}

export const predefined = {
  'NO_MINING_WORK': new JsonRpcError({
    name: 'No mining work',
    code: -32000,
    message: 'No mining work available yet'
  }),
  'INVALID_REQUEST': new JsonRpcError({
    name: 'Invalid request',
    code: -32600,
    message: 'Invalid request'
  }),
  'METHOD_NOT_FOUND': new JsonRpcError({
    name: 'Method not found',
    code: -32601,
    message: 'Unsupported JSON-RPC method'
  }),
  'INVALID_PARAMETERS': new JsonRpcError({
    name: 'Invalid parameters',
    code: -32602,
    message: 'Invalid params'
  }),
  'INTERNAL_ERROR': new JsonRpcError({
    name: 'Internal error',
    code: -32603,
    message: 'Unknown error invoking RPC'
  }),
  'PARSE_ERROR': new JsonRpcError({
    name: 'Parse error',
    code: -32700,
    message: 'Unable to parse JSON'
  })
};