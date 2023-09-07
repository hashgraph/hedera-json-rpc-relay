/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { JsonRpcError } from '../../../src/lib/errors/JsonRpcError';

describe('Errors', () => {
  describe('JsonRpcError', () => {
    it('Constructs correctly without request ID', () => {
      const err = new JsonRpcError({
        name: 'TestError',
        code: -32999,
        message: 'test error: foo',
        data: 'some data',
      });
      expect(err.code).to.eq(-32999);
      expect(err.name).to.eq('TestError');
      expect(err.data).to.eq('some data');

      // Check that request ID is *not* prefixed
      expect(err.message).to.eq('test error: foo');
    });

    it('Constructs correctly with request ID', () => {
      const err = new JsonRpcError(
        {
          name: 'TestError',
          code: -32999,
          message: 'test error: foo',
          data: 'some data',
        },
        'abcd-1234',
      );
      expect(err.code).to.eq(-32999);
      expect(err.name).to.eq('TestError');
      expect(err.data).to.eq('some data');

      // Check that request ID is prefixed
      expect(err.message).to.eq('[Request ID: abcd-1234] test error: foo');
    });
  });
});
