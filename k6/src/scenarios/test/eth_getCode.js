/*-
 * ‌
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
 * ​
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
 * ‍
 */

import http from "k6/http";

import {TestScenarioBuilder} from '../../lib/common.js';
import {isNonErrorResponse, httpParams, getPayLoad} from "./common.js";
import {setupTestParameters} from "./bootstrapEnvParameters.js";

const methodName = 'eth_getCode';
const {options, run} = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request((testParameters) => {
    return http.post(testParameters.RELAY_BASE_URL, getPayLoad(methodName, [testParameters.DEFAULT_CONTRACT_ADDRESS]), httpParams);
  })
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export {options, run};

export const setup = setupTestParameters;
