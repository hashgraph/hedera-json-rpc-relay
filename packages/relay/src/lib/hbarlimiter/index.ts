/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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
import constants from '../constants';
import { Registry, Counter, Gauge } from 'prom-client';
import { formatRequestIdMessage } from '../../formatters';
import { RequestDetails } from '../types/RequestDetails';

export default class HbarLimit {
  private enabled: boolean = false;
  private remainingBudget: number;
  private duration: number = 0;
  private total: number = 0;
  private reset: number;
  private logger: Logger;
  private hbarLimitCounter: Counter;
  private hbarLimitRemainingGauge: Gauge;
  private readonly register: Registry;

  constructor(logger: Logger, currentDateNow: number, total: number, duration: number, register: Registry) {
    this.logger = logger;
    this.enabled = false;
    this.register = register;

    if (total && duration) {
      this.enabled = true;
      this.total = total;
      this.duration = duration;
    }
    this.remainingBudget = this.total;
    this.reset = currentDateNow + this.duration;

    this.logger.trace(`remainingBudget=${this.remainingBudget} tℏ, resetTimestamp=${this.reset}`);

    const metricCounterName = 'rpc_relay_hbar_rate_limit';
    register.removeSingleMetric(metricCounterName);
    this.hbarLimitCounter = new Counter({
      name: metricCounterName,
      help: 'Relay Hbar limit counter',
      registers: [register],
      labelNames: ['mode', 'methodName'],
    });
    this.hbarLimitCounter.inc(0);

    const rateLimiterRemainingGaugeName = 'rpc_relay_hbar_rate_remaining';
    register.removeSingleMetric(rateLimiterRemainingGaugeName);
    this.hbarLimitRemainingGauge = new Gauge({
      name: rateLimiterRemainingGaugeName,
      help: 'Relay Hbar rate limit remaining budget',
      registers: [register],
    });
    this.hbarLimitRemainingGauge.set(this.remainingBudget);
  }

  /**
   * Determines whether the HBAR rate limit should be applied to a given caller based on the current state of the limiter.
   *
   * Bypass if the originalCallerAddress is whitelisted
   *
   * @param {number} currentDateNow - The current date and time in milliseconds since the epoch.
   * @param {string} mode - The mode of the transaction or request.
   * @param {string} methodName - The name of the method being invoked.
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {boolean} - Returns `true` if the rate limit should be enforced, otherwise `false`.
   */
  shouldLimit(
    currentDateNow: number,
    mode: string,
    methodName: string,
    originalCallerAddress: string,
    requestDetails: RequestDetails,
  ): boolean {
    if (!this.enabled) {
      return false;
    }

    const requestIdPrefix = requestDetails.formattedRequestId;

    // check if the caller is a whitelisted caller
    if (this.isAccountWhiteListed(originalCallerAddress)) {
      this.logger.trace(
        `${requestIdPrefix} HBAR rate limit bypassed - the caller is a whitelisted account: originalCallerAddress=${originalCallerAddress}`,
      );
      return false;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow, requestDetails);
    }

