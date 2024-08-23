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

import { IHbarSpending } from '../../types/hbarLimiter/hbarSpending';
import { IDetailedHbarLimitPlan, IHbarLimitPlan } from '../../types/hbarLimiter/hbarLimitPlan';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';

export interface IHbarLimitPlanRepository {
  /**
   * Gets a hbar limit plan by ID.
   * @param id - The ID of the plan to get.
   * @returns {Promise<IHbarLimitPlan>} - The hbar limit plan object.
   */
  findById(id: string): Promise<IHbarLimitPlan>;

  /**
   * Gets a hbar limit plan by ID with detailed information (spendingHistory and spentToday).
   * @param id - The ID of the plan.
   * @returns {Promise<IDetailedHbarLimitPlan>} - The detailed hbar limit plan object.
   */
  findByIdWithDetails(id: string): Promise<IDetailedHbarLimitPlan>;

  /**
   * Creates a new hbar limit plan.
   * @param subscriptionType - The subscription type of the plan to create.
   * @returns {Promise<IDetailedHbarLimitPlan>} - The created hbar limit plan object.
   */
  create(subscriptionType: SubscriptionType): Promise<IDetailedHbarLimitPlan>;

  /**
   * Verify that an hbar limit plan exists and is active.
   * @param id - The ID of the plan.
   * @returns {Promise<void>} - A promise that resolves if the plan exists and is active, or rejects if not.
   */
  checkExistsAndActive(id: string): Promise<void>;

  /**
   * Gets the spending history for a hbar limit plan.
   * @param id - The ID of the plan.
   * @returns {Promise<IHbarSpending[]>} - A promise that resolves with the spending history.
   */
  getSpendingHistory(id: string): Promise<IHbarSpending[]>;

  /**
   * Adds spending to a plan's spending history.
   * @param id - The ID of the plan.
   * @param amount - The amount to add to the plan's spending.
   * @returns {Promise<number>} - A promise that resolves with the new length of the spending history.
   */
  addAmountToSpendingHistory(id: string, amount: number): Promise<number>;

  /**
   * Gets the amount spent today for an hbar limit plan.
   * @param id - The ID of the plan.
   * @returns {Promise<number>} - A promise that resolves with the amount spent today.
   */
  getSpentToday(id: string): Promise<number>;

  /**
   * Adds an amount to the amount spent today for a plan.
   * @param id - The ID of the plan.
   * @param amount - The amount to add.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  addAmountToSpentToday(id: string, amount: number): Promise<void>;
}
