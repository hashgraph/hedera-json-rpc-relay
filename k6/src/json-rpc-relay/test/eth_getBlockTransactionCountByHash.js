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

const url = __ENV.BASE_URL;

const payload = JSON.stringify({
  id: 1,
  jsonrpc: "2.0",
  method: "eth_getBlockTransactionCountByHash",
  params: ["0xb9032390x8671c386edcedbe91ed891f268953ebaf1a5cb2964a6d9ceaaa95f1e700e7b97434d3e2e2595973d0a02e2d981be9deff8543d04b5dc1ba6579132b143087c68db1b2168786408fcbce568238"]
});

const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
};

const {options, run} = new TestScenarioBuilder()
  .name('eth_getBlockTransactionCountByHash') // use unique scenario name among all tests
  .request(() => http.post(url, payload, httpParams))
  .check('eth_getBlockTransactionCountByHash', (r) => isNonErrorResponse(r))
  .build();

export {options, run};
