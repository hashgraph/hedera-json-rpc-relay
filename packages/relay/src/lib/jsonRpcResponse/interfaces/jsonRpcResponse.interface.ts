// SPDX-License-Identifier: Apache-2.0

import { IJsonRpcError } from '.';

export interface IJsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: IJsonRpcError;
}
