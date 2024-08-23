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

import { Logger } from 'pino';
import EventEmitter from 'events';
import constants from '../../constants';
import { Status } from '@hashgraph/sdk';
import HbarLimit from '../../hbarlimiter';
import { Histogram, Registry } from 'prom-client';
import { MirrorNodeClient, SDKClient } from '../../clients';
import { formatRequestIdMessage } from '../../../formatters';
import { ITransactionRecordMetric } from '../../types/IMetricService';

export default class MetricService {
  /**
   * Logger instance for logging information.
   * @type {Logger}
   * @readonly
   * @private
   */
  private readonly logger: Logger;

  /**
   * Main SDK client for executing queries.
   * @type {SDKClient}
   * @readonly
   * @private
   */
  private readonly sdkClient: SDKClient;

  /**
   * Main Mirror Node client for retrieving transaction records.
   * @type {MirrorNodeClient}
   * @readonly
   * @private
   */
  private readonly mirrorNodeClient: MirrorNodeClient;

  /**
   * This limiter tracks hbar expenses and limits.
   * @type {HbarLimit}
   * @readonly
   * @private
   */
  private readonly hbarLimiter: HbarLimit;

  /**
   * Histogram for capturing the cost of transactions and queries.
   * @type {Histogram}
   * @readonly
   * @private
   */
  private readonly consensusNodeClientHistogramCost: Histogram;

  /**
   * Histogram for capturing the gas fee of transactions and queries.
   * @type {Histogram}
   * @readonly
   * @private
   */
  private readonly consensusNodeClientHistogramGasFee: Histogram;

  /**
   * An instance of EventEmitter used for emitting and handling events within the class.
   *
   * @private
   * @readonly
   * @type {EventEmitter}
   */
  private readonly eventEmitter: EventEmitter;

  /**
   * Constructs an instance of the MetricService responsible for tracking and recording various metrics
   * related to Hedera network interactions and resource usage.
   *
   * @param {Logger} logger - Logger instance for logging system messages.
   * @param {SDKClient} sdkClient - Client for interacting with the Hedera SDK.
   * @param {MirrorNodeClient} mirrorNodeClient - Client for querying the Hedera mirror node.
   * @param {HbarLimit} hbarLimiter - Rate limiter for managing HBAR-related operations.
   * @param {Registry} register - Registry instance for registering metrics.
   * @param {EventEmitter} eventEmitter - The eventEmitter used for emitting and handling events within the class.
   */
  constructor(
    logger: Logger,
    sdkClient: SDKClient,
    mirrorNodeClient: MirrorNodeClient,
    hbarLimiter: HbarLimit,
    register: Registry,
    eventEmitter: EventEmitter,
  ) {
    this.logger = logger;
    this.sdkClient = sdkClient;
    this.hbarLimiter = hbarLimiter;
    this.eventEmitter = eventEmitter;
    this.mirrorNodeClient = mirrorNodeClient;
    this.consensusNodeClientHistogramCost = this.initCostMetric(register);
    this.consensusNodeClientHistogramGasFee = this.initGasMetric(register);

    //listen to START_CAPTURING_TRANSACTION_METRICS event to kick off captureTransactionMetrics() process
    this.eventEmitter.on(constants.EVENTS.START_CAPTURING_TRANSACTION_METRICS, (args) => {
      this.captureTransactionMetrics(
        args.transactionId,
        args.callerName,
        args.requestId,
        args.txConstructorName,
        args.operatorAccountId,
        args.transactionType,
        args.interactingEntity,
      );
    });

    //listen to START_ADD_EXPENSE_AND_CAPTURE_METRICS event to kick off addExpenseAndCaptureMetrics() process
    this.eventEmitter.on(constants.EVENTS.START_ADD_EXPENSE_AND_CAPTURE_METRICS, (args) => {
      this.addExpenseAndCaptureMetrics(
        args.executionType,
        args.transactionId,
        args.transactionType,
        args.callerName,
        args.cost,
        args.gasUsed,
        args.interactingEntity,
        args.formattedRequestId,
      );
    });
  }

  /**
   * Retrieves the transaction metrics for a given transaction ID
   * by redirecting calls to either consensus node client or mirror node client based on default configuration.
   *
   * @param {string} transactionId - The ID of the transaction.
   * @param {string} callerName - The name of the entity calling the transaction.
   * @param {string} requestId - The request ID for logging purposes.
   * @param {string} txConstructorName - The name of the transaction constructor.
   * @param {string} operatorAccountId - The account ID of the operator.
   * @returns {Promise<void>}
   */
  public async captureTransactionMetrics(
    transactionId: string,
    callerName: string,
    requestId: string,
    txConstructorName: string,
    operatorAccountId: string,
    transactionType: string,
    interactingEntity: string,
  ): Promise<void> {
    // retrieve metrics
    const transactionRecordMetrics = await this.getTransactionRecordMetrics(
      transactionId,
      callerName,
      requestId,
      txConstructorName,
      operatorAccountId,
    );

    // capture metrics to HBAR rate limiter and metric registry
    if (transactionRecordMetrics) {
      const { gasUsed, transactionFee, txRecordChargeAmount } = transactionRecordMetrics;
      if (transactionFee !== 0) {
        this.addExpenseAndCaptureMetrics(
          `TransactionExecution`,
          transactionId,
          transactionType,
          callerName,
          transactionFee,
          gasUsed,
          interactingEntity,
          requestId,
        );
      }

      if (txRecordChargeAmount !== 0) {
        this.addExpenseAndCaptureMetrics(
          `TransactionRecordQuery`,
          transactionId,
          transactionType,
          callerName,
          txRecordChargeAmount,
          0,
          interactingEntity,
          requestId,
        );
      }
    }
  }

