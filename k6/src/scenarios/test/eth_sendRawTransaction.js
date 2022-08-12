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

const url = __ENV.RELAY_BASE_URL;

const methodName = 'eth_sendRawTransaction';
const {options, run} = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request(() => http.post(
    url, 
    getPayLoad(methodName, ["0x02f87582012805860104c533c000860104c533c000830186a0940000000000000000000000000000000002be87bf80841ec6b60ac080a061b63e1d3aee1330681802cf8be6989f794e653c2f8cc5f950bbc20de71ce204a01b9038e8c0641e9674b45b31292bd6173a8ec3015a2d00854bfebd163a364f79"]), 
    httpParams))
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export {options, run};
