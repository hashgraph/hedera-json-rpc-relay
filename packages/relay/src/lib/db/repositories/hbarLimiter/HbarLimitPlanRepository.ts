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

import { randomBytes, uuidV4 } from 'ethers';
import { Logger } from 'pino';
import { IHbarSpending } from '../../types/hbarLimiter/hbarSpending';
import { CacheService } from '../../../services/cacheService/cacheService';
import { IHbarLimitPlanRepository } from './IHbarLimitPlanRepository';
import { HbarLimitPlanNotActiveError, HbarLimitPlanNotFoundError } from '../../types/hbarLimiter/errors';
import { IDetailedHbarLimitPlan, IHbarLimitPlan } from '../../types/hbarLimiter/hbarLimitPlan';
import { HbarSpending } from '../../entities/hbarLimiter/hbarSpending';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';
import { HbarLimitPlan } from '../../entities/hbarLimiter/hbarLimitPlan';

export class HbarLimitPlanRepository implements IHbarLimitPlanRepository {
  private readonly collectionKey = 'hbarLimitPlan';
  private readonly oneDayInMillis = 24 * 60 * 60 * 1000;
  private readonly threeMonthsInMillis = this.oneDayInMillis * 90;

  /**
   * The cache service used for storing data.
   * @private
   */
  private readonly cache: CacheService;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  constructor(cache: CacheService, logger: Logger) {
    this.cache = cache;
    this.logger = logger;
  }

  async findById(id: string): Promise<IHbarLimitPlan> {
    const key = this.getKey(id);
    const plan = await this.cache.getAsync<IHbarLimitPlan>(key, 'findById');
    if (!plan) {
      throw new HbarLimitPlanNotFoundError(id);
    }
    this.logger.trace(`Retrieved subscription with ID ${id}`);
    return {
      ...plan,
      createdAt: new Date(plan.createdAt),
    };
  }

  async findByIdWithDetails(id: string): Promise<IDetailedHbarLimitPlan> {
    const plan = await this.findById(id);
    return new HbarLimitPlan({
      ...plan,
      spendingHistory: await this.getSpendingHistory(id),
      spentToday: await this.getSpentToday(id),
    });
  }

  async create(subscriptionType: SubscriptionType): Promise<IDetailedHbarLimitPlan> {
    const plan: IDetailedHbarLimitPlan = {
      id: uuidV4(randomBytes(16)),
      subscriptionType,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 0,
    };
    this.logger.trace(`Creating HbarLimitPlan with ID ${plan.id}...`);
    const key = this.getKey(plan.id);
    await this.cache.set(key, plan, 'create', this.threeMonthsInMillis);
    return new HbarLimitPlan(plan);
  }

  async checkExistsAndActive(id: string): Promise<void> {
    const plan = await this.findById(id);
    if (!plan.active) {
      throw new HbarLimitPlanNotActiveError(id);
    }
  }

  async getSpendingHistory(id: string): Promise<IHbarSpending[]> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spending history for HbarLimitPlan with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const spendingHistory = await this.cache.lRange<IHbarSpending>(key, 0, -1, 'getSpendingHistory');
    return spendingHistory.map((entry) => new HbarSpending(entry));
  }

  async addAmountToSpendingHistory(id: string, amount: number): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Adding ${amount} to spending history for HbarLimitPlan with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const entry: IHbarSpending = { amount, timestamp: new Date() };
    return this.cache.rPush(key, entry, 'addAmountToSpendingHistory');
  }

  async getSpentToday(id: string): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spentToday for HbarLimitPlan with ID ${id}...`);
    const key = this.getSpentTodayKey(id);
    return this.cache.getAsync(key, 'getSpentToday').then((spentToday) => parseInt(spentToday ?? '0'));
  }

  async addAmountToSpentToday(id: string, amount: number): Promise<void> {
    await this.checkExistsAndActive(id);

    const key = this.getSpentTodayKey(id);
    if (!(await this.cache.getAsync(key, 'addAmountToSpentToday'))) {
      this.logger.trace(`No spending yet for HbarLimitPlan with ID ${id}, setting spentToday to ${amount}...`);
      await this.cache.set(key, amount, 'addAmountToSpentToday', this.oneDayInMillis);
    } else {
      this.logger.trace(`Adding ${amount} to spentToday for HbarLimitPlan with ID ${id}...`);
      await this.cache.incrBy(key, amount, 'addAmountToSpentToday');
    }
  }

  private getKey(id: string): string {
    return `${this.collectionKey}:${id}`;
  }

  private getSpentTodayKey(id: string): string {
    return `${this.collectionKey}:${id}:spentToday`;
  }

  private getSpendingHistoryKey(id: string): string {
    return `${this.collectionKey}:${id}:spendingHistory`;
  }
}
