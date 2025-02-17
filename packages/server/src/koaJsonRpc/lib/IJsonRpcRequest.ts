// SPDX-License-Identifier: Apache-2.0

export interface IJsonRpcRequest {
  id: string | number;
  jsonrpc: string;
  method: string;
  params?: any[];
}
