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
import { RedisClientType } from 'redis';
import { randomBytes, uuidV4 } from 'ethers';
import { Logger } from 'pino';
import { HbarSpending, IHbarSpending } from '../../types/hbarLimiter/hbarSpending';

export interface ISubscriptionRepository {
  /**
   * Gets a subscription by ID.
   * @param id - The ID of the subscription to get.
   * @returns {Promise<ISubscription>} - The subscription object, or null if not found.
   */
  getDetailedSubscriptionById(id: string): Promise<IDetailedSubscription>;

  /**
   * Creates a new subscription.
   * @param subscriptionType - The type of subscription to create.
   * @returns {Promise<ISubscription>} - The created subscription object.
   */
  createSubscription(subscriptionType: SubscriptionType): Promise<ISubscription>;

  /**
   * Verify that a subscription exists and is active.
   * @param id - The ID of the subscription to check.
   * @returns {Promise<void>} - A promise that resolves if the subscription exists and is active, or rejects if not.
   */
  checkExistsAndActive(id: string): Promise<void>;

  /**
   * Gets the spending history for a subscription.
   * @param id - The ID of the subscription to get the spending history for.
   * @returns {Promise<IHbarSpending[]>} - A promise that resolves with the spending history.
   */
  getSpendingHistory(id: string): Promise<IHbarSpending[]>;

  /**
   * Adds spending to a subscription.
   * @param id - The ID of the subscription to add spending to.
   * @param amount - The amount to add to the subscription's spending.
   * @returns {Promise<number>} - A promise that resolves with the new length of the spending history.
   */
  addAmountToSpendingHistory(id: string, amount: number): Promise<number>;

  /**
   * Gets the spentToday field of a subscription.
   * @param id - The ID of the subscription to get the spentToday field for.
   * @returns {Promise<number>} - A promise that resolves with the spentToday field.
   */
  getSpentToday(id: string): Promise<number>;

  /**
   * Updates the spentToday field of a subscription.
   * @param id - The ID of the subscription to update.
   * @param amount - The amount to add to the subscription's spentToday field.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  addAmountToSpentToday(id: string, amount: number): Promise<void>;
}

export class SubscriptionRepository implements ISubscriptionRepository {
  private readonly collectionKey = 'hbarLimitSubscription';
  private readonly oneDayInSeconds = 24 * 60 * 60;

  /**
   * The Redis client.
   * @private
   */
  private readonly client: RedisClientType;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  constructor(client: RedisClientType, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  async getDetailedSubscriptionById(id: string): Promise<HbarLimitSubscription> {
    return new HbarLimitSubscription({
      ...(await this.getSubscriptionById(id)),
      spendingHistory: await this.getSpendingHistory(id),
      spentToday: await this.getSpentToday(id),
    });
  }

  async createSubscription(subscriptionType: SubscriptionType): Promise<HbarLimitSubscription> {
    const subscription: IDetailedSubscription = {
      id: uuidV4(randomBytes(16)),
      subscriptionType,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 0,
    };
    this.logger.trace(`Creating subscription with ID ${subscription.id}...`);
    await this.client.hSet(this.collectionKey, subscription.id, JSON.stringify(subscription));
    return new HbarLimitSubscription(subscription);
  }

  async checkExistsAndActive(id: string): Promise<void> {
    const subscription = await this.getSubscriptionById(id);
    if (!subscription) {
      throw new Error(`Subscription with ID ${id} not found`);
    }
    if (!subscription.active) {
      throw new Error(`Subscription with ID ${id} is not active`);
    }
  }

  async getSpendingHistory(id: string): Promise<HbarSpending[]> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spending history for subscription with ID ${id}...`);
    const key: string = `${this.collectionKey}:${id}:spendingHistory`;
    if (!(await this.client.exists(key))) {
      return [];
    }

    const spendingHistory: string[] = (await this.client.lRange(key, 0, -1)) ?? [];
    return spendingHistory.map((entry) => new HbarSpending(JSON.parse(entry)));
  }

  async addAmountToSpendingHistory(id: string, amount: number): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Adding ${amount} to spending history for subscription with ID ${id}...`);
    const key: string = `${this.collectionKey}:${id}:spendingHistory`;
    const entry: IHbarSpending = { amount, timestamp: new Date() };
    return this.client.rPush(key, JSON.stringify(entry));
  }

  async getSpentToday(id: string): Promise<number> {
    await this.checkExistsAndActive(id);

    this.logger.trace(`Retrieving spentToday for subscription with ID ${id}...`);
    const key: string = `${this.collectionKey}:${id}:spentToday`;
    return this.client.get(key).then((spentToday) => parseInt(spentToday ?? '0'));
  }

  async addAmountToSpentToday(id: string, amount: number): Promise<void> {
    await this.checkExistsAndActive(id);

    const key: string = `${this.collectionKey}:${id}:spentToday`;
    if (!(await this.client.exists(key))) {
      this.logger.trace(`No spending yet for subscription with ID ${id}, setting spentToday to ${amount}...`);
      await this.client.set(key, amount.toString(), { EX: this.oneDayInSeconds });
      return;
    } else {
      this.logger.trace(`Adding ${amount} to spentToday for subscription with ID ${id}...`);
      await this.client.incrBy(key, amount);
    }
  }

  private async getSubscriptionById(id: string): Promise<ISubscription> {
    const subscription = await this.client.hGet(this.collectionKey, id);
    if (!subscription) {
      throw new Error(`Subscription with ID ${id} not found`);
    }
    this.logger.trace(`Retrieved subscription with ID ${id}`);
    return JSON.parse(subscription);
  }
}
