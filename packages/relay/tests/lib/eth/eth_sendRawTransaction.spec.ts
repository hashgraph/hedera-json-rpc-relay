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
import {
  FileAppendTransaction,
  FileId,
  FileInfo,
  Hbar,
  HbarUnit,
  Long,
  TransactionId,
  TransactionResponse,
} from '@hashgraph/sdk';
import { HbarLimitService } from '../../../src/lib/services/hbarLimitService';
import { EventEmitter } from 'events';
import pino from 'pino';
import { SDKClient } from '../../../src/lib/clients';
import { ACCOUNT_ADDRESS_1, DEFAULT_NETWORK_FEES, MAX_GAS_LIMIT_HEX, NO_TRANSACTIONS } from './eth-config';
import { JsonRpcError, predefined } from '../../../src';
import RelayAssertions from '../../assertions';
import { getRequestId, mockData, overrideEnvsInMochaDescribe, signTransaction } from '../../helpers';
import { generateEthTestEnv } from './eth-helpers';
import { SDKClientError } from '../../../src/lib/errors/SDKClientError';
import { RequestDetails } from '../../../src/lib/types';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

let sdkClientStub: sinon.SinonStubbedInstance<SDKClient>;
let getSdkClientStub: sinon.SinonStub;

describe('@ethSendRawTransaction eth_sendRawTransaction spec', async function () {
  this.timeout(10000);
  let { restMock, hapiServiceInstance, ethImpl, cacheService } = generateEthTestEnv();

  const requestDetails = new RequestDetails({ requestId: 'eth_sendRawTransactionTest', ipAddress: '0.0.0.0' });

  overrideEnvsInMochaDescribe({ ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE: '1' });

  this.beforeEach(async () => {
    // reset cache and restMock
    await cacheService.clear(requestDetails);
    restMock.reset();
    sdkClientStub = sinon.createStubInstance(SDKClient);
    getSdkClientStub = sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
    restMock.onGet('network/fees').reply(200, DEFAULT_NETWORK_FEES);
  });

  this.afterEach(() => {
    getSdkClientStub.restore();
    restMock.resetHandlers();
  });

  describe('eth_sendRawTransaction', async function () {
    const accountAddress = '0x9eaee9E66efdb91bfDcF516b034e001cc535EB57';
    const accountEndpoint = `accounts/${accountAddress}${NO_TRANSACTIONS}`;
    const gasPrice = '0xad78ebc5ac620000';
    const transactionIdServicesFormat = '0.0.902@1684375868.230217103';
    const transactionId = '0.0.902-1684375868-230217103';
    const value = '0x511617DE831B9E173';
    const contractResultEndpoint = `contracts/results/${transactionId}`;
    const networkExchangeRateEndpoint = 'network/exchangerate';
    const ethereumHash = '0x6d20b034eecc8d455c4c040fb3763082d499353a8b7d318b1085ad8d7de15f7e';
    const mockedExchangeRate = {
      current_rate: {
        cent_equivalent: 12,
        expiration_time: 4102444800,
        hbar_equivalent: 1,
      },
    };
    const transaction = {
      chainId: Number(process.env.CHAIN_ID || 0x12a),
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

    beforeEach(() => {
      sinon.restore();
      sdkClientStub = sinon.createStubInstance(SDKClient);
      sinon.stub(hapiServiceInstance, 'getSDKClient').returns(sdkClientStub);
      restMock.onGet(accountEndpoint).reply(200, ACCOUNT_RES);
      restMock.onGet(networkExchangeRateEndpoint).reply(200, mockedExchangeRate);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should emit tracking event (limiter and metrics) only for successful tx responses from FileAppend transaction', async function () {
      const FILE_ID = new FileId(0, 0, 5644);
      sdkClientStub.submitEthereumTransaction.restore();
      sdkClientStub.createFile.restore();
      sdkClientStub.executeAllTransaction.restore();

      sdkClientStub.fileAppendChunkSize = 2048;
      sdkClientStub.clientMain = { operatorAccountId: '', operatorKey: null };

      const fileInfoMock = sinon.stub(FileInfo);
      fileInfoMock.size = new Long(26000);
      sdkClientStub.executeQuery.resolves(fileInfoMock);

      // simulates error after first append by returning only one transaction response
      sinon.stub(FileAppendTransaction.prototype, 'executeAll').resolves([{ transactionId: transactionId }]);

      const eventEmitterMock = sinon.createStubInstance(EventEmitter);
      sdkClientStub.eventEmitter = eventEmitterMock;

      const hbarLimiterMock = sinon.createStubInstance(HbarLimitService);
      sdkClientStub.hbarLimitService = hbarLimiterMock;

      const txResponseMock = sinon.createStubInstance(TransactionResponse);
      sdkClientStub.executeTransaction.resolves(txResponseMock);

      txResponseMock.getReceipt.restore();
      sinon.stub(txResponseMock, 'getReceipt').onFirstCall().resolves({ fileId: FILE_ID });
      txResponseMock.transactionId = TransactionId.fromString(transactionIdServicesFormat);

      sdkClientStub.logger = pino();
      sdkClientStub.deleteFile.resolves();

      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      const signed = await signTransaction({
        ...transaction,
        data: '0x' + '22'.repeat(13000),
      });

      const resultingHash = await ethImpl.sendRawTransaction(signed, requestDetails);
      expect(eventEmitterMock.emit.callCount).to.equal(1);
      expect(hbarLimiterMock.shouldLimit.callCount).to.equal(1);
      expect(resultingHash).to.equal(ethereumHash);
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
        [txHash, requestDetails],
      );
    });

    it('should return a computed hash if unable to retrieve EthereumHash from record due to contract revert', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(`transactions/${transactionId}`).reply(200, null);

      const resultingHash = await ethImpl.sendRawTransaction(signed, requestDetails);
      expect(resultingHash).to.equal(ethereumHash);
    });

    it('should throw internal error when transaction returned from mirror node is null', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(404, mockData.notFound);
      restMock.onGet(`transactions/${transactionId}?nonce=0`).reply(200, null);

      sdkClientStub.submitEthereumTransaction.resolves({
        txResponse: {
          transactionId: '',
        } as unknown as TransactionResponse,
        fileId: null,
      });

      const response = (await ethImpl.sendRawTransaction(signed, requestDetails)) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it('should throw internal error when transactionID is invalid', async function () {
      const signed = await signTransaction(transaction);

      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.resolves({
        txResponse: {
          transactionId: '',
        } as unknown as TransactionResponse,
        fileId: null,
      });

      const response = (await ethImpl.sendRawTransaction(signed, requestDetails)) as JsonRpcError;

      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
    });

    it('should return hash from ContractResult mirror node api', async function () {
      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.resolves({
        txResponse: {
          transactionId: TransactionId.fromString(transactionIdServicesFormat),
        } as unknown as TransactionResponse,
        fileId: null,
      });
      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, requestDetails);
      expect(resultingHash).to.equal(ethereumHash);
    });

    it('should not send second transaction upon succession', async function () {
      restMock.onGet(contractResultEndpoint).reply(200, { hash: ethereumHash });

      sdkClientStub.submitEthereumTransaction.resolves({
        txResponse: {
          transactionId: TransactionId.fromString(transactionIdServicesFormat),
        } as unknown as TransactionResponse,
        fileId: null,
      });

      const signed = await signTransaction(transaction);

      const resultingHash = await ethImpl.sendRawTransaction(signed, requestDetails);
      expect(resultingHash).to.equal(ethereumHash);
      sinon.assert.calledOnce(sdkClientStub.submitEthereumTransaction);
    });

    it('should not send second transaction on error different from timeout', async function () {
      sdkClientStub.submitEthereumTransaction
        .onCall(0)
        .throws(new SDKClientError({ status: 50 }, 'wrong transaction body'));

      const signed = await signTransaction(transaction);

      const response = (await ethImpl.sendRawTransaction(signed, requestDetails)) as JsonRpcError;
      expect(response.code).to.equal(predefined.INTERNAL_ERROR().code);
      expect(`Error invoking RPC: ${response.message}`).to.equal(predefined.INTERNAL_ERROR(response.message).message);
      sinon.assert.calledOnce(sdkClientStub.submitEthereumTransaction);
    });

    it('should throw precheck error for type=3 transactions', async function () {
      const type3tx = {
        ...transaction,
        type: 3,
        maxFeePerBlobGas: transaction.gasPrice,
        blobVersionedHashes: [ethereumHash],
      };
      const signed = await signTransaction(type3tx);

      await RelayAssertions.assertRejection(
        predefined.UNSUPPORTED_TRANSACTION_TYPE,
        ethImpl.sendRawTransaction,
        false,
        ethImpl,
        [signed, getRequestId()],
      );
    });
  });
});
