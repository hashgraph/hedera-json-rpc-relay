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

import { SubscriptionType } from '../db/types/hbarLimiter/subscriptionType';

/**
 * Represents the configuration for a spending plan.
 * Pre-configured spending plans are specified in a `spendingPlansConfig.json` file in the root of the project.
 * @interface SpendingPlanConfig
 */
export interface SpendingPlanConfig {
  /**
   * The unique identifier for the spending plan.
   */
  id: string;

  /**
   * The name of the spending plan.
   * @type {string}
   */
  name: string;

  /**
   * ETH addresses associated with the spending plan.
   * @type {string[]}
   * @optional
   */
  ethAddresses?: string[];

  /**
   * IP addresses associated with the spending plan.
   * @type {string[]}
   * @optional
   */
  ipAddresses?: string[];

  /**
   * The subscription tier associated with the spending plan.
   * @type {SubscriptionType}
   */
  subscriptionType: SubscriptionType;
}

/**
 * Determines if the provided object is a valid spending plan configuration.
 * @param plan - The object to validate.
 * @returns {boolean} - True if the object is a valid {@link SpendingPlanConfig}, false otherwise.
 */
export function isValidSpendingPlanConfig(plan: any): plan is SpendingPlanConfig {
  return (
    plan &&
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.subscriptionType === 'string' &&
    Object.values(SubscriptionType).includes(plan.subscriptionType) &&
    ((Array.isArray(plan.ethAddresses) && plan.ethAddresses.length > 0) ||
      (Array.isArray(plan.ipAddresses) && plan.ipAddresses.length > 0))
  );
}
