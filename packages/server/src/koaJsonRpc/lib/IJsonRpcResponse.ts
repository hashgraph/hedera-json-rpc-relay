// SPDX-License-Identifier: Apache-2.0

export interface IJsonRpcResponse {
  id: string | number | null;
  jsonrpc: string;
  result?: any;
  error?: any;
}
