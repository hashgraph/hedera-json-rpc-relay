// SPDX-License-Identifier: Apache-2.0

import { JsonRpcResponse } from '../../jsonRpcResponse';
import { RequestDetails } from '../../types';
export interface IRequestDispatcher {
  dispatchRequest(method: string, params: any[], requestDetails: RequestDetails): Promise<JsonRpcResponse>;
}
