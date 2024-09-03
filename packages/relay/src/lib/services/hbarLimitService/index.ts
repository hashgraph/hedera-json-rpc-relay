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

import { IHbarLimitService } from './IHbarLimitService';
import { HbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IDetailedHbarSpendingPlan } from '../../db/types/hbarLimiter/hbarSpendingPlan';
import { SubscriptionType } from '../../db/types/hbarLimiter/subscriptionType';
import { Logger } from 'pino';
import { formatRequestIdMessage } from '../../../formatters';
import { Counter, Gauge, Registry } from 'prom-client';

export class HbarLimitService implements IHbarLimitService {
  static readonly ONE_DAY_IN_MILLIS = 24 * 60 * 60 * 1000;
  // TODO: Replace with actual values
  static readonly DAILY_LIMITS: Record<SubscriptionType, number> = {
    BASIC: parseInt(process.env.HBAR_DAILY_LIMIT_BASIC ?? '1000'),
    EXTENDED: parseInt(process.env.HBAR_DAILY_LIMIT_EXTENDED ?? '10000'),
    PRIVILEGED: parseInt(process.env.HBAR_DAILY_LIMIT_PRIVILEGED ?? '100000'),
  };

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
   * Tracks the number of unique spending plans used daily.
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
  private remainingBudget: number;

  /**
   * The reset timestamp for the rate limiter.
   * @private
   */
  private reset: Date;

  constructor(
    private readonly hbarSpendingPlanRepository: HbarSpendingPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
    private readonly logger: Logger,
    private readonly register: Registry,
    private readonly totalBudget: number,
  ) {
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
    this.hbarLimitRemainingGauge.set(this.totalBudget);
    this.remainingBudget = this.totalBudget;

    const dailyUniqueBasicSpendingPlansCounterName = 'daily_unique_spending_plans_counter_basic';
    const dailyUniqueExtendedSpendingPlansCounterName = 'daily_unique_spending_plans_counter_extended';
    const dailyUniquePrivilegedSpendingPlansCounterName = 'daily_unique_spending_plans_counter_privileged';
    this.register.removeSingleMetric(dailyUniqueBasicSpendingPlansCounterName);
    this.register.removeSingleMetric(dailyUniqueExtendedSpendingPlansCounterName);
    this.register.removeSingleMetric(dailyUniquePrivilegedSpendingPlansCounterName);
    this.dailyUniqueSpendingPlansCounter = {
      BASIC: new Counter({
        name: dailyUniqueBasicSpendingPlansCounterName,
        help: 'Tracks the number of unique spending plans used daily for BASIC subscription type',
        registers: [register],
      }),
      EXTENDED: new Counter({
        name: dailyUniqueExtendedSpendingPlansCounterName,
        help: 'Tracks the number of unique spending plans used daily for EXTENDED subscription type',
        registers: [register],
      }),
      PRIVILEGED: new Counter({
        name: dailyUniquePrivilegedSpendingPlansCounterName,
        help: 'Tracks the number of unique spending plans used daily for PRIVILEGED subscription type',
        registers: [register],
      }),
    };

    const averageUsageBasicSpendingPlanGaugeName = 'average_daily_spending_plan_usages_gauge_basic';
    const averageUsageExtendedSpendingPlanGaugeName = 'average_daily_spending_plan_usages_gauge_extended';
    const averageUsagePrivilegedSpendingPlanGaugeName = 'average_daily_spending_plan_usages_gauge_privileged';
    this.register.removeSingleMetric(averageUsageBasicSpendingPlanGaugeName);
    this.register.removeSingleMetric(averageUsageExtendedSpendingPlanGaugeName);
    this.register.removeSingleMetric(averageUsagePrivilegedSpendingPlanGaugeName);
    this.averageDailySpendingPlanUsagesGauge = {
      BASIC: new Gauge({
        name: averageUsageBasicSpendingPlanGaugeName,
        help: 'Tracks the average daily spending plan usages for BASIC subscription type',
        registers: [register],
      }),
      EXTENDED: new Gauge({
        name: averageUsageExtendedSpendingPlanGaugeName,
        help: 'Tracks the average daily spending plan usages for EXTENDED subscription type',
        registers: [register],
      }),
      PRIVILEGED: new Gauge({
        name: averageUsagePrivilegedSpendingPlanGaugeName,
        help: 'Tracks the average daily spending plan usages for PRIVILEGED subscription type',
        registers: [register],
      }),
    };

    // Reset the rate limiter at the start of the next day
    const now = Date.now();
    const tomorrow = new Date(now + HbarLimitService.ONE_DAY_IN_MILLIS);
    this.reset = new Date(tomorrow.setHours(0, 0, 0, 0));
  }

