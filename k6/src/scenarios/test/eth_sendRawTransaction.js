// SPDX-License-Identifier: Apache-2.0

import http from 'k6/http';

import { TestScenarioBuilder } from '../../lib/common.js';
import { isNonErrorResponse, httpParams, getPayLoad } from './common.js';

const url = __ENV.RELAY_BASE_URL;

const methodName = 'eth_sendRawTransaction';
const { options, run } = new TestScenarioBuilder()
  .name(methodName) // use unique scenario name among all tests
  .request((testParameters, iteration, vuIndex, iterationByVu) => {
    if (vuIndex >= testParameters.wallets.length) return; // VU index is greater than the number of wallets
    const signedTxsByVu = testParameters.wallets[vuIndex].signedTxs;
    const lastValidSignedTrx =
      parseInt(signedTxsByVu.length) >= parseInt(iterationByVu) ? iterationByVu : signedTxsByVu.length - 1;
    return http.post(url, getPayLoad(methodName, [signedTxsByVu[lastValidSignedTrx]]), httpParams);
  })
  .check(methodName, (r) => isNonErrorResponse(r))
  .testDuration('5s')
  .maxDuration(4000)
  .build();

export { options, run };
