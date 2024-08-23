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

import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';
import {
  HbarLimitSubscription,
  IDetailedSubscription,
  ISubscription,
} from '../../entities/hbarLimiter/hbarLimitSubscription';
import { randomBytes, uuidV4 } from 'ethers';
import { Logger } from 'pino';
import { HbarSpending, IHbarSpending } from '../../types/hbarLimiter/hbarSpending';
import { CacheService } from '../../../services/cacheService/cacheService';
import { ISubscriptionRepository } from './ISubscriptionRepository';
import { SubscriptionNotActiveError, SubscriptionNotFoundError } from '../../types/hbarLimiter/errors';

export class SubscriptionRepository implements ISubscriptionRepository {
  private readonly collectionKey = 'hbarLimitSubscription';
  private readonly oneDayInMillis = 24 * 60 * 60 * 1000;
  private readonly fourMonthsInMillis = this.oneDayInMillis * 120;

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

  async getSubscriptionById(id: string): Promise<ISubscription> {
    const key = this.getSubscriptionKey(id);
    const subscription = await this.cache.getAsync<ISubscription>(key, 'getSubscriptionById');
    if (!subscription) {
      throw new SubscriptionNotFoundError(id);
    }
    this.logger.trace(`Retrieved subscription with ID ${id}`);
    return {
      ...subscription,
      createdAt: new Date(subscription.createdAt),
    };
  }

  async getDetailedSubscriptionById(id: string): Promise<IDetailedSubscription> {
    const subscription = await this.getSubscriptionById(id);
    return new HbarLimitSubscription({
      ...subscription,
      spendingHistory: await this.getSpendingHistory(id),
      spentToday: await this.getSpentToday(id),
    });
  }

  async createSubscription(subscriptionType: SubscriptionType): Promise<IDetailedSubscription> {
    const subscription: IDetailedSubscription = {
      id: uuidV4(randomBytes(16)),
      subscriptionType,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 0,
    };
    this.logger.trace(`Creating subscription with ID ${subscription.id}...`);
    const key = this.getSubscriptionKey(subscription.id);
    await this.cache.set(key, subscription, 'createSubscription', this.fourMonthsInMillis);
    return new HbarLimitSubscription(subscription);
  }

  async checkExistsAndActive(id: string): Promise<void> {
    const subscription = await this.getSubscriptionById(id);
    if (!subscription.active) {
      throw new SubscriptionNotActiveError(id);
    }
  }

  async getSpendingHistory(id: string): Promise<IHbarSpending[]> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spending history for subscription with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const spendingHistory = await this.cache.lRange<IHbarSpending>(key, 0, -1, 'getSpendingHistory');
    return spendingHistory.map((entry) => new HbarSpending(entry));
  }

  async addAmountToSpendingHistory(id: string, amount: number): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Adding ${amount} to spending history for subscription with ID ${id}...`);
    const key = this.getSpendingHistoryKey(id);
    const entry: IHbarSpending = { amount, timestamp: new Date() };
    return this.cache.rPush(key, entry, 'addAmountToSpendingHistory');
  }

  async getSpentToday(id: string): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spentToday for subscription with ID ${id}...`);
    const key = this.getSpentTodayKey(id);
    return this.cache.getAsync(key, 'getSpentToday').then((spentToday) => parseInt(spentToday ?? '0'));
  }

  async addAmountToSpentToday(id: string, amount: number): Promise<void> {
    await this.checkExistsAndActive(id);

    const key = this.getSpentTodayKey(id);
    if (!(await this.cache.getAsync(key, 'addAmountToSpentToday'))) {
      this.logger.trace(`No spending yet for subscription with ID ${id}, setting spentToday to ${amount}...`);
      await this.cache.set(key, amount, 'addAmmountToSpentToday', this.oneDayInMillis);
    } else {
      this.logger.trace(`Adding ${amount} to spentToday for subscription with ID ${id}...`);
      await this.cache.incrBy(key, amount, 'addAmountToSpentToday');
    }
  }

  private getSpentTodayKey(id: string): string {
    return `${this.collectionKey}:${id}:spentToday`;
  }

  private getSpendingHistoryKey(id: string): string {
    return `${this.collectionKey}:${id}:spendingHistory`;
  }

  private getSubscriptionKey(id: string): string {
    return `${this.collectionKey}:${id}`;
  }
}
