// SPDX-License-Identifier: Apache-2.0

import { ITracerConfig, RequestDetails } from '../../types';
import type { TracerType } from '../../constants';

export interface IDebugService {
  debug_traceTransaction: (
    transactionIdOrHash: string,
    tracer: TracerType,
    tracerConfig: ITracerConfig,
    requestDetails: RequestDetails,
  ) => Promise<any>;
  resolveAddress: (address: string, requestDetails: RequestDetails, types?: string[]) => Promise<string>;
}
