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
import { expect } from 'chai';
import sinon from 'sinon';
import { Registry } from 'prom-client';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
const registry = new Registry();
import pino from 'pino';
import {
  AccountId,
  Client,
  ContractCallQuery,
  PrivateKey,
  TransactionId,
  Hbar,
  Status,
  FileId,
  EthereumTransactionData,
  FileInfoQuery,
  FileInfo,
  FileDeleteTransaction,
  TransactionRecord,
} from '@hashgraph/sdk';
const logger = pino();
import constants from '../../src/lib/constants';
import HbarLimit from '../../src/lib/hbarlimiter';
import { SDKClient } from '../../src/lib/clients';
import { CacheService } from '../../src/lib/services/cacheService/cacheService';
import { MAX_GAS_LIMIT_HEX } from './eth/eth-config';
import { getRequestId, signTransaction } from '../helpers';
import { TransactionReceipt } from 'ethers';

describe('SdkClient', async function () {
  this.timeout(20000);
  let sdkClient, client, hbarLimiter;

  before(() => {
    const hederaNetwork = process.env.HEDERA_NETWORK!;
    if (hederaNetwork in constants.CHAIN_IDS) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }

    client = client.setOperator(
      AccountId.fromString(process.env.OPERATOR_ID_MAIN!),
      PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN!),
    );
    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;
    hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);
    sdkClient = new SDKClient(
      client,
      logger.child({ name: `consensus-node` }),
      hbarLimiter,
      { costHistogram: undefined, gasHistogram: undefined },
      new CacheService(logger.child({ name: `cache` }), registry),
    );
  });

  describe('increaseCostAndRetryExecution', async () => {
    let queryStub, contractCallQuery;
    const successResponse = '0x00001';
    const costTinybars = 1000;
    const baseCost = Hbar.fromTinybars(costTinybars);

    beforeEach(() => {
      contractCallQuery = new ContractCallQuery()
        .setContractId('0.0.1010')
        .setPaymentTransactionId(TransactionId.generate(client.operatorAccountId));
      queryStub = sinon.stub(contractCallQuery, 'execute');
    });

    it('executes the query', async () => {
      queryStub.returns(successResponse);
      let { resp, cost } = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
      expect(resp).to.eq(successResponse);
      expect(cost.toTinybars().toNumber()).to.eq(costTinybars);
      expect(queryStub.callCount).to.eq(1);
    });

    it('increases the cost when INSUFFICIENT_TX_FEE is thrown', async () => {
      queryStub.onCall(0).throws({
        status: Status.InsufficientTxFee,
      });

      queryStub.onCall(1).returns(successResponse);
      let { resp, cost } = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
      expect(resp).to.eq(successResponse);
      expect(cost.toTinybars().toNumber()).to.eq(costTinybars * constants.QUERY_COST_INCREMENTATION_STEP);
      expect(queryStub.callCount).to.eq(2);
    });

    it('increases the cost when INSUFFICIENT_TX_FEE is thrown on every repeat', async () => {
      queryStub.onCall(0).throws({
        status: Status.InsufficientTxFee,
      });

      queryStub.onCall(1).throws({
        status: Status.InsufficientTxFee,
      });

      queryStub.onCall(2).returns(successResponse);

      let { resp, cost } = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
      expect(resp).to.eq(successResponse);
      expect(cost.toTinybars().toNumber()).to.eq(
        Math.floor(costTinybars * Math.pow(constants.QUERY_COST_INCREMENTATION_STEP, 2)),
      );
      expect(queryStub.callCount).to.eq(3);
    });

    it('is repeated at most 4 times', async () => {
      try {
        queryStub.throws({
          status: Status.InsufficientTxFee,
        });

        let { resp, cost } = await sdkClient.increaseCostAndRetryExecution(contractCallQuery, baseCost, client, 3, 0);
      } catch (e: any) {
        expect(queryStub.callCount).to.eq(4);
        expect(e.status).to.eq(Status.InsufficientTxFee);
      }
    });

    it('should return cached getTinyBarGasFee value', async () => {
      const getFeeScheduleStub = sinon.stub(sdkClient, 'getFeeSchedule').callsFake(() => {
        return {
          current: {
            transactionFeeSchedule: [
              {
                hederaFunctionality: {
                  _code: constants.ETH_FUNCTIONALITY_CODE,
                },
                fees: [
                  {
                    servicedata: undefined,
                  },
                ],
              },
            ],
          },
        };
      });
      const getExchangeRateStub = sinon.stub(sdkClient, 'getExchangeRate').callsFake(() => {});
      const convertGasPriceToTinyBarsStub = sinon.stub(sdkClient, 'convertGasPriceToTinyBars').callsFake(() => 0x160c);

      for (let i = 0; i < 5; i++) {
        await sdkClient.getTinyBarGasFee('');
      }

      sinon.assert.calledOnce(getFeeScheduleStub);
      sinon.assert.calledOnce(getExchangeRateStub);
      sinon.assert.calledOnce(convertGasPriceToTinyBarsStub);
    });
  });

  describe('deleteFile', () => {
    // states
    const gasPrice = '0xad78ebc5ac620000';
    const callerName = 'eth_sendRawTransaction';
    const requestId = getRequestId();
    const transaction = {
      type: 1,
      value: 0,
      chainId: 0x12a,
      gasPrice,
      gasLimit: MAX_GAS_LIMIT_HEX,
      data: '0x' + '00'.repeat(5121), // large contract
    };

    before(() => {
      // mock captureMetrics
      sinon.stub(sdkClient, 'captureMetrics').callsFake(() => {});
    });

    it('should execute deleteFile', async () => {
      // prepare fileId
      const signedTx = await signTransaction(transaction);
      const transactionBuffer = Buffer.from(signedTx.substring(2), 'hex');
      const ethereumTransactionData: EthereumTransactionData = EthereumTransactionData.fromBytes(transactionBuffer);
      const fileId = await sdkClient.createFile(ethereumTransactionData.callData, client, requestId, callerName, '');

      const fileInfoPreDelete = await new FileInfoQuery().setFileId(fileId).execute(client);
      expect(fileInfoPreDelete.fileId).to.deep.eq(fileId);
      expect(fileInfoPreDelete.isDeleted).to.be.false;
      expect(fileInfoPreDelete.size.toNumber()).to.not.eq(0);

      // delete a file
      await sdkClient.deleteFile(client, fileId, requestId, callerName, '');
      const fileInfoPostDelete = await new FileInfoQuery().setFileId(fileId).execute(client);
      expect(fileInfoPostDelete.fileId).to.deep.eq(fileId);
      expect(fileInfoPostDelete.isDeleted).to.be.true;
      expect(fileInfoPostDelete.size.toNumber()).to.eq(0);
    });

    it('should print a `warn` log when delete file with invalid fileId', async () => {
      // random fileId
      const fileId = new FileId(0, 0, 369);

      // spy on warn logs
      const warnLoggerStub = sinon.stub(sdkClient.logger, 'warn');

      // delete a file
      await sdkClient.deleteFile(client, fileId, requestId, callerName, '');
      expect(warnLoggerStub.calledWithMatch('ENTITY_NOT_ALLOWED_TO_DELETE')).to.be.true;
    });
  });
});
