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
import { constructValidLogSubscriptionFilter } from '../../src/utils/utils';

describe('Utilities unit tests', async function () {
  describe('constructValidLogSubscriptionFilter tests', () => {
    it('Should ignore all the unexpected params and return a new filter object with valid params (address, topics)', () => {
      const originalFilter = {
        address: '0x23f5e49569A835d7bf9AefD30e4f60CdD570f225',
        topics: ['0x1d29d0f04057864b829c60f025fdba344f1623eb30b90820f5a6c39ffbd1c512'],
        fromBlock: '0x0',
        toBlock: 'latest',
        hedera: '0xhbar',
      };
      const originalFilterKeys = Object.keys(originalFilter);

      const validFilter = constructValidLogSubscriptionFilter(originalFilter);
      const validFilterKeys = Object.keys(validFilter);

      expect(validFilterKeys).to.not.deep.eq(originalFilterKeys);
      expect(validFilterKeys.length).to.eq(2); // address & topics
      expect(validFilter['address']).to.eq(originalFilter.address);
      expect(validFilter['topics']).to.eq(originalFilter.topics);
      expect(validFilter['fromBlock']).to.not.exist;
      expect(validFilter['toBlock']).to.not.exist;
      expect(validFilter['hedera']).to.not.exist;
    });

    it('Should only add valid params if presented in original filter object', () => {
      // original missing `address` param
      const originalFilter1 = {
        topics: ['0x1d29d0f04057864b829c60f025fdba344f1623eb30b90820f5a6c39ffbd1c512'],
      };
      const validFilter1 = constructValidLogSubscriptionFilter(originalFilter1);
      const validFilter1Keys = Object.keys(validFilter1);
      expect(validFilter1Keys.length).to.eq(1);
      expect(validFilter1['address']).to.not.exist;
      expect(validFilter1['topics']).to.eq(originalFilter1.topics);

      // original missing `topics` param
      const originalFilter2 = {
        address: '0x23f5e49569A835d7bf9AefD30e4f60CdD570f225',
      };
      const validFilter2 = constructValidLogSubscriptionFilter(originalFilter2);
      const validFilter2Keys = Object.keys(validFilter2);
      expect(validFilter2Keys.length).to.eq(1);
      expect(validFilter2['topics']).to.not.exist;
      expect(validFilter2['address']).to.eq(originalFilter2.address);
    });
  });
});
