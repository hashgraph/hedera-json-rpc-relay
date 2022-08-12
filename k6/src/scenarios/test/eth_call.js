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

const methodName = 'eth_call';
const {options, run} = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request(() => http.post(
      url, 
      getPayLoad(methodName, [{"from":"0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b","gas":"0x186a0","to":"0x0000000000000000000000000000000002be87bf","data":"0x8d337b81000000000000000000000000a94f5374fce5edbc8e2a8697c15331677e6ebf0b"}, "0x151c8bb"]), 
      httpParams
    )
  )
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export {options, run};
