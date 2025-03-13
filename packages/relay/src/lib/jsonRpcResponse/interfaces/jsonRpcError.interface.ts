// SPDX-License-Identifier: Apache-2.0

export interface IJsonRpcError {
  code: number;
  message: string;
  data?: any;
}
