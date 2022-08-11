/*-
 * ‌
 * Hedera Mirror Node
 * ​
 * Copyright (C) 2019 - 2022 Hedera Hashgraph, LLC
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
import {isNonErrorResponse} from "./common.js";

const url = __ENV.RELAY_BASE_URL;

const payload = JSON.stringify({
  id: 1,
  jsonrpc: "2.0",
  method: "eth_call",
  params: [{"from":"0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b","gas":"0x186a0","to":"0x0000000000000000000000000000000002be87bf","data":"0x8d337b81000000000000000000000000a94f5374fce5edbc8e2a8697c15331677e6ebf0b"}, "0x151c8bb"]
});

const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
};

const {options, run} = new TestScenarioBuilder()
  .name('eth_call') // use unique scenario name among all tests
  .request(() => http.post(url, payload, httpParams))
  .check('eth_call', (r) => isNonErrorResponse(r))
  .build();

export {options, run};
