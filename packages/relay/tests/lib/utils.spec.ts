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
import { overrideEnvsInMochaDescribe } from '../helpers';
import { estimateFileTransactionsFee } from '../helpers';

describe('Utils', () => {
  describe('addPercentageBufferToGasPrice', () => {
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
    const gasFormat = Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 2,
    });

    for (let i in TEST_CASES) {
      describe(`${TEST_CASES[i].testName}, ${gasFormat.format(TEST_CASES[i].input)} gas`, () => {
        overrideEnvsInMochaDescribe({ GAS_PRICE_PERCENTAGE_BUFFER: TEST_CASES[i].buffer });

        it(`should return ${gasFormat.format(TEST_CASES[i].output)} gas`, () => {
          expect(Utils.addPercentageBufferToGasPrice(TEST_CASES[i].input)).to.equal(TEST_CASES[i].output);
        });
      });
    }
  });

  describe('estimateFileTransactionsFee', () => {
    const callDataSize = 6000;
    const mockedExchangeRateInCents: number = 12;
    const fileChunkSize = Number(process.env.FILE_APPEND_CHUNK_SIZE) || 5120;
    it('Should execute estimateFileTransactionFee() to estimate total fee of file transactions', async () => {
      const result = Utils.estimateFileTransactionsFee(callDataSize, fileChunkSize, mockedExchangeRateInCents);
      const expectedResult = estimateFileTransactionsFee(callDataSize, fileChunkSize, mockedExchangeRateInCents);
      expect(result).to.eq(expectedResult);
    });
  });
});
