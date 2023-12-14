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

import http from 'k6/http';

import { TestScenarioBuilder } from '../../lib/common.js';
import { isNonErrorResponse, httpParams, getPayLoad } from './common.js';

const url = __ENV.RELAY_BASE_URL;

const methodName = 'eth_estimateGas';
const { options, run } = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request((testParameters) =>{

      const contractAddress = testParameters.contractAddress;
      const from = testParameters.wallets[0].address
      const payload = getPayLoad(methodName, [
          {
              from: from,
              to: contractAddress,
              data: '0xa41368620000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002e4772656574696e67732066726f6d204175746f6d617465642054657374204e756d62657220692c2048656c6c6f21000000000000000000000000000000000000',
          },
          'latest',
      ]);
      return http.post(url, payload, httpParams)},
  )
  .check(methodName, (r) => isNonErrorResponse(r))
  .build();

export { options, run };
