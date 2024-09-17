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
import { Counter, Gauge, Registry } from 'prom-client';
import { formatRequestIdMessage } from '../../formatters';
import { EnvProviderService } from '@hashgraph/env-provider/dist/services';

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
   * @param {string} [requestId] - An optional unique request ID for tracking the request.
   * @returns {boolean} - Returns `true` if the rate limit should be enforced, otherwise `false`.
   */
  shouldLimit(
    currentDateNow: number,
    mode: string,
    methodName: string,
    originalCallerAddress: string,
    requestId?: string,
  ): boolean {
    if (!this.enabled) {
      return false;
    }

    const requestIdPrefix = formatRequestIdMessage(requestId);

    // check if the caller is a whitelisted caller
    if (this.isAccountWhiteListed(originalCallerAddress)) {
      this.logger.trace(
        `${requestIdPrefix} HBAR rate limit bypassed - the caller is a whitelisted account: originalCallerAddress=${originalCallerAddress}`,
      );
      return false;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow, requestIdPrefix);
    }

    if (this.remainingBudget <= 0) {
      this.hbarLimitCounter.labels(mode, methodName).inc(1);
      this.logger.warn(
        `${requestIdPrefix} HBAR rate limit incoming call: remainingBudget=${this.remainingBudget}, total=${this.total}, resetTimestamp=${this.reset}`,
      );
      return true;
    }

    this.logger.trace(
      `${requestIdPrefix} HBAR rate limit not reached. ${this.remainingBudget} out of ${this.total} tℏ left in relay budget until ${this.reset}.`,
    );

    return false;
  }

  /**
   * Determines whether a preemptive HBAR rate limit should be applied based on the remaining budget and the transaction fee.
   *
   * Bypass if the originalCallerAddress is whitelisted
   *
   * @param {string} originalCallerAddress - The address of the original caller making the request.
   * @param {number} transactionFee - The transaction fee in tinybars to be checked against the remaining budget.
   * @param {string} [requestId] - An optional unique request ID for tracking the request.
   * @returns {boolean} - Returns `true` if the rate limit should be preemptively enforced, otherwise `false`.
   */
  shouldPreemtivelyLimit(originalCallerAddress: string, transactionFee: number, requestId?: string): boolean {
    if (!this.enabled) {
      return false;
    }

    const requestIdPrefix = formatRequestIdMessage(requestId);

    // check if the caller is a whitelisted caller
    if (this.isAccountWhiteListed(originalCallerAddress)) {
      this.logger.trace(
        `${requestIdPrefix} HBAR preemtive rate limit bypassed - the caller is a whitelisted account: originalCallerAddress=${originalCallerAddress}`,
      );
      return false;
    }

    return this.remainingBudget - transactionFee < 0;
  }

  /**
   * Add expense to the remaining budget.
   */
  addExpense(cost: number, currentDateNow: number, requestId?: string) {
    const requestIdPrefix = formatRequestIdMessage(requestId);

    if (!this.enabled) {
      return;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow, requestIdPrefix);
    }
    this.remainingBudget -= cost;
    this.hbarLimitRemainingGauge.set(this.remainingBudget);

    this.logger.trace(
      `${requestIdPrefix} HBAR rate limit expense update: cost=${cost}, remainingBudget=${this.remainingBudget}, resetTimestamp=${this.reset}`,
    );
  }

  /**
   * Checks if the given account address is whitelisted and exempt from HBAR rate limiting.
   *
   * @param {string} originalCallerAddress - The address of the original caller to check against the whitelist.
   * @returns {boolean} - Returns `true` if the account is whitelisted, otherwise `false`.
   */
  isAccountWhiteListed(originalCallerAddress: string): boolean {
    const whiteListedAccountIDs = EnvProviderService.getInstance().get('HBAR_RATE_LIMIT_WHITELIST') ?? [''];
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
   * Decides whether it should reset budget and timer.
   */
  private shouldResetLimiter(currentDateNow: number): boolean {
    return this.reset < currentDateNow ? true : false;
  }

  /**
   * Reset budget to the total allowed and reset timer to current time plus duration.
   */
  private resetLimiter(currentDateNow: number, requestIdPrefix: string) {
    this.reset = currentDateNow + this.duration;
    this.remainingBudget = this.total;
    this.logger.trace(
      `${requestIdPrefix} HBAR Rate Limit reset: remainingBudget= ${this.remainingBudget}, newResetTimestamp= ${this.reset}`,
    );
  }
}
