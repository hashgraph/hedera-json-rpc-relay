/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import path from 'path';
import dotenv from 'dotenv';
import { expect, use } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import constants from '../../../src/lib/constants';
import { SDKClient } from '../../../src/lib/clients';
import { numberTo0x } from '../../../dist/formatters';
import { DEFAULT_NETWORK_FEES, NOT_FOUND_RES } from './eth-config';
import { predefined } from '../../../src/lib/errors/JsonRpcError';
import RelayAssertions from '../../assertions';
import { generateEthTestEnv } from './eth-helpers';
import { toHex } from '../../helpers';
import { IRequestDetails } from '../../../src/lib/types/RequestDetails';
import { request } from 'http';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;
let requestDetails: IRequestDetails;

describe('@ethGasPrice Gas Price spec', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    requestDetails = { requestIdPrefix: `[Request ID: testId]`, requestIp: '0.0.0.0' };
    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    currentMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE);
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = '1';
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
  });

  describe('@ethGasPrice', async function () {
    it('eth_gasPrice', async function () {
      const weiBars = await ethImpl.gasPrice(requestDetails);
      const expectedWeiBars = DEFAULT_NETWORK_FEES.fees[2].gas * constants.TINYBAR_TO_WEIBAR_COEF;
      expect(weiBars).to.equal(numberTo0x(expectedWeiBars));
    });

    it('eth_gasPrice with cached value', async function () {
      const firstGasResult = await ethImpl.gasPrice(requestDetails);

      const modifiedNetworkFees = { ...DEFAULT_NETWORK_FEES };
      modifiedNetworkFees.fees[2].gas = DEFAULT_NETWORK_FEES.fees[2].gas * 100;

      restMock.onGet(`network/fees`).reply(200, modifiedNetworkFees);

      const secondGasResult = await ethImpl.gasPrice(requestDetails);

      expect(firstGasResult).to.equal(secondGasResult);
    });

    it('eth_gasPrice with no EthereumTransaction gas returned', async function () {
      // deep copy DEFAULT_NETWORK_FEES to avoid mutating the original object
      const partialNetworkFees = JSON.parse(JSON.stringify(DEFAULT_NETWORK_FEES));
      partialNetworkFees.fees.splice(2);

      restMock.onGet(`network/fees`).reply(200, partialNetworkFees);

      await RelayAssertions.assertRejection(predefined.COULD_NOT_ESTIMATE_GAS_PRICE, ethImpl.gasPrice, true, ethImpl, [
        requestDetails,
      ]);
    });

    describe('@ethGasPrice different value for GAS_PRICE_PERCENTAGE_BUFFER env', async function () {
      const GAS_PRICE_PERCENTAGE_BUFFER_TESTCASES = {
        'eth_gasPrice with GAS_PRICE_PERCENTAGE_BUFFER set to 10%': '10',
        'eth_gasPrice with GAS_PRICE_PERCENTAGE_BUFFER set to floating % that results in floating number for buffered gas price':
          '10.25',
      };

      for (let testCaseName in GAS_PRICE_PERCENTAGE_BUFFER_TESTCASES) {
        it(testCaseName, async function () {
          const GAS_PRICE_PERCENTAGE_BUFFER = GAS_PRICE_PERCENTAGE_BUFFER_TESTCASES[testCaseName];
          const initialGasPrice = await ethImpl.gasPrice(requestDetails);
          process.env.GAS_PRICE_PERCENTAGE_BUFFER = GAS_PRICE_PERCENTAGE_BUFFER;

          await cacheService.clear();

          const gasPriceWithBuffer = await ethImpl.gasPrice(requestDetails);
          process.env.GAS_PRICE_PERCENTAGE_BUFFER = '0';

          const expectedInitialGasPrice = toHex(DEFAULT_NETWORK_FEES.fees[2].gas * constants.TINYBAR_TO_WEIBAR_COEF);
          const expectedGasPriceWithBuffer = toHex(
            Number(expectedInitialGasPrice) +
              Math.round(
                (Number(expectedInitialGasPrice) / constants.TINYBAR_TO_WEIBAR_COEF) *
                  (Number(GAS_PRICE_PERCENTAGE_BUFFER || 0) / 100),
              ) *
                constants.TINYBAR_TO_WEIBAR_COEF,
          );

          expect(expectedInitialGasPrice).to.not.equal(expectedGasPriceWithBuffer);
          expect(initialGasPrice).to.not.equal(gasPriceWithBuffer);
          expect(initialGasPrice).to.equal(expectedInitialGasPrice);
          expect(gasPriceWithBuffer).to.equal(expectedGasPriceWithBuffer);
        });
      }
    });

    describe('eth_gasPrice not found', async function () {
      beforeEach(() => {
        restMock.onGet(`network/fees`).reply(404, NOT_FOUND_RES);
      });

      it('eth_gasPrice with mirror node return network fees found', async function () {
        const fauxGasTinyBars = 35_000;
        const fauxGasWeiBarHex = '0x13e52b9abe000';
        sdkClientStub.getTinyBarGasFee.returns(fauxGasTinyBars);

        const gas = await ethImpl.gasPrice(requestDetails);
        expect(gas).to.equal(fauxGasWeiBarHex);
      });

      it('eth_gasPrice with no network fees records found', async function () {
        await RelayAssertions.assertRejection(
          predefined.COULD_NOT_ESTIMATE_GAS_PRICE,
          ethImpl.gasPrice,
          true,
          ethImpl,
          [requestDetails],
        );
      });
    });
  });
});
