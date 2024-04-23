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
import { Hbar, HbarUnit, TransactionId } from '@hashgraph/sdk';

import { SDKClient } from '../../../src/lib/clients';
import { ACCOUNT_ADDRESS_1, DEFAULT_NETWORK_FEES, MAX_GAS_LIMIT_HEX, NO_TRANSACTIONS } from './eth-config';
import { JsonRpcError, predefined } from '../../../src/lib/errors/JsonRpcError';
import RelayAssertions from '../../assertions';
import { getRequestId, mockData, signTransaction } from '../../helpers';
import { generateEthTestEnv } from './eth-helpers';
import { SDKClientError } from '../../../src/lib/errors/SDKClientError';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub;
let getSdkClientStub;
let currentMaxBlockRange: number;

describe('@ethSendRawTransaction eth_sendRawTransaction spec', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

  this.beforeEach(() => {
    // reset cache and restMock
    cacheService.clear();
    restMock.reset();

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

  describe('eth_sendRawTransaction', async function () {
    const accountAddress = '0x9eaee9E66efdb91bfDcF516b034e001cc535EB57';
    const accountEndpoint = `accounts/${accountAddress}${NO_TRANSACTIONS}`;
    const gasPrice = '0xad78ebc5ac620000';
    const transactionIdServicesFormat = '0.0.902@1684375868.230217103';
    const transactionId = '0.0.902-1684375868-230217103';
    const value = '0x511617DE831B9E173';
    const contractResultEndpoint = `contracts/results/${transactionId}`;
    const ethereumHash = '0x6d20b034eecc8d455c4c040fb3763082d499353a8b7d318b1085ad8d7de15f7e';
    const transaction = {
      chainId: 0x12a,
      to: ACCOUNT_ADDRESS_1,
      from: accountAddress,
      value,
      gasPrice,
      gasLimit: MAX_GAS_LIMIT_HEX,
    };
    const ACCOUNT_RES = {
      account: accountAddress,
      balance: {
        balance: Hbar.from(100_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar),
      },
    };

    this.beforeEach(() => {
      sinon.restore();
      sdkClientStub = sinon.createStubInstance(SDKClient);
      sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
      restMock.onGet(accountEndpoint).reply(200, ACCOUNT_RES);
    });

    this.afterEach(() => {
      sinon.restore();
    });

    it('should return a predefined GAS_LIMIT_TOO_HIGH instead of NUMERIC_FAULT as precheck exception', async function () {
      // tx with 'gasLimit: BigNumber { value: "30678687678687676876786786876876876000" }'
      const txHash =
        '0x02f881820128048459682f0086014fa0186f00901714801554cbe52dd95512bedddf68e09405fba803be258049a27b820088bab1cad205887185174876e80080c080a0cab3f53602000c9989be5787d0db637512acdd2ad187ce15ba83d10d9eae2571a07802515717a5a1c7d6fa7616183eb78307b4657d7462dbb9e9deca820dd28f62';
      await RelayAssertions.assertRejection(
        predefined.GAS_LIMIT_TOO_HIGH(null, null),
        ethImpl.sendRawTransaction,
        false,
        ethImpl,
        [txHash],
      );
    });

    it('should return a computed hash if unable to retrieve EthereumHash from record due to contract revert', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(`transactions/${transactionId}`).reply(200, null);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
    });

    it('should throw internal error when transaction returned from mirror node is null', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(404, mockData.notFound);
      restMock.onGet(`transactions/${transactionId}?nonce=0`).reply(200, null);

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });

      const response = (await ethImpl.sendRawTransaction(signed, getRequestId())) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it('should throw internal error when transactionID is invalid', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: '',
      });

      const response = (await ethImpl.sendRawTransaction(signed, getRequestId())) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it('should return hash from ContractResult mirror node api', async function () {
      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });
      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
    });

    it('should not send second transaction upon succession', async function () {
      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });

      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
      sinon.assert.calledOnce(sdkClientStub.submitEthereumTransaction);
    });

    it('should send second transaction upon time out', async function () {
      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.onCall(0).throws(new SDKClientError({ status: 21 }, 'timeout exceeded'));

      sdkClientStub.submitEthereumTransaction.onCall(1).returns({
        transactionId: TransactionId.fromString(transactionIdServicesFormat),
      });

      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, getRequestId());
      expect(resultingHash).to.equal(ethereumHash);
      sinon.assert.calledTwice(sdkClientStub.submitEthereumTransaction);
    });

    it('should not send second transaction on error different from timeout', async function () {
      sdkClientStub.submitEthereumTransaction
        .onCall(0)
        .throws(new SDKClientError({ status: 50 }, 'wrong transaction body'));

      const signed = await signTransaction(transaction);

      const response = (await ethImpl.sendRawTransaction(signed, getRequestId())) as JsonRpcError;
      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
      sinon.assert.calledOnce(sdkClientStub.submitEthereumTransaction);
    });
  });
});
