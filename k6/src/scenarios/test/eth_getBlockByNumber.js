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
import {randomIntBetween} from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import {TestScenarioBuilder} from '../../lib/common.js';
import {isNonErrorResponse, httpParams, getPayLoad} from "./common.js";

const url = __ENV.RELAY_BASE_URL;

const methodName = 'eth_getBlockByNumber';
const {options, run} = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request((testParameters) => {

      const latestBlock =  testParameters.latestBlock;
      // 20% of times we want  to  do  latest, otherwise, we want to  do  a random block
      const isLatest = Math.random() < 0.2;
      const blockNumber = isLatest ? 'latest' : "0x" + randomIntBetween(latestBlock-1000, latestBlock).toString(16);

      return http.post(url, getPayLoad(methodName, [blockNumber, true]), httpParams);
  })
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export {options, run};
