// SPDX-License-Identifier: Apache-2.0

import { RequestDetails } from '../../types';

export interface ICacheClient {
  keys(pattern: string, callingMethod: string, requestDetails: RequestDetails): Promise<string[]>;
  get(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<any>;
  set(key: string, value: any, callingMethod: string, requestDetails: RequestDetails, ttl?: number): Promise<void>;
  multiSet(keyValuePairs: Record<string, any>, callingMethod: string, requestDetails: RequestDetails): Promise<void>;
  pipelineSet(
    keyValuePairs: Record<string, any>,
    callingMethod: string,
    requestDetails: RequestDetails,
    ttl?: number | undefined,
  ): Promise<void>;
  delete(key: string, callingMethod: string, requestDetails: RequestDetails): Promise<void>;
  clear(): Promise<void>;
}