    if (this.remainingBudget <= 0) {
      this.hbarLimitCounter.labels(mode, methodName).inc(1);
      this.logger.warn(
        `${requestIdPrefix} HBAR rate limit incoming call: remainingBudget=${this.remainingBudget}, total=${this.total}, resetTimestamp=${this.reset}.`,
      );
      return true;
    } else {
      this.logger.trace(
        `${requestIdPrefix} HBAR rate limit not reached: remainingBudget=${this.remainingBudget}, total=${this.total}, resetTimestamp=${this.reset}.`,
      );
      return false;
    }
  }

  /**
   * Preemptively limits HBAR transactions based on the estimated total fee for file transactions and the remaining budget.
   * This method checks if the caller is whitelisted and bypasses the limit if they are. If not, it calculates the
   * estimated transaction fees based on the call data size and file append chunk size, and throws an error if the
   * remaining budget is insufficient to cover the estimated fees.
   *
   * @param {string} originalCallerAddress - The address of the caller initiating the transaction.
   * @param {number} callDataSize - The size of the call data that will be used in the transaction.
   * @param {number} fileChunkSize - The chunk size used for file append transactions.
   * @param {string} requestId - The request ID for tracing the request flow.
   * @returns {boolean} - Return true if the transaction should be preemptively rate limited, otherwise return false.
   * @throws {JsonRpcError} Throws an error if the total estimated transaction fee exceeds the remaining HBAR budget.
   */
  shouldPreemptivelyLimitFileTransactions(
    originalCallerAddress: string,
    callDataSize: number,
    fileChunkSize: number,
    currentNetworkExchangeRateInCents: number,
    requestId: string,
  ): boolean {
    const requestIdPrefix = formatRequestIdMessage(requestId);

    if (this.isAccountWhiteListed(originalCallerAddress)) {
      this.logger.trace(
        `${requestIdPrefix} Request bypasses the preemptive limit check - the caller is a whitelisted account: originalCallerAddress=${originalCallerAddress}`,
      );
      return false;
    }

    const estimatedTxFee = this.estimateFileTransactionsFee(
      callDataSize,
      fileChunkSize,
      currentNetworkExchangeRateInCents,
    );

    if (this.remainingBudget - estimatedTxFee < 0) {
      this.logger.warn(
        `${requestIdPrefix} Request fails the preemptive limit check - the remaining HBAR budget was not enough to accommodate the estimated transaction fee: remainingBudget=${this.remainingBudget}, total=${this.total}, resetTimestamp=${this.reset}, callDataSize=${callDataSize}, estimatedTxFee=${estimatedTxFee}, exchangeRateInCents=${currentNetworkExchangeRateInCents}`,
      );
      return true;
    }

    this.logger.trace(
      `${requestIdPrefix} Request passes the preemptive limit check - the remaining HBAR budget is enough to accommodate the estimated transaction fee: remainingBudget=${this.remainingBudget}, total=${this.total}, resetTimestamp=${this.reset}, callDataSize=${callDataSize}, estimatedTxFee=${estimatedTxFee}, exchangeRateInCents=${currentNetworkExchangeRateInCents}`,
    );
    return false;
  }

  /**
   * Add expense to the remaining budget.
   */
  addExpense(cost: number, currentDateNow: number, requestDetails: RequestDetails) {
    if (!this.enabled) {
      return;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow, requestDetails);
    }
    this.remainingBudget -= cost;
    this.hbarLimitRemainingGauge.set(this.remainingBudget);

    this.logger.trace(
      `${requestDetails.formattedRequestId} HBAR rate limit expense update: cost=${cost}, remainingBudget=${this.remainingBudget}, resetTimestamp=${this.reset}`,
    );
  }

  /**
   * Checks if the given account address is whitelisted and exempt from HBAR rate limiting.
   *
   * @param {string} originalCallerAddress - The address of the original caller to check against the whitelist.
   * @returns {boolean} - Returns `true` if the account is whitelisted, otherwise `false`.
   */
  isAccountWhiteListed(originalCallerAddress: string): boolean {
    const whiteListedAccountIDs = process.env.HBAR_RATE_LIMIT_WHITELIST ?? [''];
    return (whiteListedAccountIDs as string[]).includes(originalCallerAddress);
  }

  /**
   * Returns whether rate limiter is enabled or not.
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Returns remaining budget.
   */
  getRemainingBudget() {
    return this.remainingBudget;
  }

  /**
   * Returns timestamp for the next rate limit reset.
   */
  getResetTime() {
    return this.reset;
  }

  /**
   * Estimates the total fee in tinybars for file transactions based on the given call data size,
   * file chunk size, and the current network exchange rate.
   *
   * @param {number} callDataSize - The total size of the call data in bytes.
   * @param {number} fileChunkSize - The size of each file chunk in bytes.
   * @param {number} currentNetworkExchangeRateInCents - The current network exchange rate in cents per HBAR.
   * @returns {number} The estimated transaction fee in tinybars.
   */
  estimateFileTransactionsFee(
    callDataSize: number,
    fileChunkSize: number,
    currentNetworkExchangeRateInCents: number,
  ): number {
    const fileCreateTransactions = 1;
    const fileCreateFeeInCents = constants.NETWORK_FEES_IN_CENTS.FILE_CREATE_PER_5_KB;

    // The first chunk goes in with FileCreateTransaciton, the rest are FileAppendTransactions
    const fileAppendTransactions = Math.floor(callDataSize / fileChunkSize) - 1;
    const lastFileAppendChunkSize = callDataSize % fileChunkSize;

    const fileAppendFeeInCents = constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_PER_5_KB;
    const lastFileAppendChunkFeeInCents =
      constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_BASE_FEE +
      lastFileAppendChunkSize * constants.NETWORK_FEES_IN_CENTS.FILE_APPEND_RATE_PER_BYTE;

    const totalTxFeeInCents =
      fileCreateTransactions * fileCreateFeeInCents +
      fileAppendFeeInCents * fileAppendTransactions +
      lastFileAppendChunkFeeInCents;

    const estimatedTxFee = Math.round(
      (totalTxFeeInCents / currentNetworkExchangeRateInCents) * constants.HBAR_TO_TINYBAR_COEF,
    );

    return estimatedTxFee;
  }

  /**
   * Decides whether it should reset budget and timer.
   */
  private shouldResetLimiter(currentDateNow: number): boolean {
    return this.reset < currentDateNow;
  }

  /**
   * Reset budget to the total allowed and reset timer to current time plus duration.
   */
  private resetLimiter(currentDateNow: number, requestDetails: RequestDetails) {
    this.reset = currentDateNow + this.duration;
    this.remainingBudget = this.total;
    this.logger.trace(
      `${requestDetails.formattedRequestId} HBAR Rate Limit reset: remainingBudget= ${this.remainingBudget}, newResetTimestamp= ${this.reset}`,
    );
  }
}
