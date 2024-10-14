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

import LRUCache from 'lru-cache';
import findConfig from 'find-config';
import fs from 'fs';
import { Logger } from 'pino';
import { SpendingPlanConfig } from '../../../types/spendingPlanConfig';

export class CustomLRUCache<K, V> extends LRUCache<K, V> {
  /**
   * Prefix for HbarSpendingPlan keys.
   *
   * @type {string}
   * @private
   */
  private readonly hbarSpendingPlanKeyPrefix = 'hbarSpendingPlan';

  /**
   * Prefix for EthAddressHbarSpendingPlan keys.
   *
   * @type {string}
   * @private
   */
  private readonly ethAddressHbarSpendingPlanKeyPrefix = 'ethAddressHbarSpendingPlan';

  /**
   * Prefix for IpAddressHbarSpendingPlan keys.
   *
   * @type {string}
   * @private
   */
  private readonly ipAddressHbarSpendingPlanKeyPrefix = 'ipAddressHbarSpendingPlan';

  /**
   * The name of the spending plans configuration file. Defaults to `spendingPlansConfig.json`.
   *
   * @type {string}
   * @private
   */
  private readonly SPENDING_PLANS_CONFIG_FILE: string =
    process.env.HBAR_SPENDING_PLANS_CONFIG_FILE || 'spendingPlansConfig.json';

  /**
   * The spending plans configuration. This is loaded from the spending plans configuration file.
   *
   * @type {SpendingPlanConfig[]}
   * @private
   */
  private readonly spendingPlansConfig: SpendingPlanConfig[];

  constructor(
    private readonly logger: Logger,
    options: LRUCache.Options<K, V>,
  ) {
    super(options);
    this.spendingPlansConfig = this.loadSpendingPlansConfig();
  }

  /**
   * Deletes a key from the cache. If the key is protected, the deletion is ignored.
   * @param {K} key - The key to delete.
   * @returns {boolean} - True if the key was deleted, false otherwise.
   * @template K - The key type.
   */
  delete(key: K): boolean {
    if (typeof key === 'string' && this.isKeyProtected(key)) {
      this.logger.trace(`Deletion of key ${key} is ignored as it is protected.`);
      return false;
    }
    return super.delete(key);
  }

  /**
   * Deletes a key from the cache without checking if it is protected.
   * @param {K} key - The key to delete.
   * @returns {boolean} - True if the key was deleted, false otherwise.
   * @template K - The key type.
   */
  deleteUnsafe(key: K): boolean {
    return super.delete(key);
  }

  /**
   * Loads the pre-configured spending plans from the spending plans configuration file.
   * @returns {SpendingPlanConfig[]} - The pre-configured spending plans.
   * @private
   */
  private loadSpendingPlansConfig(): SpendingPlanConfig[] {
    const configPath = findConfig(this.SPENDING_PLANS_CONFIG_FILE);
    if (!configPath || !fs.existsSync(configPath)) {
      this.logger.trace(`Configuration file not found at path "${configPath ?? this.SPENDING_PLANS_CONFIG_FILE}"`);
      return [];
    }
    try {
      const rawData = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(rawData) as SpendingPlanConfig[];
    } catch (error: any) {
      this.logger.error(`Failed to parse JSON from ${configPath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Determines if a key is protected. A key is protected if it is associated with a pre-configured spending plan.
   * @param {string} key - The key to check.
   * @returns {boolean} - True if the key is protected, false otherwise.
   * @private
   */
  private isKeyProtected(key: string): boolean {
    return this.spendingPlansConfig.some((plan) => {
      return (
        this.isPreconfiguredPlanKey(key, plan) ||
        this.isPreconfiguredEthAddressKey(key, plan) ||
        this.isPreconfiguredIpAddressKey(key, plan)
      );
    });
  }

  /**
   * Determines if a key is associated with a pre-configured spending plan.
   * @param {string} key - The key to check.
   * @param {SpendingPlanConfig} plan - The spending plan to check against.
   * @returns {boolean} - True if the key is associated with the spending plan, false otherwise.
   * @private
   */
  private isPreconfiguredPlanKey(key: string, plan: SpendingPlanConfig): boolean {
    return key.includes(`${this.hbarSpendingPlanKeyPrefix}:${plan.id}`);
  }

  /**
   * Determines if a key is associated with a pre-configured ETH address.
   * @param {string} key - The key to check.
   * @param {SpendingPlanConfig} plan - The spending plan to check against.
   * @returns {boolean} - True if the key is associated with the ETH address, false otherwise.
   * @private
   */
  private isPreconfiguredEthAddressKey(key: string, plan: SpendingPlanConfig): boolean {
    return (plan.ethAddresses || []).some((ethAddress) => {
      return key.includes(`${this.ethAddressHbarSpendingPlanKeyPrefix}:${ethAddress.trim().toLowerCase()}`);
    });
  }

  /**
   * Determines if a key is associated with a pre-configured IP address.
   * @param {string} key - The key to check.
   * @param {SpendingPlanConfig} plan - The spending plan to check against.
   * @returns {boolean} - True if the key is associated with the IP address, false otherwise.
   * @private
   */
  private isPreconfiguredIpAddressKey(key: string, plan: SpendingPlanConfig): boolean {
    return (plan.ipAddresses || []).some((ipAddress) => {
      return key.includes(`${this.ipAddressHbarSpendingPlanKeyPrefix}:${ipAddress}`);
    });
  }
}
