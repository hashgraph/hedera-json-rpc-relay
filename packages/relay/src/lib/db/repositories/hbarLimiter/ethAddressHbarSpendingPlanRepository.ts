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

import { CacheService } from '../../../services/cacheService/cacheService';
import { Logger } from 'pino';
import { IEthAddressHbarSpendingPlan } from '../../types/hbarLimiter/ethAddressHbarSpendingPlan';
import { EthAddressHbarSpendingPlanNotFoundError } from '../../types/hbarLimiter/errors';
import { EthAddressHbarSpendingPlan } from '../../entities/hbarLimiter/ethAddressHbarSpendingPlan';

export class EthAddressHbarSpendingPlanRepository {
  private readonly collectionKey = 'ethAddressHbarSpendingPlan';
  private readonly oneDayInMillis = 24 * 60 * 60 * 1000;

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
   * Finds an {@link EthAddressHbarSpendingPlan} for an ETH address.
   *
   * @param {string} ethAddress - The ETH address to search for.
   * @returns {Promise<EthAddressHbarSpendingPlan>} - The associated plan for the ETH address.
   */
  async findByAddress(ethAddress: string): Promise<EthAddressHbarSpendingPlan> {
    const key = this.getKey(ethAddress);
    const addressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, 'findByAddress');
    if (!addressPlan) {
      throw new EthAddressHbarSpendingPlanNotFoundError(ethAddress);
    }
    this.logger.trace(`Retrieved EthAddressHbarSpendingPlan with address ${ethAddress}`);
    return new EthAddressHbarSpendingPlan(addressPlan);
  }

  /**
   * Saves an {@link EthAddressHbarSpendingPlan} to the cache, linking the plan to the ETH address.
   *
   * @param {IEthAddressHbarSpendingPlan} addressPlan - The plan to save.
   * @param {number} [ttl] - The time-to-live for the cache entry. (default: 1 day)
   * @returns {Promise<void>} - A promise that resolves when the ETH address is linked to the plan.
   */
  async save(addressPlan: IEthAddressHbarSpendingPlan, ttl: number = this.oneDayInMillis): Promise<void> {
    const key = this.getKey(addressPlan.ethAddress);
    await this.cache.set(key, addressPlan, 'save', ttl);
    this.logger.trace(`Saved EthAddressHbarSpendingPlan with address ${addressPlan.ethAddress}`);
  }

  /**
   * Deletes an {@link EthAddressHbarSpendingPlan} from the cache, unlinking the plan from the ETH address.
   *
   * @param {string} ethAddress - The ETH address to unlink the plan from.
   * @returns {Promise<void>} - A promise that resolves when the ETH address is unlinked from the plan.
   */
  async delete(ethAddress: string): Promise<void> {
    const key = this.getKey(ethAddress);
    await this.cache.delete(key, 'delete');
    this.logger.trace(`Deleted EthAddressHbarSpendingPlan with address ${ethAddress}`);
  }

  /**
   * Gets the cache key for an {@link EthAddressHbarSpendingPlan}.
   *
   * @param {string} ethAddress - The ETH address to get the key for.
   * @private
   */
  private getKey(ethAddress: string): string {
    return `${this.collectionKey}:${ethAddress}`;
  }
}
