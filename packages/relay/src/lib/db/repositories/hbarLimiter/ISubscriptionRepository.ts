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

import { IDetailedSubscription, ISubscription } from '../../entities/hbarLimiter/hbarLimitSubscription';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';
import { IHbarSpending } from '../../types/hbarLimiter/hbarSpending';

export interface ISubscriptionRepository {
  /**
   * Gets a subscription by ID.
   * @param id - The ID of the subscription to get.
   * @returns {Promise<ISubscription>} - The subscription object.
   */
  getSubscriptionById(id: string): Promise<ISubscription>;

  /**
   * Gets a subscription by ID with detailed information.
   * @param id - The ID of the subscription to get.
   * @returns {Promise<IDetailedSubscription>} - The detailed subscription object.
   */
  getDetailedSubscriptionById(id: string): Promise<IDetailedSubscription>;

  /**
   * Creates a new subscription.
   * @param subscriptionType - The type of subscription to create.
   * @returns {Promise<IDetailedSubscription>} - The created subscription object.
   */
  createSubscription(subscriptionType: SubscriptionType): Promise<IDetailedSubscription>;

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
