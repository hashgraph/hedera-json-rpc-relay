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
import { Utils } from '../../src/utils';
import constants from '../../src/lib/constants';
import { ZeroAddress } from 'ethers';

describe('Utils', () => {
  describe('addPercentageBufferToGasPrice', () => {
    afterEach(() => {
      process.env.GAS_PRICE_PERCENTAGE_BUFFER = '0';
    });

    const TW_COEF = constants.TINYBAR_TO_WEIBAR_COEF;
    const TEST_CASES = [
      { testName: 'zero input', buffer: '0', input: 0, output: 0 },
      { testName: 'buffer 0%', buffer: '0', input: 10 * TW_COEF, output: 10 * TW_COEF },
      { testName: 'buffer 7%', buffer: '7', input: 140 * TW_COEF, output: 150 * TW_COEF },
      { testName: 'buffer 10%', buffer: '10', input: 126 * TW_COEF, output: 139 * TW_COEF },
      { testName: 'buffer 12.25%', buffer: '12.25', input: 56 * TW_COEF, output: 63 * TW_COEF },
      { testName: 'negative buffer -6%', buffer: '-6', input: 100 * TW_COEF, output: 94 * TW_COEF },
      { testName: 'negative buffer -12.58%', buffer: '-12.58', input: 136 * TW_COEF, output: 119 * TW_COEF },
    ];
    for (let i in TEST_CASES) {
      it(TEST_CASES[i].testName, () => {
        process.env.GAS_PRICE_PERCENTAGE_BUFFER = TEST_CASES[i].buffer;
        expect(Utils.addPercentageBufferToGasPrice(TEST_CASES[i].input)).to.equal(TEST_CASES[i].output);
      });
    }
  });

  describe('createSyntheticLogsBloom and checkInLogsBloom', () => {
    const address = '0x000000000000000000000000000000000000040c';
    const topics = [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x00000000000000000000000000000000000000000000000000000000000003f5',
      '0x00000000000000000000000000000000000000000000000000000000000003f6',
    ];
    const expectedLogsBloom =
      '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000' +
      '000000000000000000000000000000000000000000000000001000000000000000800000000000000000000000000000000000000000000' +
      '000000000000000000000000000000000000000000000000001000000000000000000400000000000000000000000000000000000000000' +
      '000000000000100000000000000000000000000000000000000000000000000000400000000000000000300000000040000000000000000' +
      '0000000000000000000000080000000000001000000000000000000000000000000000000000000000000001000000';

    it('should be able to generate logsBloom of transfer event', () => {
      const res = Utils.createSyntheticLogsBloom(address, topics);
      expect(expectedLogsBloom).to.equal(res);
    });

    it('should be able to validate address and topics in generated logsBloom', () => {
      expect(Utils.checkInLogsBloom(address, expectedLogsBloom)).to.equal(true);
      expect(Utils.checkInLogsBloom(topics[0], expectedLogsBloom)).to.equal(true);
      expect(Utils.checkInLogsBloom(topics[1], expectedLogsBloom)).to.equal(true);
      expect(Utils.checkInLogsBloom(topics[2], expectedLogsBloom)).to.equal(true);
    });

    it('should be able to validate non-existing address and topic in generated logsBloom', () => {
      expect(Utils.checkInLogsBloom(ZeroAddress, expectedLogsBloom)).to.equal(false);
      expect(Utils.checkInLogsBloom('0xD865b78906938EfDD065Cb443Be31440bE08a7CE', expectedLogsBloom)).to.equal(false);
      expect(
        Utils.checkInLogsBloom('0x0000000000000000000000C70c3C06A4db619B7879d060B9215d528F584FcC', expectedLogsBloom),
      ).to.equal(false);
    });
  });
});
