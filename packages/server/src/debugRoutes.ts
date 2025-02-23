/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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
import { ITracerConfig, RequestDetails } from '@hashgraph/json-rpc-relay/dist/lib/types';

import { TracerType, TYPES } from './validator';

const defineDebugRoutes = function (app, relay, logAndHandleResponse) {
  /**
   * Debug related endpoints:
   */

  app.useRpc('debug_traceTransaction', async (params: any) => {
    return logAndHandleResponse('debug_traceTransaction', params, (requestDetails: RequestDetails) => {
      const transactionIdOrHash = params[0];
      let tracer: TracerType = TracerType.OpcodeLogger;
      let tracerConfig: ITracerConfig = {};

      // Second param can be either a TracerType string, or an object for TracerConfig or TracerConfigWrapper
      if (TYPES.tracerType.test(params[1])) {
        tracer = params[1];
        if (TYPES.tracerConfig.test(params[2])) {
          tracerConfig = params[2];
        }
      } else if (TYPES.tracerConfig.test(params[1])) {
        tracerConfig = params[1];
      } else if (TYPES.tracerConfigWrapper.test(params[1])) {
        if (TYPES.tracerType.test(params[1].tracer)) {
          tracer = params[1].tracer;
        }
        if (TYPES.tracerConfig.test(params[1].tracerConfig)) {
          tracerConfig = params[1].tracerConfig;
        }
      }

      return relay
        .eth()
        .debugService()
        .debug_traceTransaction(transactionIdOrHash, tracer, tracerConfig, requestDetails);
    });
  });
};

export { defineDebugRoutes };
