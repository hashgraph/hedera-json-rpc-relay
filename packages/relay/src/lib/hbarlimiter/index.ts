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
import { Registry, Counter, Gauge } from 'prom-client';

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
    this.logger.trace(`this.remainingBudget: ${this.remainingBudget}`);

    this.reset = currentDateNow + this.duration;

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
   * Decides whether we should limit expenses, based on remaining budget.
   */
  shouldLimit(currentDateNow: number, mode: string, methodName: string): boolean {
    if (!this.enabled) {
      return false;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow);
    }

    if (this.remainingBudget <= 0) {
      this.hbarLimitCounter.labels(mode, methodName).inc(1);
      this.logger.warn(
        `Rate limit incoming calls, ${this.remainingBudget} out of ${this.total} tℏ left in relay budget until ${this.reset}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Determines whether a transaction fee should be preemptively limited based on the remaining budget.
   * @param {number} transactionFee - The transaction fee to be evaluated.
   * @returns {boolean} A boolean indicating whether the transaction fee should be preemptively limited.
   */

  shouldPreemtivelyLimit(transactionFee: number): boolean {
    return this.remainingBudget - transactionFee <= 0;
  }

  /**
   * Add expense to the remaining budget.
   */
  addExpense(cost: number, currentDateNow: number) {
    if (!this.enabled) {
      return;
    }

    if (this.shouldResetLimiter(currentDateNow)) {
      this.resetLimiter(currentDateNow);
    }
    this.remainingBudget -= cost;
    this.hbarLimitRemainingGauge.set(this.remainingBudget);
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
  private resetLimiter(currentDateNow: number) {
    this.reset = currentDateNow + this.duration;
    this.remainingBudget = this.total;
  }
}
