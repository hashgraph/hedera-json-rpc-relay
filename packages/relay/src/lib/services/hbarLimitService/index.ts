/*
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
import { Counter, Gauge, Registry } from 'prom-client';
import { IHbarLimitService } from './IHbarLimitService';
import { formatRequestIdMessage } from '../../../formatters';
import { SubscriptionType } from '../../db/types/hbarLimiter/subscriptionType';
import { IDetailedHbarSpendingPlan } from '../../db/types/hbarLimiter/hbarSpendingPlan';
import { HbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import constants from '../../constants';
import { Hbar } from '@hashgraph/sdk';

export class HbarLimitService implements IHbarLimitService {
  // TODO: Replace with actual values - https://github.com/hashgraph/hedera-json-rpc-relay/issues/2895
  static readonly DAILY_LIMITS: Record<SubscriptionType, Hbar> = {
    BASIC: constants.HBAR_RATE_LIMIT_BASIC,
    EXTENDED: constants.HBAR_RATE_LIMIT_EXTENDED,
    PRIVILEGED: constants.HBAR_RATE_LIMIT_PRIVILEGED,
  };

  private readonly oneDayInMillis = 24 * 60 * 60 * 1000;

  /**
   * Counts the number of times the rate limit has been reached.
   * @private
   */
  private readonly hbarLimitCounter: Counter;

  /**
   * Tracks the remaining budget for the rate limiter.
   * @private
   */
  private readonly hbarLimitRemainingGauge: Gauge;

  /**
   * Tracks the number of unique spending plans that have been utilized on a daily basis
   * (i.e., plans that had expenses added to them).
   *
   * For basic spending plans, this equates to the number of unique users who have made requests on that day,
   * since each user has their own individual spending plan.
   *
   * @private
   */
  private readonly dailyUniqueSpendingPlansCounter: Record<SubscriptionType, Counter>;

  /**
   * Tracks the average daily spending plan usages.
   * @private
   */
  private readonly averageDailySpendingPlanUsagesGauge: Record<SubscriptionType, Gauge>;

  /**
   * The remaining budget for the rate limiter.
   * @private
   */
  private remainingBudget: Hbar;

  /**
   * The reset timestamp for the rate limiter.
   * @private
   */
  private reset: Date;

  constructor(
    private readonly hbarSpendingPlanRepository: HbarSpendingPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
    private readonly ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
    private readonly logger: Logger,
    private readonly register: Registry,
    private readonly totalBudget: Hbar,
    private readonly limitDuration: number,
  ) {
    this.reset = this.getResetTimestamp();
    this.remainingBudget = this.totalBudget;

    const metricCounterName = 'rpc_relay_hbar_rate_limit';
    this.register.removeSingleMetric(metricCounterName);
    this.hbarLimitCounter = new Counter({
      name: metricCounterName,
      help: 'Relay Hbar limit counter',
      registers: [register],
      labelNames: ['mode', 'methodName'],
    });
    this.hbarLimitCounter.inc(0);

    const rateLimiterRemainingGaugeName = 'rpc_relay_hbar_rate_remaining';
    this.register.removeSingleMetric(rateLimiterRemainingGaugeName);
    this.hbarLimitRemainingGauge = new Gauge({
      name: rateLimiterRemainingGaugeName,
      help: 'Relay Hbar rate limit remaining budget',
      registers: [register],
    });
    this.hbarLimitRemainingGauge.set(this.remainingBudget.toTinybars().toNumber());

    this.dailyUniqueSpendingPlansCounter = Object.values(SubscriptionType).reduce(
      (acc, type) => {
        const dailyUniqueSpendingPlansCounterName = `daily_unique_spending_plans_counter_${type.toLowerCase()}`;
        this.register.removeSingleMetric(dailyUniqueSpendingPlansCounterName);
        acc[type] = new Counter({
          name: dailyUniqueSpendingPlansCounterName,
          help: `Tracks the number of unique spending plans used daily for ${type} subscription type`,
          registers: [register],
        });
        return acc;
      },
      {} as Record<SubscriptionType, Counter>,
    );

    this.averageDailySpendingPlanUsagesGauge = Object.values(SubscriptionType).reduce(
      (acc, type) => {
        const averageDailySpendingGaugeName = `average_daily_spending_plan_usages_gauge_${type.toLowerCase()}`;
        this.register.removeSingleMetric(averageDailySpendingGaugeName);
        acc[type] = new Gauge({
          name: averageDailySpendingGaugeName,
          help: `Tracks the average daily spending plan usages for ${type} subscription type`,
          registers: [register],
        });
        return acc;
      },
      {} as Record<SubscriptionType, Gauge>,
    );

    setInterval(() => {
      this.resetMetrics();
    }, this.oneDayInMillis);
  }

  /**
   * Resets the {@link HbarSpendingPlan#amountSpent} field for all existing plans.
   * @param {string} [requestId] - An optional unique request ID for tracking the request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async resetLimiter(requestId?: string): Promise<void> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(`${requestIdPrefix} Resetting HBAR rate limiter...`);
    await this.hbarSpendingPlanRepository.resetAmountSpentOfAllPlans();
    this.resetBudget();
    this.reset = this.getResetTimestamp();
    this.logger.trace(
      `${requestIdPrefix} HBAR Rate Limit reset: remainingBudget=${this.remainingBudget}, newResetTimestamp=${this.reset}`,
    );
  }

  /**
   * Checks if the given eth address or ip address should be limited.
   * @param {string} mode - The mode of the transaction or request.
   * @param {string} methodName - The name of the method being invoked.
   * @param {string} ethAddress - The eth address to check.
   * @param {string} [ipAddress] - The ip address to check.
   * @param {string} [requestId] - A prefix to include in log messages (optional).
   * @param {number} [estimatedTxFee] - The total estimated transaction fee, default to 0.
   * @returns {Promise<boolean>} - A promise that resolves with a boolean indicating if the address should be limited.
   */
  async shouldLimit(
    mode: string,
    methodName: string,
    ethAddress: string,
    ipAddress?: string,
    requestId?: string,
    estimatedTxFee: number = 0,
  ): Promise<boolean> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    if (await this.isDailyBudgetExceeded(mode, methodName, estimatedTxFee, requestIdPrefix)) {
      return true;
    }
    if (!ethAddress && !ipAddress) {
      this.logger.warn('No eth address or ip address provided, cannot check if address should be limited');
      return false;
    }
    const user = `(ethAddress=${ethAddress}, ipAddress=${ipAddress})`;
    this.logger.trace(`${requestIdPrefix} Checking if ${user} should be limited...`);
    let spendingPlan = await this.getSpendingPlan(ethAddress, ipAddress);
    if (!spendingPlan) {
      // Create a basic spending plan if none exists for the eth address or ip address
      spendingPlan = await this.createBasicSpendingPlan(ethAddress, ipAddress);
    }

    const dailyLimit = HbarLimitService.DAILY_LIMITS[spendingPlan.subscriptionType].toTinybars();

    const exceedsLimit =
      dailyLimit.lte(spendingPlan.amountSpent) || dailyLimit.lt(spendingPlan.amountSpent + estimatedTxFee);
    this.logger.trace(
      `${requestIdPrefix} ${user} ${exceedsLimit ? 'should' : 'should not'} be limited: amountSpent=${
        spendingPlan.amountSpent
      }, estimatedTxFee=${estimatedTxFee} tℏ, dailyLimit=${dailyLimit.toString()} tℏ`,
    );
    return exceedsLimit;
  }

  /**
   * Add expense to the remaining budget.
   * @param {number} cost - The cost of the expense.
   * @param {string} ethAddress - The Ethereum address to add the expense to.
   * @param {string} [ipAddress] - The optional IP address to add the expense to.
   * @param {string} [requestId] - An optional unique request ID for tracking the request.
   * @returns {Promise<void>} - A promise that resolves when the expense has been added.
   */
  async addExpense(cost: number, ethAddress: string, ipAddress?: string, requestId?: string): Promise<void> {
    if (!ethAddress && !ipAddress) {
      throw new Error('Cannot add expense without an eth address or ip address');
    }

    let spendingPlan = await this.getSpendingPlan(ethAddress, ipAddress);
    if (!spendingPlan) {
      // Create a basic spending plan if none exists for the eth address or ip address
      spendingPlan = await this.createBasicSpendingPlan(ethAddress, ipAddress);
    }

    const requestIdPrefix = formatRequestIdMessage(requestId);
    this.logger.trace(
      `${requestIdPrefix} Adding expense of ${cost} to spending plan with ID ${spendingPlan.id}, new amountSpent=${
        spendingPlan.amountSpent + cost
      }`,
    );

    // Check if the spending plan is being used for the first time today
    if (spendingPlan.amountSpent === 0) {
      this.dailyUniqueSpendingPlansCounter[spendingPlan.subscriptionType].inc(1);
    }

    await this.hbarSpendingPlanRepository.addToAmountSpent(spendingPlan.id, cost, this.limitDuration);
    this.remainingBudget = Hbar.fromTinybars(this.remainingBudget.toTinybars().sub(cost));
    this.hbarLimitRemainingGauge.set(this.remainingBudget.toTinybars().toNumber());

    // Done asynchronously in the background
    this.updateAverageDailyUsagePerSubscriptionType(spendingPlan.subscriptionType).then();

    this.logger.trace(
      `${requestIdPrefix} HBAR rate limit expense update: cost=${cost} tℏ, remainingBudget=${this.remainingBudget}`,
    );
  }

  /**
   * Checks if the total daily budget has been exceeded.
   * @param {string} mode - The mode of the transaction or request.
   * @param {string} methodName - The name of the method being invoked.
   * @param {number} estimatedTxFee - The total estimated transaction fee, default to 0.
   * @param {string} [requestIdPrefix] - An optional prefix to include in log messages.
   * @returns {Promise<boolean>} - Resolves `true` if the daily budget has been exceeded, otherwise `false`.
   * @private
   */
  private async isDailyBudgetExceeded(
    mode: string,
    methodName: string,
    estimatedTxFee: number = 0,
    requestIdPrefix?: string,
  ): Promise<boolean> {
    if (this.shouldResetLimiter()) {
      await this.resetLimiter();
    }
    if (this.remainingBudget.toTinybars().lte(0) || this.remainingBudget.toTinybars().sub(estimatedTxFee).lt(0)) {
      this.hbarLimitCounter.labels(mode, methodName).inc(1);
      this.logger.warn(
        `${requestIdPrefix} HBAR rate limit incoming call: remainingBudget=${this.remainingBudget}, totalBudget=${this.totalBudget}, estimatedTxFee=${estimatedTxFee} tℏ, resetTimestamp=${this.reset}`,
      );
      return true;
    } else {
      this.logger.trace(
        `${requestIdPrefix} HBAR rate limit not reached: remainingBudget=${this.remainingBudget}, totalBudget=${this.totalBudget}, estimatedTxFee=${estimatedTxFee} tℏ, resetTimestamp=${this.reset}.`,
      );
      return false;
    }
  }

  /**
   * Updates the average daily usage per subscription type.
   * @param {SubscriptionType} subscriptionType - The subscription type to update the average daily usage for.
   * @private {Promise<void>} - A promise that resolves when the average daily usage has been updated.
   */
  private async updateAverageDailyUsagePerSubscriptionType(subscriptionType: SubscriptionType): Promise<void> {
    const plans = await this.hbarSpendingPlanRepository.findAllActiveBySubscriptionType(subscriptionType);
    const totalUsage = plans.reduce((total, plan) => total + plan.amountSpent, 0);
    const averageUsage = Math.round(totalUsage / plans.length);
    this.averageDailySpendingPlanUsagesGauge[subscriptionType].set(averageUsage);
  }

  /**
   * Checks if the rate limiter should be reset.
   * @returns {boolean} - `true` if the rate limiter should be reset, otherwise `false`.
   * @private
   */
  private shouldResetLimiter(): boolean {
    return Date.now() >= this.reset.getTime();
  }

  /**
   * Resets the remaining budget to the total budget.
   * @private
   */
  private resetBudget(): void {
    this.remainingBudget = this.totalBudget;
    this.hbarLimitRemainingGauge.set(this.remainingBudget.toTinybars().toNumber());
  }

  /**
   * Resets the metrics that track daily unique spending plans and average daily spending plan usages.
   * @private
   */
  private resetMetrics(): void {
    for (const subscriptionType of Object.values(SubscriptionType)) {
      this.dailyUniqueSpendingPlansCounter[subscriptionType].reset();
      this.averageDailySpendingPlanUsagesGauge[subscriptionType].reset();
    }
  }

  /**
   * Gets the new reset timestamp for the rate limiter.
   *
   * If the new reset timestamp falls on a different day, the time is set to midnight.
   *
   * @returns {Date} - The new reset timestamp.
   * @private
   */
  private getResetTimestamp(): Date {
    const now = new Date();
    const resetDate = new Date(now.getTime() + this.limitDuration);
    if (this.limitDuration >= this.oneDayInMillis) {
      return new Date(resetDate.setHours(0, 0, 0, 0));
    } else {
      return resetDate;
    }
  }

  /**
   * Gets the spending plan for the given eth address or ip address.
   * @param {string} ethAddress - The eth address to get the spending plan for.
   * @param {string} [ipAddress] - The ip address to get the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan | null>} - A promise that resolves with the spending plan or null if none exists.
   * @private
   */
  private async getSpendingPlan(ethAddress: string, ipAddress?: string): Promise<IDetailedHbarSpendingPlan | null> {
    if (ethAddress) {
      try {
        return await this.getSpendingPlanByEthAddress(ethAddress);
      } catch (error) {
        this.logger.warn(error, `Failed to get spending plan for eth address '${ethAddress}'`);
      }
    }
    if (ipAddress) {
      try {
        return await this.getSpendingPlanByIPAddress(ipAddress);
      } catch (error) {
        this.logger.warn(error, `Failed to get spending plan for IP address '${ipAddress}'`);
      }
    }
    return null;
  }

  /**
   * Gets the spending plan for the given eth address.
   * @param {string} ethAddress - The eth address to get the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - A promise that resolves with the spending plan.
   * @private
   */
  private async getSpendingPlanByEthAddress(ethAddress: string): Promise<IDetailedHbarSpendingPlan> {
    const ethAddressHbarSpendingPlan = await this.ethAddressHbarSpendingPlanRepository.findByAddress(ethAddress);
    return this.hbarSpendingPlanRepository.findByIdWithDetails(ethAddressHbarSpendingPlan.planId);
  }

  /**
   * Gets the spending plan for the given IP address.
   * @param {string} ipAddress - The IP address to get the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - A promise that resolves with the spending plan.
   * @private
   */
  private async getSpendingPlanByIPAddress(ipAddress: string): Promise<IDetailedHbarSpendingPlan> {
    const ipAddressHbarSpendingPlan = await this.ipAddressHbarSpendingPlanRepository.findByAddress(ipAddress);
    return this.hbarSpendingPlanRepository.findByIdWithDetails(ipAddressHbarSpendingPlan.planId);
  }

  /**
   * Creates a basic spending plan for the given eth address.
   * @param {string} ethAddress - The eth address to create the spending plan for.
   * @param {string} [ipAddress] - The ip address to create the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - A promise that resolves with the created spending plan.
   * @private
   */
  private async createBasicSpendingPlan(ethAddress: string, ipAddress?: string): Promise<IDetailedHbarSpendingPlan> {
    if (!ethAddress && !ipAddress) {
      throw new Error('Cannot create a spending plan without an associated eth address or ip address');
    }
    const spendingPlan = await this.hbarSpendingPlanRepository.create(SubscriptionType.BASIC);

    if (ethAddress) {
      this.logger.trace(`Linking spending plan with ID ${spendingPlan.id} to eth address ${ethAddress}`);
      await this.ethAddressHbarSpendingPlanRepository.save({ ethAddress, planId: spendingPlan.id });
    }
    if (ipAddress) {
      this.logger.trace(`Linking spending plan with ID ${spendingPlan.id} to ip address ${ipAddress}`);
      await this.ipAddressHbarSpendingPlanRepository.save({ ipAddress, planId: spendingPlan.id });
    }
    return spendingPlan;
  }
}
