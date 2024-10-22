/*
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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
import { EthAddressHbarSpendingPlanRepository } from '../../../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../../../db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { HbarSpendingPlanRepository } from '../../../db/repositories/hbarLimiter/hbarSpendingPlanRepository';

export class CustomLRUCache<K extends string, V> extends LRUCache<K, V> {
  /**
   * The name of the spending plans configuration file. Defaults to `spendingPlansConfig.json`.
   *
   * @type {string}
   * @private
   */
  private readonly SPENDING_PLANS_CONFIG_FILE: string =
    process.env.HBAR_SPENDING_PLANS_CONFIG_FILE || 'spendingPlansConfig.json';

  /**
   * The keys that are protected from deletion.
   *
   * @type {Set<string>}
   * @private
   */
  private readonly protectedKeys: Set<string>;

  constructor(
    private readonly logger: Logger,
    options: LRUCache.Options<K, V>,
  ) {
    super(options);
    this.protectedKeys = this.getProtectedKeys();
  }

  /**
   * Deletes a key from the cache. If the key is protected, the deletion is ignored.
   * @param {K} key - The key to delete.
   * @returns {boolean} - True if the key was deleted, false otherwise.
   * @template K - The key type.
   */
  delete(key: K): boolean {
    if (this.protectedKeys.has(key)) {
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
   * Loads the keys that are protected from deletion.
   * @returns {Set<string>} - The protected keys.
   * @private
   */
  private getProtectedKeys(): Set<string> {
    return new Set<string>([...this.getPreconfiguredSpendingPlanKeys()]);
  }

  /**
   * Loads the keys associated with pre-configured spending plans which are protected from deletion.
   * @returns {Set<string>} - The protected keys.
   * @private
   */
  private getPreconfiguredSpendingPlanKeys(): Set<string> {
    return new Set<string>(
      this.loadSpendingPlansConfig().flatMap((plan) => {
        const { id, ethAddresses = [], ipAddresses = [] } = plan;
        return [
          `${HbarSpendingPlanRepository.collectionKey}:${id}`,
          `${HbarSpendingPlanRepository.collectionKey}:${id}:amountSpent`,
          `${HbarSpendingPlanRepository.collectionKey}:${id}:spendingHistory`,
          ...ethAddresses.map((ethAddress) => {
            return `${EthAddressHbarSpendingPlanRepository.collectionKey}:${ethAddress.trim().toLowerCase()}`;
          }),
          ...ipAddresses.map((ipAddress) => {
            return `${IPAddressHbarSpendingPlanRepository.collectionKey}:${ipAddress}`;
          }),
        ];
      }),
    );
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
}