  /**
   * Adds an expense and captures metrics related to the transaction execution.
   * @param {string} executionType - The type of execution (e.g., transaction or query).
   * @param {string} transactionId - The ID of the transaction being executed.
   * @param {string} transactionType - The type of transaction (e.g., contract call, file create).
   * @param {string} callerName - The name of the entity calling the transaction.
   * @param {number} cost - The cost of the transaction in tinybars.
   * @param {number} gasUsed - The amount of gas used for the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @param {string} requestId - The formatted request ID for logging purposes.
   * @returns {void}
   */
  public addExpenseAndCaptureMetrics = (
    executionType: string,
    transactionId: string,
    transactionType: string,
    callerName: string,
    cost: number,
    gasUsed: number,
    interactingEntity: string,
    requestId: string,
  ): void => {
    const formattedRequestId = formatRequestIdMessage(requestId);
    this.logger.trace(
      `${formattedRequestId} Capturing HBAR charged: executionType=${executionType} transactionId=${transactionId}, txConstructorName=${transactionType}, callerName=${callerName}, cost=${cost} tinybars`,
    );

    this.hbarLimiter.addExpense(cost, Date.now(), requestId);
    this.captureMetrics(
      SDKClient.transactionMode,
      transactionType,
      Status.Success,
      cost,
      gasUsed,
      callerName,
      interactingEntity,
    );
  };

  /**
   * Retrieves the cost metric for consensus node client operations.
   *
   * @returns {Histogram} - The histogram metric tracking the cost of consensus node client operations.
   */
  public getCostMetric(): Histogram {
    return this.consensusNodeClientHistogramCost;
  }

  /**
   * Retrieves the gas fee metric for consensus node client operations.
   *
   * @returns {Histogram} - The histogram metric tracking the gas fees of consensus node client operations.
   */
  public getGasFeeMetric(): Histogram {
    return this.consensusNodeClientHistogramGasFee;
  }

  /**
   * Initialize consensus node cost metrics
   * @param {Registry} register
   * @returns {Histogram} Consensus node cost metric
   */
  private initCostMetric(register: Registry): Histogram {
    const metricHistogramCost = 'rpc_relay_consensusnode_response';
    register.removeSingleMetric(metricHistogramCost);
    return new Histogram({
      name: metricHistogramCost,
      help: 'Relay consensusnode mode type status cost histogram',
      labelNames: ['mode', 'type', 'status', 'caller', 'interactingEntity'],
      registers: [register],
    });
  }

  /**
   * Initialize consensus node gas metrics
   * @param {Registry} register
   * @returns {Histogram} Consensus node gas metric
   */
  private initGasMetric(register: Registry): Histogram {
    const metricHistogramGasFee = 'rpc_relay_consensusnode_gasfee';
    register.removeSingleMetric(metricHistogramGasFee);
    return new Histogram({
      name: metricHistogramGasFee,
      help: 'Relay consensusnode mode type status gas fee histogram',
      labelNames: ['mode', 'type', 'status', 'caller', 'interactingEntity'],
      registers: [register],
    });
  }

  /**
   * Captures and records metrics for a transaction.
   * @private
   * @param {string} mode - The mode of the transaction (e.g., consensus mode).
   * @param {string} type - The type of the transaction.
   * @param {Status} status - The status of the transaction.
   * @param {number} cost - The cost of the transaction in tinybars.
   * @param {any} gas - The gas used by the transaction.
   * @param {string} caller - The name of the caller executing the transaction.
   * @param {string} interactingEntity - The entity interacting with the transaction.
   * @returns {void}
   */
  private captureMetrics = (
    mode: string,
    type: string,
    status: Status,
    cost: number,
    gas: any,
    caller: string,
    interactingEntity: string,
  ): void => {
    const resolvedCost = cost ? cost : 0;
    const resolvedGas = gas ? (typeof gas === 'object' ? gas.toInt() : gas) : 0;

    this.consensusNodeClientHistogramCost
      .labels(mode, type, status.toString(), caller, interactingEntity)
      .observe(resolvedCost);
    this.consensusNodeClientHistogramGasFee
      .labels(mode, type, status.toString(), caller, interactingEntity)
      .observe(resolvedGas);
  };

  /**
   * Retrieves transaction record metrics based on the transaction ID.
   * Depending on the environment configuration, the metrics are fetched either from the
   * consensus node via the SDK client or from the mirror node.
   *
   * @param {string} transactionId - The ID of the transaction for which metrics are being retrieved.
   * @param {string} callerName - The name of the caller requesting the metrics.
   * @param {string} requestId - The request ID for tracing the request flow.
   * @param {string} txConstructorName - The name of the transaction constructor.
   * @param {string} operatorAccountId - The account ID of the operator.
   * @returns {Promise<ITransactionRecordMetric | undefined>} - The transaction record metrics or undefined if retrieval fails.
   */
  private async getTransactionRecordMetrics(
    transactionId: string,
    callerName: string,
    requestId: string,
    txConstructorName: string,
    operatorAccountId: string,
  ): Promise<ITransactionRecordMetric | undefined> {
    // check if calls are default to consensus node or not
    const defaultToConsensusNode = process.env.GET_RECORD_DEFAULT_TO_CONSENSUS_NODE === 'true';

    // retrieve transaction metrics
    if (defaultToConsensusNode) {
      return this.sdkClient.getTransactionRecordMetrics(
        transactionId,
        callerName,
        requestId,
        txConstructorName,
        operatorAccountId,
      );
    } else {
      return this.mirrorNodeClient.getTransactionRecordMetrics(
        transactionId,
        callerName,
        requestId,
        txConstructorName,
        operatorAccountId,
      );
    }
  }
}