  /**
   * Resets the {@link HbarSpendingPlan#spentToday} field for all existing plans.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async resetLimiter(): Promise<void> {
    // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2868
    throw new Error('Not implemented');
  }

  /**
   * Checks if the given eth address or ip address should be limited.
   * @param {string} mode - The mode of the transaction or request.
   * @param {string} methodName - The name of the method being invoked.
   * @param {string} ethAddress - The eth address to check.
   * @param {string} [ipAddress] - The ip address to check.
   * @param {string} [requestId] - A prefix to include in log messages (optional).
   * @returns {Promise<boolean>} - A promise that resolves with a boolean indicating if the address should be limited.
   */
  async shouldLimit(
    mode: string,
    methodName: string,
    ethAddress: string,
    ipAddress?: string,
    requestId?: string,
  ): Promise<boolean> {
    const requestIdPrefix = formatRequestIdMessage(requestId);
    if (await this.isDailyBudgetExceeded(mode, methodName, requestIdPrefix)) {
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
    const dailyLimit = HbarLimitService.DAILY_LIMITS[spendingPlan.subscriptionType];
    const exceedsLimit = spendingPlan.spentToday >= dailyLimit;
    this.logger.trace(
      `${requestIdPrefix} ${user} ${exceedsLimit ? 'should' : 'should not'} be limited, spentToday=${
        spendingPlan.spentToday
      }, limit=${dailyLimit}`,
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
      `${requestIdPrefix} Adding expense of ${cost} to spending plan with ID ${spendingPlan.id}, new spentToday=${
        spendingPlan.spentToday + cost
      }`,
    );

    // Check if the spending plan is being used for the first time today
    if (spendingPlan.spentToday === 0) {
      this.dailyUniqueSpendingPlansCounter[spendingPlan.subscriptionType].inc(1);
    }

    await this.hbarSpendingPlanRepository.addAmountToSpentToday(spendingPlan.id, cost);
    await this.hbarSpendingPlanRepository.addAmountToSpendingHistory(spendingPlan.id, cost);
    this.remainingBudget -= cost;
    this.hbarLimitRemainingGauge.set(this.remainingBudget);

    // Calculate and set the average daily spending plan usages per subscription type
    const averageUsage = await this.calculateAverageDailyUsagePerSubscriptionType(spendingPlan.subscriptionType);
    this.averageDailySpendingPlanUsagesGauge[spendingPlan.subscriptionType].set(averageUsage);

    this.logger.trace(
      `${requestIdPrefix} HBAR rate limit expense update: cost=${cost}, remainingBudget=${this.remainingBudget}`,
    );
  }

  /**
   * Checks if the total daily budget has been exceeded.
   * @param {string} mode - The mode of the transaction or request.
   * @param {string} methodName - The name of the method being invoked.
   * @param {string} [requestIdPrefix] - An optional prefix to include in log messages.
   * @returns {Promise<boolean>} - Resolves `true` if the daily budget has been exceeded, otherwise `false`.
   * @private
   */
  private async isDailyBudgetExceeded(mode: string, methodName: string, requestIdPrefix?: string): Promise<boolean> {
    if (this.shouldResetLimiter()) {
      await this.resetLimiter();
    }
    if (this.remainingBudget <= 0) {
      this.hbarLimitCounter.labels(mode, methodName).inc(1);
      this.logger.warn(
        `${requestIdPrefix} HBAR rate limit incoming call: remainingBudget=${this.remainingBudget}, totalBudget=${this.totalBudget}, resetTimestamp=${this.reset}`,
      );
      return true;
    }

    this.logger.trace(
      `${requestIdPrefix} HBAR rate limit not reached. ${this.remainingBudget} out of ${this.totalBudget} tℏ left in relay budget until ${this.reset}.`,
    );
    return false;
  }

  /**
   * Calculates the average daily usage per subscription type.
   * @param {SubscriptionType} subscriptionType - The subscription type to calculate the average daily usage for.
   * @private {Promise<number>} - A promise that resolves with the average daily usage.
   */
  private async calculateAverageDailyUsagePerSubscriptionType(subscriptionType: SubscriptionType): Promise<number> {
    const plans = await this.hbarSpendingPlanRepository.findAllActiveBySubscriptionType(subscriptionType);
    const planSpending = await Promise.all(plans.map((plan) => this.hbarSpendingPlanRepository.getSpentToday(plan.id)));
    const totalUsage = planSpending.reduce((total, spentTodayByPlan) => total + spentTodayByPlan, 0);
    return Math.round(totalUsage / plans.length);
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
      // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2888
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
    } else if (ipAddress) {
      this.logger.trace(`Linking spending plan with ID ${spendingPlan.id} to ip address ${ipAddress}`);
      // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2888
      // await this.ipAddressHbarSpendingPlanRepository.save({ ipAddress, planId: spendingPlan.id });
    }
    return spendingPlan;
  }
}
