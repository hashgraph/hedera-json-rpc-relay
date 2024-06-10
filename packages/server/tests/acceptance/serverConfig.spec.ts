/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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
import { expect } from 'chai';
import { Utils } from '../helpers/utils';

describe('@server-config Server Configuration Options Coverage', function () {
  describe('Koa Server Timeout', () => {
    it('should timeout a request after the specified time', async () => {
      const requestTimeoutMs: number = parseInt(process.env.SERVER_REQUEST_TIMEOUT_MS || '3000');
      const host = 'localhost';
      const port = parseInt(process.env.SERVER_PORT || '7546');
      const method = 'eth_blockNumber';
      const params: any[] = [];

      try {
        await Utils.sendJsonRpcRequestWithDelay(host, port, method, params, requestTimeoutMs + 1000);
        throw new Error('Request did not timeout as expected'); // Force the test to fail if the request does not time out
      } catch (err) {
        expect(err.code).to.equal('ECONNRESET');
        expect(err.message).to.equal('socket hang up');
      }
    });
  });
});
