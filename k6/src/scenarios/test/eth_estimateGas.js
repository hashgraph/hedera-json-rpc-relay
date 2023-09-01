/*-
 * ‌
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import { TestScenarioBuilder } from "../../lib/common.js";
import { isNonErrorResponse, httpParams, getPayLoad } from "./common.js";

const url = __ENV.RELAY_BASE_URL;

const methodName = "eth_estimateGas";
const { options, run } = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request(() =>
    http.post(
      url,
      getPayLoad(methodName, [
        {
          from: "0x8aff0a12f3e8d55cc718d36f84e002c335df2f4a",
          to: "0x5c7687810ce3eae6cda44d0e6c896245cd4f97c6",
          data: "0x6740d36c0000000000000000000000000000000000000000000000000000000000000005",
        },
        "latest",
      ]),
      httpParams,
    ),
  )
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export { options, run };
