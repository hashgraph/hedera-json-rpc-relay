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
import { ethers } from 'ethers';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { EthImpl } from '../../../src/lib/eth';
import { SDKClient } from '../../../src/lib/clients';
import {
  BLOCK_HASH,
  BLOCK_NUMBER,
  BLOCKS_LIMIT_ORDER_URL,
  CONTRACT_ADDRESS_1,
  DEFAULT_BLOCK,
  DEFAULT_CONTRACT_STATE_EMPTY_ARRAY,
  DEFAULT_CURRENT_CONTRACT_STATE,
  DEFAULT_NETWORK_FEES,
  DEFAULT_OLDER_CONTRACT_STATE,
  DETAILD_CONTRACT_RESULT_NOT_FOUND,
  MOST_RECENT_BLOCK,
  OLDER_BLOCK,
} from './eth-config';
import { Eth, predefined } from '../../../src';
import RelayAssertions from '../../assertions';
import { defaultDetailedContractResults, overrideEnvsInMochaDescribe } from '../../helpers';
import { numberTo0x } from '../../../src/formatters';
import { generateEthTestEnv } from './eth-helpers';
import { RequestDetails } from '../../../src/lib/types';
import MockAdapter from 'axios-mock-adapter';
import HAPIService from '../../../src/lib/services/hapiService/hapiService';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub: sinon.SinonStubbedInstance<SDKClient>;
let getSdkClientStub: sinon.SinonStub;

describe('@ethGetStorageAt eth_getStorageAt spec', async function () {
  this.timeout(10000);
  const {
    restMock,
    hapiServiceInstance,
    ethImpl,
    cacheService,
  }: { restMock: MockAdapter; hapiServiceInstance: HAPIService; ethImpl: Eth; cacheService: CacheService } =
    generateEthTestEnv();
  const requestDetails = new RequestDetails({ requestId: 'eth_getStorageAtTest', ipAddress: '0.0.0.0' });
  function confirmResult(result: string) {
    expect(result).to.exist;
    expect(result).to.not.be.null;
    expect(result).equal(DEFAULT_CURRENT_CONTRACT_STATE.state[0].value);
  }

  overrideEnvsInMochaDescribe({ ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE: '1' });

  this.beforeEach(async () => {
    // reset cache and restMock
    await cacheService.clear(requestDetails);
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(`blocks/${BLOCK_HASH}`).reply(200, DEFAULT_BLOCK);
    restMock.onGet(BLOCKS_LIMIT_ORDER_URL).reply(200, MOST_RECENT_BLOCK);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
  });

  describe('eth_getStorageAt', async function () {
    it('eth_getStorageAt with match with block and slot less than 32 bytes and without leading zeroes', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=0x101&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(CONTRACT_ADDRESS_1, '0x101', requestDetails, numberTo0x(BLOCK_NUMBER));
      confirmResult(result);

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with block and slot less than 32 bytes and leading zeroes', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=0x0000101&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        '0x0000101',
        requestDetails,
        numberTo0x(BLOCK_NUMBER),
      );
      confirmResult(result);

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=0x0000000000000000000000000000000000000000000000000000000000000101&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        defaultDetailedContractResults.state_changes[0].slot,
        requestDetails,
        numberTo0x(BLOCK_NUMBER),
      );
      confirmResult(result);

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with block hash', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=0x0000000000000000000000000000000000000000000000000000000000000101&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        defaultDetailedContractResults.state_changes[0].slot,
        requestDetails,
        BLOCK_HASH,
      );
      confirmResult(result);

      // verify slot value
      expect(result).equal(defaultDetailedContractResults.state_changes[0].value_written);
    });

    it('eth_getStorageAt with match with latest block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?slot=${DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot,
        requestDetails,
        'latest',
      );
      confirmResult(result);

      // verify slot value
    });

    it('eth_getStorageAt with match with finalized block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?slot=${DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot,
        requestDetails,
        'finalized',
      );
      confirmResult(result);

      // verify slot value
    });

    it('eth_getStorageAt with match with safe block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?slot=${DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot,
        requestDetails,
        'safe',
      );
      confirmResult(result);

      // verify slot value
    });

    // Block number is a required param, this should not work and should be removed when/if validations are added.
    // Instead, the relay should return `missing value for required argument <argumentIndex> error`.
    it('eth_getStorageAt with match null block', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?slot=${DEFAULT_CURRENT_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CURRENT_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        defaultDetailedContractResults.state_changes[0].slot,
        requestDetails,
        null,
      );
      confirmResult(result);

      // verify slot value
    });

    it('eth_getStorageAt should throw a predefined RESOURCE_NOT_FOUND when block not found', async function () {
      restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, null);

      const args = [
        CONTRACT_ADDRESS_1,
        defaultDetailedContractResults.state_changes[0].slot,
        requestDetails,
        numberTo0x(BLOCK_NUMBER),
      ];

      await RelayAssertions.assertRejection(
        predefined.RESOURCE_NOT_FOUND(),
        ethImpl.getStorageAt,
        false,
        ethImpl,
        args,
      );
    });

    it('eth_getStorageAt should return EthImpl.zeroHex32Byte when slot wrong', async function () {
      const wrongSlot = '0x0000000000000000000000000000000000000000000000000000000000001101';
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=${wrongSlot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_CONTRACT_STATE_EMPTY_ARRAY);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        wrongSlot,
        requestDetails,
        numberTo0x(BLOCK_NUMBER),
      );
      expect(result).to.equal(EthImpl.zeroHex32Byte);
    });

    it('eth_getStorageAt should return old state when passing older block number', async function () {
      restMock.onGet(`blocks/${BLOCK_NUMBER}`).reply(200, OLDER_BLOCK);
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${OLDER_BLOCK.timestamp.to}&slot=${DEFAULT_OLDER_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(200, DEFAULT_OLDER_CONTRACT_STATE);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        DEFAULT_OLDER_CONTRACT_STATE.state[0].slot,
        requestDetails,
        numberTo0x(OLDER_BLOCK.number),
      );
      expect(result).to.equal(DEFAULT_OLDER_CONTRACT_STATE.state[0].value);
    });

    it('eth_getStorageAt should return Zero Hash when address is not found', async function () {
      // mirror node request mocks
      restMock
        .onGet(
          `contracts/${CONTRACT_ADDRESS_1}/state?timestamp=${DEFAULT_BLOCK.timestamp.to}&slot=${DEFAULT_OLDER_CONTRACT_STATE.state[0].slot}&limit=100&order=desc`,
        )
        .reply(404, DETAILD_CONTRACT_RESULT_NOT_FOUND);

      const result = await ethImpl.getStorageAt(
        CONTRACT_ADDRESS_1,
        DEFAULT_OLDER_CONTRACT_STATE.state[0].slot,
        requestDetails,
        numberTo0x(OLDER_BLOCK.number),
      );
      expect(result).to.equal(ethers.ZeroHash);
    });
  });
});
