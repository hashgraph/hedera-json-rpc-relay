/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

import ws from 'k6/ws';

import { TestScenarioBuilder } from '../../lib/common.js';
import { connectToWebSocket, isNonErrorResponse } from './common.js';
import { setupTestParameters } from '../../lib/bootstrapEnvParameters.js';
import { subscribeEvents } from '../../lib/constants.js';

const url = __ENV.WS_RELAY_BASE_URL;
const methodName = 'eth_subscribe';

const { options, run } = new TestScenarioBuilder()
  .name(methodName + '_logs') // use unique scenario name among all tests
  .request((testParameters) => {
    return connectToWebSocket(url, methodName, [
      subscribeEvents.logs,
      { address: testParameters.contractsAddresses[0] },
    ]);
  })
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export { options, run };

export const setup = setupTestParameters;
