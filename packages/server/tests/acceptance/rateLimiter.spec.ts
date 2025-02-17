// SPDX-License-Identifier: Apache-2.0

// Assertions and constants from local resources

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

import testConstants from '../../tests/helpers/constants';
import RelayClient from '../clients/relayClient';
import Assertions from '../helpers/assertions';

describe('@ratelimiter Rate Limiters Acceptance Tests', function () {
  this.timeout(480 * 1000); // 480 seconds

  // @ts-ignore
  const { relay }: { relay: RelayClient } = global;

  // cached entities
  let requestId: string;

  const TIER_2_RATE_LIMIT = ConfigService.get('TIER_2_RATE_LIMIT');
  const LIMIT_DURATION = ConfigService.get('LIMIT_DURATION');

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
