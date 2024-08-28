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
import { IHbarSpendingRecord } from '../../types/hbarLimiter/hbarSpendingRecord';
import { CacheService } from '../../../services/cacheService/cacheService';
import { HbarSpendingPlanNotActiveError, HbarSpendingPlanNotFoundError } from '../../types/hbarLimiter/errors';
import { IDetailedHbarSpendingPlan, IHbarSpendingPlan } from '../../types/hbarLimiter/hbarSpendingPlan';
import { HbarSpendingRecord } from '../../entities/hbarLimiter/hbarSpendingRecord';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';
import { HbarSpendingPlan } from '../../entities/hbarLimiter/hbarSpendingPlan';

export class HbarSpendingPlanRepository {
  private readonly collectionKey = 'hbarSpendingPlan';
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

  /**
   * Gets a hbar spending plan by ID.
   * @param id - The ID of the plan to get.
   * @returns {Promise<IHbarSpendingPlan>} - The hbar spending plan object.
   */
  async findById(id: string): Promise<IHbarSpendingPlan> {
    const key = this.getKey(id);
    const plan = await this.cache.getAsync<IHbarSpendingPlan>(key, 'findById');
    if (!plan) {
      throw new HbarSpendingPlanNotFoundError(id);
    }
    this.logger.trace(`Retrieved subscription with ID ${id}`);
    return {
      ...plan,
      createdAt: new Date(plan.createdAt),
    };
  }

  /**
   * Gets a hbar spending plan by ID with detailed information (spendingHistory and spentToday).
   * @param id - The ID of the plan.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - The detailed hbar spending plan object.
   */
  async findByIdWithDetails(id: string): Promise<IDetailedHbarSpendingPlan> {
    const plan = await this.findById(id);
    return new HbarSpendingPlan({
      ...plan,
      spendingHistory: await this.getSpendingHistory(id),
      spentToday: await this.getSpentToday(id),
    });
  }

  /**
   * Creates a new hbar spending plan.
   * @param subscriptionType - The subscription type of the plan to create.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - The created hbar spending plan object.
   */
  async create(subscriptionType: SubscriptionType): Promise<IDetailedHbarSpendingPlan> {
    const plan: IDetailedHbarSpendingPlan = {
      id: uuidV4(randomBytes(16)),
      subscriptionType,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 0,
    };
    this.logger.trace(`Creating HbarSpendingPlan with ID ${plan.id}...`);
    const key = this.getKey(plan.id);
    await this.cache.set(key, plan, 'create', this.threeMonthsInMillis);
    return new HbarSpendingPlan(plan);
  }

  /**
   * Verify that an hbar spending plan exists and is active.
   * @param id - The ID of the plan.
   * @returns {Promise<void>} - A promise that resolves if the plan exists and is active, or rejects if not.
   */
  async checkExistsAndActive(id: string): Promise<void> {
    const plan = await this.findById(id);
    if (!plan.active) {
      throw new HbarSpendingPlanNotActiveError(id);
    }
  }

  /**
   * Gets the spending history for a hbar spending plan.
   * @param id - The ID of the plan.
   * @returns {Promise<IHbarSpendingRecord[]>} - A promise that resolves with the spending history.
   */
  async getSpendingHistory(id: string): Promise<IHbarSpendingRecord[]> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spending history for HbarSpendingPlan with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const spendingHistory = await this.cache.lRange<IHbarSpendingRecord>(key, 0, -1, 'getSpendingHistory');
    return spendingHistory.map((entry) => new HbarSpendingRecord(entry));
  }

  /**
   * Adds spending to a plan's spending history.
   * @param id - The ID of the plan.
   * @param amount - The amount to add to the plan's spending.
   * @returns {Promise<number>} - A promise that resolves with the new length of the spending history.
   */
  async addAmountToSpendingHistory(id: string, amount: number): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Adding ${amount} to spending history for HbarSpendingPlan with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const entry: IHbarSpendingRecord = { amount, timestamp: new Date() };
    return this.cache.rPush(key, entry, 'addAmountToSpendingHistory');
  }

  /**
   * Gets the amount spent today for an hbar spending plan.
   * @param id - The ID of the plan.
   * @returns {Promise<number>} - A promise that resolves with the amount spent today.
   */
  async getSpentToday(id: string): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spentToday for HbarSpendingPlan with ID ${id}...`);
    const key = this.getSpentTodayKey(id);
    return this.cache.getAsync(key, 'getSpentToday').then((spentToday) => parseInt(spentToday ?? '0'));
  }

  /**
   * Adds an amount to the amount spent today for a plan.
   * @param id - The ID of the plan.
   * @param amount - The amount to add.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async addAmountToSpentToday(id: string, amount: number): Promise<void> {
    await this.checkExistsAndActive(id);

    const key = this.getSpentTodayKey(id);
    if (!(await this.cache.getAsync(key, 'addAmountToSpentToday'))) {
      this.logger.trace(`No spending yet for HbarSpendingPlan with ID ${id}, setting spentToday to ${amount}...`);
      await this.cache.set(key, amount, 'addAmountToSpentToday', this.oneDayInMillis);
    } else {
      this.logger.trace(`Adding ${amount} to spentToday for HbarSpendingPlan with ID ${id}...`);
      await this.cache.incrBy(key, amount, 'addAmountToSpentToday');
    }
  }

  /**
   * Gets the cache key for an {@link IHbarSpendingPlan}.
   * @param id - The ID of the plan to get the key for.
   * @private
   */
  private getKey(id: string): string {
    return `${this.collectionKey}:${id}`;
  }

  /**
   * Gets the cache key for the amount spent today for an {@link IHbarSpendingPlan}.
   * @param id - The ID of the plan to get the key for.
   * @private
   */
  private getSpentTodayKey(id: string): string {
    return `${this.collectionKey}:${id}:spentToday`;
  }

  /**
   * Gets the cache key for the spending history for an {@link IHbarSpendingPlan}.
   * @param id - The ID of the plan to get the key for.
   * @private
   */
  private getSpendingHistoryKey(id: string): string {
    return `${this.collectionKey}:${id}:spendingHistory`;
  }
}
