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
import EventEmitter from 'events';
import { Registry } from 'prom-client';
import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Utils } from '../../../../src/utils';
import constants from '../../../../src/lib/constants';
import HbarLimit from '../../../../src/lib/hbarlimiter';
import { MirrorNodeClient, SDKClient } from '../../../../src/lib/clients';
import { calculateTxRecordChargeAmount, getRequestId } from '../../../helpers';
import MetricService from '../../../../src/lib/services/metricService/metricService';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { IExecuteQueryEventPayload, IExecuteTransactionEventPayload } from '../../../../src/lib/types/events';
import { Hbar, Long, Status, Client, AccountId, TransactionRecord, TransactionRecordQuery } from '@hashgraph/sdk';

config({ path: resolve(__dirname, '../../../test.env') });
const registry = new Registry();
const logger = pino();

describe('Metric Service', function () {
  let client: Client;
  let mock: MockAdapter;
  let hbarLimiter: HbarLimit;
  let instance: AxiosInstance;
  let eventEmitter: EventEmitter;
  let metricService: MetricService;
  let mirrorNodeClient: MirrorNodeClient;

  const mockedTxFee = 36900000;
  const operatorAccountId = `0.0.1022`;
  const mockedCallerName = 'caller_name';
  const mockedExecutionMode = 'exection_mode';
  const mockedConstructorName = 'constructor_name';
  const mockedInteractingEntity = 'interacting_entity';
  const mockedTransactionId = '0.0.1022@1681130064.409933500';
  const mockedTransactionIdFormatted = '0.0.1022-1681130064-409933500';
  const metricHistogramCostSumTitle = 'rpc_relay_consensusnode_response_sum';
  const metricHistogramGasFeeSumTitle = 'rpc_relay_consensusnode_gasfee_sum';
  const mockedMirrorNodeTransactionRecord = {
    transactions: [
      {
        charged_tx_fee: mockedTxFee,
        result: 'SUCCESS',
        transaction_id: '0.0.1022-1681130064-409933500',
        transfers: [
          {
            account: operatorAccountId,
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
      exchangeRate: { exchangeRateInCents: 12 },
    },
    transactionFee: new Hbar(mockedTxFee),
    contractFunctionResult: {
      gasUsed: new Long(0, 1000, true),
    },
    transfers: [
      {
        accountId: operatorAccountId,
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
  });

  beforeEach(() => {
    mock = new MockAdapter(instance);

    const duration = constants.HBAR_RATE_LIMIT_DURATION;
    const total = constants.HBAR_RATE_LIMIT_TINYBAR;

    hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);
    eventEmitter = new EventEmitter();

    const sdkClient = new SDKClient(
      client,
      logger.child({ name: `consensus-node` }),
      hbarLimiter,
      new CacheService(logger.child({ name: `cache` }), registry),
      eventEmitter,
    );
    // Init new MetricService instance
    metricService = new MetricService(logger, sdkClient, mirrorNodeClient, hbarLimiter, registry, eventEmitter);
  });

  afterEach(() => {
    sinon.restore();
    mock.restore();
  });

  describe('captureTransactionMetrics', () => {
    const mockedExecuteTransactionEventPayload: IExecuteTransactionEventPayload = {
      transactionId: mockedTransactionId,
      callerName: mockedCallerName,
      requestId: getRequestId(),
      txConstructorName: mockedConstructorName,
      operatorAccountId,
      interactingEntity: mockedInteractingEntity,
    };

    it('Should execute captureTransactionMetrics() by retrieving transaction record from MIRROR NODE client', async () => {
      mock.onGet(`transactions/${mockedTransactionIdFormatted}?nonce=0`).reply(200, mockedMirrorNodeTransactionRecord);

      process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE = 'false';

      const originalBudget = hbarLimiter.getRemainingBudget();

      // capture metrics
      await metricService.captureTransactionMetrics(mockedExecuteTransactionEventPayload);

      // validate hbarLimiter
      const updatedBudget = hbarLimiter.getRemainingBudget();
      expect(originalBudget - updatedBudget).to.eq(mockedTxFee);

      // validate cost metrics
      // @ts-ignore
      const costMetricObject = (await metricService.getCostMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramCostSumTitle,
      )!;
      expect(costMetricObject.metricName).to.eq(metricHistogramCostSumTitle);
      expect(costMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(costMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(costMetricObject.value).to.eq(mockedTxFee);
    });

    it('Should execute captureTransactionMetrics() by retrieving transaction record from CONSENSUS NODE client', async () => {
      process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE = 'true';
      const mockedExchangeRateInCents = 12;
      const expectedTxRecordFee = calculateTxRecordChargeAmount(mockedExchangeRateInCents);

      const transactionRecordStub = sinon
        .stub(TransactionRecordQuery.prototype, 'execute')
        .resolves(mockedConsensusNodeTransactionRecord);

      const originalBudget = hbarLimiter.getRemainingBudget();

      await metricService.captureTransactionMetrics(mockedExecuteTransactionEventPayload);
      expect(transactionRecordStub.called).to.be.true;

      // validate hbarLimiter
      // note: since the query is made to consensus node, the total charged amount = txFee + txRecordFee
      const updatedBudget = hbarLimiter.getRemainingBudget();
      expect(originalBudget - updatedBudget).to.eq(mockedTxFee + expectedTxRecordFee);

      // validate cost metric
      // @ts-ignore
      const metricObjects = await metricService.getCostMetric().get();
      const txRecordFeeMetricObject = metricObjects.values.find((metric) => {
        return (
          metric.labels.mode === constants.EXECUTION_MODE.RECORD && metric.metricName === metricHistogramCostSumTitle
        );
      });
      const transactionFeeMetricObject = metricObjects.values.find((metric) => {
        return (
          metric.labels.mode === constants.EXECUTION_MODE.TRANSACTION &&
          metric.metricName === metricHistogramCostSumTitle
        );
      });

      expect(txRecordFeeMetricObject?.metricName).to.eq(metricHistogramCostSumTitle);
      expect(txRecordFeeMetricObject?.labels.caller).to.eq(mockedCallerName);
      expect(txRecordFeeMetricObject?.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(txRecordFeeMetricObject?.value).to.eq(expectedTxRecordFee);

      expect(transactionFeeMetricObject?.metricName).to.eq(metricHistogramCostSumTitle);
      expect(transactionFeeMetricObject?.labels.caller).to.eq(mockedCallerName);
      expect(transactionFeeMetricObject?.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(transactionFeeMetricObject?.value).to.eq(mockedTxFee);

      // validate gas metric
      // @ts-ignore
      const gasMetricObject = (await metricService.getGasFeeMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramGasFeeSumTitle,
      )!;

      expect(gasMetricObject.metricName).to.eq(metricHistogramGasFeeSumTitle);
      expect(gasMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(gasMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(gasMetricObject.value).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult?.gasUsed.toNumber(),
      );
    });

    it('Should listen to EXECUTE_TRANSACTION event to kick off captureTransactionMetrics()', async () => {
      process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE = 'true';
      const mockedExchangeRateInCents = 12;
      const expectedTxRecordFee = calculateTxRecordChargeAmount(mockedExchangeRateInCents);

      const transactionRecordStub = sinon
        .stub(TransactionRecordQuery.prototype, 'execute')
        .resolves(mockedConsensusNodeTransactionRecord);

      const originalBudget = hbarLimiter.getRemainingBudget();

      // emitting an EXECUTE_TRANSACTION event to kick off capturing metrics process asynchronously
      eventEmitter.emit(constants.EVENTS.EXECUTE_TRANSACTION, mockedExecuteTransactionEventPayload);

      // small wait for hbar rate limiter to settle
      await new Promise((r) => setTimeout(r, 100));

      expect(transactionRecordStub.called).to.be.true;

      // validate hbarLimiter
      // note: since the query is made to consensus node, the total charged amount = txFee + txRecordFee
      const updatedBudget = hbarLimiter.getRemainingBudget();

      expect(originalBudget - updatedBudget).to.eq(mockedTxFee + expectedTxRecordFee);

      // validate cost metric
      // @ts-ignore
      const metricObjects = await metricService.getCostMetric().get();
      const txRecordFeeMetricObject = metricObjects.values.find((metric) => {
        return (
          metric.labels.mode === constants.EXECUTION_MODE.RECORD && metric.metricName === metricHistogramCostSumTitle
        );
      });
      const transactionFeeMetricObject = metricObjects.values.find((metric) => {
        return (
          metric.labels.mode === constants.EXECUTION_MODE.TRANSACTION &&
          metric.metricName === metricHistogramCostSumTitle
        );
      });

      expect(txRecordFeeMetricObject?.metricName).to.eq(metricHistogramCostSumTitle);
      expect(txRecordFeeMetricObject?.labels.caller).to.eq(mockedCallerName);
      expect(txRecordFeeMetricObject?.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(txRecordFeeMetricObject?.value).to.eq(expectedTxRecordFee);

      expect(transactionFeeMetricObject?.metricName).to.eq(metricHistogramCostSumTitle);
      expect(transactionFeeMetricObject?.labels.caller).to.eq(mockedCallerName);
      expect(transactionFeeMetricObject?.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(transactionFeeMetricObject?.value).to.eq(mockedTxFee);

      // validate gas metric
      // @ts-ignore
      const gasMetricObject = (await metricService.getGasFeeMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramGasFeeSumTitle,
      )!;

      expect(gasMetricObject.metricName).to.eq(metricHistogramGasFeeSumTitle);
      expect(gasMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(gasMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(gasMetricObject.value).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult?.gasUsed.toNumber(),
      );
    });
  });

  describe('addExpenseAndCaptureMetrics', () => {
    const mockedGasUsed = mockedConsensusNodeTransactionRecord.contractFunctionResult!.gasUsed.toNumber();
    const mockedExecuteQueryEventPayload: IExecuteQueryEventPayload = {
      executionMode: mockedExecutionMode,
      transactionId: mockedTransactionId,
      txConstructorName: mockedConstructorName,
      callerName: mockedCallerName,
      cost: mockedTxFee,
      gasUsed: mockedGasUsed,
      interactingEntity: mockedInteractingEntity,
      status: 'SUCCESS',
      requestDetails: getRequestId(),
    };
    it('should execute addExpenseAndCaptureMetrics() to capture metrics in HBAR limiter and metric registry', async () => {
      const originalBudget = hbarLimiter.getRemainingBudget();

      // capture metrics
      metricService.addExpenseAndCaptureMetrics(mockedExecuteQueryEventPayload);

      // validate hbarLimiter
      const updatedBudget = hbarLimiter.getRemainingBudget();
      expect(originalBudget - updatedBudget).to.eq(mockedTxFee);

      // validate cost metrics
      // @ts-ignore
      const costMetricObject = (await metricService.getCostMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramCostSumTitle,
      )!;
      expect(costMetricObject.metricName).to.eq(metricHistogramCostSumTitle);
      expect(costMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(costMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(costMetricObject.value).to.eq(mockedTxFee);

      // validate gas metric
      // @ts-ignore
      const gasMetricObject = (await metricService.getGasFeeMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramGasFeeSumTitle,
      )!;

      expect(gasMetricObject.metricName).to.eq(metricHistogramGasFeeSumTitle);
      expect(gasMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(gasMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(gasMetricObject.value).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult?.gasUsed.toNumber(),
      );
    });

    it('should listen to EXECUTE_QUERY event and kick off addExpenseAndCaptureMetrics()', async () => {
      const originalBudget = hbarLimiter.getRemainingBudget();

      // emitting an EXECUTE_QUERY event to kick off capturing metrics process
      eventEmitter.emit(constants.EVENTS.EXECUTE_QUERY, mockedExecuteQueryEventPayload);

      // small wait for hbar rate limiter to settle
      await new Promise((r) => setTimeout(r, 100));

      // validate hbarLimiter
      const updatedBudget = hbarLimiter.getRemainingBudget();
      expect(originalBudget - updatedBudget).to.eq(mockedTxFee);

      // validate cost metrics
      // @ts-ignore
      const costMetricObject = (await metricService.getCostMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramCostSumTitle,
      )!;
      expect(costMetricObject.metricName).to.eq(metricHistogramCostSumTitle);
      expect(costMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(costMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(costMetricObject.value).to.eq(mockedTxFee);

      // validate gas metric
      // @ts-ignore
      const gasMetricObject = (await metricService.getGasFeeMetric().get()).values.find(
        (metric) => metric.metricName === metricHistogramGasFeeSumTitle,
      )!;

      expect(gasMetricObject.metricName).to.eq(metricHistogramGasFeeSumTitle);
      expect(gasMetricObject.labels.caller).to.eq(mockedCallerName);
      expect(gasMetricObject.labels.interactingEntity).to.eq(mockedInteractingEntity);
      expect(gasMetricObject.value).to.eq(
        mockedConsensusNodeTransactionRecord.contractFunctionResult?.gasUsed.toNumber(),
      );
    });
  });
});
