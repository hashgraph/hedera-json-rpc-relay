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

import pino from 'pino';
import { expect } from 'chai';
import { resolve } from 'path';
import * as sinon from 'sinon';
import { config } from 'dotenv';
import { Registry } from 'prom-client';
import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Utils } from '../../../../src/utils';
import { getRequestId } from '../../../helpers';
import constants from '../../../../src/lib/constants';
import { MirrorNodeClient } from '../../../../src/lib/clients';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import TransactionService from '../../../../src/lib/services/transactionService/transactionService';
import { AccountId, Client, Hbar, Long, Status, TransactionRecord, TransactionRecordQuery } from '@hashgraph/sdk';

config({ path: resolve(__dirname, '../../../test.env') });
const registry = new Registry();
const logger = pino();

describe('Transaction Service', function () {
  this.timeout(20000);

  let client: Client;
  let mock: MockAdapter;
  let instance: AxiosInstance;
  let mirrorNodeClient: MirrorNodeClient;
  let transactionService: TransactionService;

  const mockedTxFee = 36900000;
  const operatorAcocuntId = `0.0.1022`;
  const callerName = 'eth_sendRawTransaction';
  const mockedConstructorName = 'constructor_name';
  const mockedTransactionId = '0.0.1022@1681130064.409933500';
  const mockedTransactionIdFormatted = '0.0.1022-1681130064-409933500';
  const mockedMirrorNodeTransactionRecord = {
    transactions: [
      {
        charged_tx_fee: mockedTxFee,
        result: 'SUCCESS',
        transaction_id: '0.0.1022-1681130064-409933500',
        transfers: [
          {
            account: operatorAcocuntId,
            amount: -1 * mockedTxFee,
            is_approval: false,
          },
        ],
      },
    ],
  };

  const mockedConsensusNodeTransactionRecord = {
    receipt: {
      status: Status.Success,
    },
    transactionFee: new Hbar(mockedTxFee),
    contractFunctionResult: {
      gasUsed: new Long(0, 1000, true),
    },
    transfers: [
      {
        accountId: operatorAcocuntId,
        amount: Hbar.fromTinybars(-1 * mockedTxFee),
        is_approval: false,
      },
    ],
  } as unknown as TransactionRecord;

  before(() => {
    process.env.OPERATOR_KEY_FORMAT = 'DER';

    // consensus node client
    const hederaNetwork = process.env.HEDERA_NETWORK!;
    if (hederaNetwork in constants.CHAIN_IDS) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }
    client = client.setOperator(
      AccountId.fromString(process.env.OPERATOR_ID_MAIN!),
      Utils.createPrivateKeyBasedOnFormat(process.env.OPERATOR_KEY_MAIN!),
    );

    // mirror node client
    instance = axios.create({
      baseURL: 'https://localhost:5551/api/v1',
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20 * 1000,
    });
    mirrorNodeClient = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      registry,
      new CacheService(logger.child({ name: `cache` }), registry),
      instance,
    );

    // Init new TransactionService instance
    transactionService = new TransactionService(logger, client, mirrorNodeClient);
  });

  beforeEach(() => {
    mock = new MockAdapter(instance);
  });

  describe('getTransactionStatusAndMetrics', () => {
    it('Should execute getTransactionStatusAndMetrics() and redirect calls to MIRROR NODE client', async () => {
      process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE = 'false';

      mock.onGet(`transactions/${mockedTransactionIdFormatted}?nonce=0`).reply(200, mockedMirrorNodeTransactionRecord);

      const getTxResultAndMetricsResult = await transactionService.getTransactionStatusAndMetrics(
        mockedTransactionId,
        callerName,
        getRequestId(),
        mockedConstructorName,
        operatorAcocuntId,
      );

      expect(getTxResultAndMetricsResult.gasUsed).to.eq(0);
      expect(getTxResultAndMetricsResult.transactionStatus).to.eq(
        mockedMirrorNodeTransactionRecord.transactions[0].result,
      );
      expect(getTxResultAndMetricsResult.transactionFee).to.eq(
        mockedMirrorNodeTransactionRecord.transactions[0].charged_tx_fee,
      );
    });

    it('Should execute getTransactionStatusAndMetrics() and redirect calls to CONSENSUS NODE client', async () => {
      process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE = 'true';

      const transactionRecordStub = sinon
        .stub(TransactionRecordQuery.prototype, 'execute')
        .resolves(mockedConsensusNodeTransactionRecord);

      const getTxResultAndMetricsResult = await transactionService.getTransactionStatusAndMetrics(
        mockedTransactionId,
        callerName,
        getRequestId(),
        mockedConstructorName,
        operatorAcocuntId,
      );

      expect(transactionRecordStub.called).to.be.true;
      expect(getTxResultAndMetricsResult.gasUsed).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult?.gasUsed.toNumber(),
      );
      expect(getTxResultAndMetricsResult.transactionFee * 10 ** 8).to.eq(
        mockedConsensusNodeTransactionRecord.transactionFee.toTinybars().toNumber(),
      );
      expect(getTxResultAndMetricsResult.transactionStatus).to.eq(
        mockedConsensusNodeTransactionRecord.receipt.status.toString(),
      );
    });
  });
});
