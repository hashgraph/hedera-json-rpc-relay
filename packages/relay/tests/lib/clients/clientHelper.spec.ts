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
import { Utils } from '../../../src/utils';
import MockAdapter from 'axios-mock-adapter';
import { getRequestId } from '../../helpers';
import axios, { AxiosInstance } from 'axios';
import constants from '../../../src/lib/constants';
import { MirrorNodeClient } from '../../../src/lib/clients';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import { AccountId, Client, Hbar, Long, Status, TransactionRecordQuery } from '@hashgraph/sdk';
import { getTransactionStatusAndMetrrics } from '../../../src/lib/clients/helper/clientHelper';

config({ path: resolve(__dirname, '../../test.env') });
const registry = new Registry();
const logger = pino();

describe('Client Helper', function () {
  this.timeout(20000);

  let client: Client;
  let mock: MockAdapter;
  let instance: AxiosInstance;
  let mirrorNodeClient: MirrorNodeClient;

  const callerName = 'eth_sendRawTransaction';
  const mockedTransactionId = '0.0.1022@1681130064.409933500';
  const mockedTransactionIdFormatted = '0.0.1022-1681130064-409933500';
  const mockedMirrorNodeTransactionRecord = {
    transactions: [
      {
        charged_tx_fee: 56800000,
        result: 'SUCCESS',
        transaction_id: '0.0.1022-1681130064-409933500',
      },
    ],
  };

  const mockedConsensusNodeTransactionRecord = {
    receipt: {
      status: Status.Success,
    },
    transactionFee: new Hbar(36900000),
    contractFunctionResult: {
      gasUsed: new Long(0, 1000, true),
    },
  };

  before(() => {
    const hederaNetwork = process.env.HEDERA_NETWORK!;
    if (hederaNetwork in constants.CHAIN_IDS) {
      client = Client.forName(hederaNetwork);
    } else {
      client = Client.forNetwork(JSON.parse(hederaNetwork));
    }

    // consensus node client
    client = client.setOperator(
      AccountId.fromString(process.env.OPERATOR_ID_MAIN!),
      Utils.createPrivateKeyBasedOnFormat(process.env.OPERATOR_KEY_MAIN!),
    );

    instance = axios.create({
      baseURL: 'https://localhost:5551/api/v1',
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20 * 1000,
    });

    // mirror node client
    mirrorNodeClient = new MirrorNodeClient(
      process.env.MIRROR_NODE_URL || '',
      logger.child({ name: `mirror-node` }),
      registry,
      new CacheService(logger.child({ name: `cache` }), registry),
      instance,
    );
  });

  beforeEach(() => {
    mock = new MockAdapter(instance);
  });

  describe('getTransactionStatusAndMetrrics', () => {
    it('Should getTransactionStatusAndMetrrics via MIRROR NODE client', async () => {
      mock.onGet(`transactions/${mockedTransactionIdFormatted}?nonce=0`).reply(200, mockedMirrorNodeTransactionRecord);

      const getTxResultAndMetricsResult = await getTransactionStatusAndMetrrics(
        mockedTransactionId,
        callerName,
        getRequestId(),
        logger,
        `constructor_name`,
        mirrorNodeClient,
      );

      expect(getTxResultAndMetricsResult.gasUsed).to.eq(0);
      expect(getTxResultAndMetricsResult.transactionStatus).to.eq(
        mockedMirrorNodeTransactionRecord.transactions[0].result,
      );
      expect(getTxResultAndMetricsResult.transactionFee).to.eq(
        mockedMirrorNodeTransactionRecord.transactions[0].charged_tx_fee,
      );
    });

    it('Should getTransactionStatusAndMetrrics via CONSENSUS NODE client', async () => {
      const transactionRecordStub = sinon
        .stub(TransactionRecordQuery.prototype, 'execute')
        .resolves(mockedConsensusNodeTransactionRecord as any);

      const getTxResultAndMetricsResult = await getTransactionStatusAndMetrrics(
        mockedTransactionId,
        callerName,
        getRequestId(),
        logger,
        `constructor_name`,
        client,
      );

      expect(transactionRecordStub.called).to.be.true;
      expect(getTxResultAndMetricsResult.gasUsed).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult.gasUsed.toNumber(),
      );
      expect(getTxResultAndMetricsResult.transactionFee).to.eq(
        mockedConsensusNodeTransactionRecord.transactionFee.toTinybars().toNumber(),
      );
      expect(getTxResultAndMetricsResult.transactionStatus).to.eq(
        mockedConsensusNodeTransactionRecord.receipt.status.toString(),
      );
    });
  });
});
