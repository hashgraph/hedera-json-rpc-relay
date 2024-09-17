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
import { IIPAddressHbarSpendingPlan } from '../../types/hbarLimiter/ipAddressHbarSpendingPlan';
import { IPAddressHbarSpendingPlanNotFoundError } from '../../types/hbarLimiter/errors';
import { IPAddressHbarSpendingPlan } from '../../entities/hbarLimiter/ipAddressHbarSpendingPlan';

export class IPAddressHbarSpendingPlanRepository {
  private readonly collectionKey = 'ipAddressHbarSpendingPlan';
  private readonly threeMonthsInMillis = 90 * 24 * 60 * 60 * 1000;

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
   * Finds an {@link IPAddressHbarSpendingPlan} for an IP address.
   *
   * @param {string} ipAddress - The IP address to search for.
   * @returns {Promise<IPAddressHbarSpendingPlan>} - The associated plan for the IP address.
   */
  async findByAddress(ipAddress: string): Promise<IPAddressHbarSpendingPlan> {
    const key = this.getKey(ipAddress);
    const addressPlan = await this.cache.getAsync<IIPAddressHbarSpendingPlan>(key, 'findByAddress');
    if (!addressPlan) {
      throw new IPAddressHbarSpendingPlanNotFoundError(ipAddress);
    }
    this.logger.trace(`Retrieved IPAddressHbarSpendingPlan with address ${ipAddress}`);
    return new IPAddressHbarSpendingPlan(addressPlan);
  }

  /**
   * Saves an {@link IPAddressHbarSpendingPlan} to the cache, linking the plan to the IP address.
   *
   * @param {IIPAddressHbarSpendingPlan} addressPlan - The plan to save.
   * @returns {Promise<void>} - A promise that resolves when the IP address is linked to the plan.
   */
  async save(addressPlan: IIPAddressHbarSpendingPlan): Promise<void> {
    const key = this.getKey(addressPlan.ipAddress);
    await this.cache.set(key, addressPlan, 'save', this.threeMonthsInMillis);
    this.logger.trace(`Saved IPAddressHbarSpendingPlan with address ${addressPlan.ipAddress}`);
  }

  /**
   * Deletes an {@link IPAddressHbarSpendingPlan} from the cache, unlinking the plan from the IP address.
   *
   * @param {string} ipAddress - The IP address to unlink the plan from.
   * @returns {Promise<void>} - A promise that resolves when the IP address is unlinked from the plan.
   */
  async delete(ipAddress: string): Promise<void> {
    const key = this.getKey(ipAddress);
    await this.cache.delete(key, 'delete');
    this.logger.trace(`Deleted IPAddressHbarSpendingPlan with address ${ipAddress}`);
  }

  /**
   * Gets the cache key for an {@link IPAddressHbarSpendingPlan}.
   *
   * @param {string} ipAddress - The IP address to get the key for.
   * @private
   */
  private getKey(ipAddress: string): string {
    return `${this.collectionKey}:${ipAddress}`;
  }
}
