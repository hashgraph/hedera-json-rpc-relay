/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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

// Assertions and constants from local resources
import Assertions from '../helpers/assertions';
import testConstants from '../../tests/helpers/constants';
import relayConstants from '../../../../packages/relay/src/lib/constants';

describe('@ratelimiter Rate Limiters Acceptance Tests', function () {
  this.timeout(480 * 1000); // 480 seconds

  // @ts-ignore
  const { relay } = global;

  // cached entities
  let requestId: string;

  const TIER_2_RATE_LIMIT =
    (process.env.TIER_2_RATE_LIMIT as unknown as number) || relayConstants.DEFAULT_RATE_LIMIT.TIER_2;
  const LIMIT_DURATION =
    (process.env.LIMIT_DURATION as unknown as number) || relayConstants.DEFAULT_RATE_LIMIT.DURATION;

  describe('RPC Rate Limiter Acceptance Tests', () => {
    const sendMultipleRequests = async (method: string, params: any[], threshold: number) => {
      for (let index = 0; index < threshold; index++) {
        await relay.call(method, params, requestId);
        // If we don't wait between calls, the relay can't register so many request at one time.
        // So instead of 200 requests for example, it registers only 5.
        await new Promise((r) => setTimeout(r, 1));
      }
    };

    describe(`Given requests exceeding the Tier 2 rate limit`, function () {
      const aboveThreshold: number = TIER_2_RATE_LIMIT * 2;

      afterEach(async () => {
        // wait until rate limit is reset
        await new Promise((r) => setTimeout(r, LIMIT_DURATION as number));
      });

      it(`should throw rate limit exceeded error for ${testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID}`, async function () {
        try {
          await sendMultipleRequests(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], aboveThreshold);
          Assertions.expectedError();
        } catch (ignored) {}
      });
    });

    describe(`Given requests within the Tier 2 rate limit`, function () {
      const belowThreshold: number = TIER_2_RATE_LIMIT;

      afterEach(async function () {
        // wait until rate limit is reset
        await new Promise((r) => setTimeout(r, LIMIT_DURATION as number));
      });

      it(`should not throw rate limit exceeded error for ${testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID}`, async function () {
        await sendMultipleRequests(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], belowThreshold);
        // wait until rate limit is reset
        await new Promise((r) => setTimeout(r, LIMIT_DURATION));
        await sendMultipleRequests(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], belowThreshold);
      });
    });
  });
});
