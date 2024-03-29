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
import path from 'path';
import dotenv from 'dotenv';
import { expect, use } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import { EthImpl } from '../../../src/lib/eth';
import { SDKClientError } from '../../../src/lib/errors/SDKClientError';
import { SDKClient } from '../../../src/lib/clients';
import {
  CONTRACT_ADDRESS_1,
  DEFAULT_CONTRACT,
  DEFAULT_HTS_TOKEN,
  DEFAULT_NETWORK_FEES,
  DEPLOYED_BYTECODE,
  HTS_TOKEN_ADDRESS,
  MIRROR_NODE_DEPLOYED_BYTECODE,
  NO_TRANSACTIONS,
} from './eth-config';
import { generateEthTestEnv } from './eth-helpers';
import { JsonRpcError, predefined } from '../../../src';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;

describe('@ethGetCode using MirrorNode', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();
  let validBlockParam = [null, 'earliest', 'latest', 'pending', 'finalized', 'safe', '0x0', '0x369ABF'];
  let invalidBlockParam = ['hedera', 'ethereum', '0xhbar', '0x369ABF369ABF369ABF369ABF'];

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
    currentMaxBlockRange = Number(process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE);
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = '1';

    restMock.onGet(`accounts/${CONTRACT_ADDRESS_1}?limit=100`).reply(404, null);
    restMock.onGet(`tokens/0.0.${parseInt(CONTRACT_ADDRESS_1, 16)}`).reply(404, null);
    restMock.onGet(`contracts/${CONTRACT_ADDRESS_1}`).reply(200, DEFAULT_CONTRACT);
    sdkClientStub.getContractByteCode.returns(Buffer.from(DEPLOYED_BYTECODE.replace('0x', ''), 'hex'));
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
    process.env.ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE = currentMaxBlockRange.toString();
  });

  describe('eth_getCode', async function () {
    it('should return non cached value for not found contract', async () => {
      restMock.onGet(`contracts/${CONTRACT_ADDRESS_1}`).reply(404, DEFAULT_CONTRACT);
      sdkClientStub.getContractByteCode.throws(
        new SDKClientError({
          status: {
            _code: 16,
          },
        }),
      );

      const resNoCache = await ethImpl.getCode(CONTRACT_ADDRESS_1, null);
      const resCached = await ethImpl.getCode(CONTRACT_ADDRESS_1, null);
      expect(resNoCache).to.equal(EthImpl.emptyHex);
      expect(resCached).to.equal(EthImpl.emptyHex);
    });

    it('should return the runtime_bytecode from the mirror node', async () => {
      const res = await ethImpl.getCode(CONTRACT_ADDRESS_1, null);
      expect(res).to.equal(MIRROR_NODE_DEPLOYED_BYTECODE);
    });

    it('should return the bytecode from SDK if Mirror Node returns 404', async () => {
      restMock.onGet(`contracts/${CONTRACT_ADDRESS_1}`).reply(404, DEFAULT_CONTRACT);
      const res = await ethImpl.getCode(CONTRACT_ADDRESS_1, null);
      expect(res).to.equal(DEPLOYED_BYTECODE);
    });

    it('should return the bytecode from SDK if Mirror Node returns empty runtime_bytecode', async () => {
      restMock.onGet(`contracts/${CONTRACT_ADDRESS_1}`).reply(404, {
        ...DEFAULT_CONTRACT,
        runtime_bytecode: EthImpl.emptyHex,
      });
      const res = await ethImpl.getCode(CONTRACT_ADDRESS_1, null);
      expect(res).to.equal(DEPLOYED_BYTECODE);
    });

    it('should return redirect bytecode for HTS token', async () => {
      restMock.onGet(`contracts/${HTS_TOKEN_ADDRESS}`).reply(404, null);
      restMock.onGet(`accounts/${HTS_TOKEN_ADDRESS}?limit=100`).reply(404, null);
      restMock.onGet(`tokens/0.0.${parseInt(HTS_TOKEN_ADDRESS, 16)}`).reply(200, DEFAULT_HTS_TOKEN);
      const redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${HTS_TOKEN_ADDRESS.slice(
        2,
      )}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`;
      const res = await ethImpl.getCode(HTS_TOKEN_ADDRESS, null);
      expect(res).to.equal(redirectBytecode);
    });

    it('should return the static bytecode for address(0x167) call', async () => {
      restMock.onGet(`contracts/${EthImpl.iHTSAddress}`).reply(200, DEFAULT_CONTRACT);
      restMock.onGet(`accounts/${EthImpl.iHTSAddress}${NO_TRANSACTIONS}`).reply(404, null);

      const res = await ethImpl.getCode(EthImpl.iHTSAddress, null);
      expect(res).to.equal(EthImpl.invalidEVMInstruction);
    });

    validBlockParam.forEach((blockParam) => {
      it(`should pass the validate param check with blockParam=${blockParam} and return the bytecode`, async () => {
        const res = await ethImpl.getCode(CONTRACT_ADDRESS_1, blockParam);
        expect(res).to.equal(MIRROR_NODE_DEPLOYED_BYTECODE);
      });
    });

    invalidBlockParam.forEach((blockParam) => {
      it(`should throw INVALID_PARAMETER JsonRpcError with invalid blockParam=${blockParam}`, async () => {
        try {
          await ethImpl.getCode(EthImpl.iHTSAddress, blockParam);
          expect(true).to.eq(false);
        } catch (error) {
          const expectedError = predefined.UNKNOWN_BLOCK(
            `The value passed is not a valid blockHash/blockNumber/blockTag value: ${blockParam}`,
          );

          expect(error).to.exist;
          expect(error instanceof JsonRpcError);
          expect(error.code).to.eq(expectedError.code);
          expect(error.name).to.eq(expectedError.name);
          expect(error.message).to.eq(expectedError.message);
        }
      });
    });
  });
});
