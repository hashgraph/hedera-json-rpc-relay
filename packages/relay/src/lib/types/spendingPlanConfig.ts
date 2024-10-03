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
   * The spending plan tier.
   * @type {SubscriptionType}
   */
  subscriptionTier: SubscriptionType;
}
