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
import { RequestDetails } from '../../../types';

export class IPAddressHbarSpendingPlanRepository {
  private readonly collectionKey = 'ipAddressHbarSpendingPlan';

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
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<IPAddressHbarSpendingPlan>} - The associated plan for the IP address.
   */
  async findByAddress(ipAddress: string, requestDetails: RequestDetails): Promise<IPAddressHbarSpendingPlan> {
    const key = this.getKey(ipAddress);
    const addressPlan = await this.cache.getAsync<IIPAddressHbarSpendingPlan>(key, 'findByAddress', requestDetails);
    if (!addressPlan) {
      throw new IPAddressHbarSpendingPlanNotFoundError(ipAddress);
    }
    this.logger.trace(`Retrieved link between IP address and HbarSpendingPlan with ID ${addressPlan.planId}`);
    return new IPAddressHbarSpendingPlan(addressPlan);
  }

  /**
   * Saves an {@link IPAddressHbarSpendingPlan} to the cache, linking the plan to the IP address.
   *
   * @param {IIPAddressHbarSpendingPlan} addressPlan - The plan to save.
   * @param {RequestDetails} requestDetails - The request details used for logging and tracking.
   * @param {number} ttl - The time-to-live for the cache entry.
   * @returns {Promise<void>} - A promise that resolves when the IP address is linked to the plan.
   */
  async save(addressPlan: IIPAddressHbarSpendingPlan, requestDetails: RequestDetails, ttl: number): Promise<void> {
    const key = this.getKey(addressPlan.ipAddress);
    await this.cache.set(key, addressPlan, 'save', requestDetails, ttl);
    this.logger.trace(`Linked new IP address to HbarSpendingPlan with ID ${addressPlan.planId}`);
  }

  /**
   * Deletes an {@link IPAddressHbarSpendingPlan} from the cache, unlinking the plan from the IP address.
   *
   * @param {string} ipAddress - The IP address to unlink the plan from.
   * @returns {Promise<void>} - A promise that resolves when the IP address is unlinked from the plan.
   */
  async delete(ipAddress: string, requestDetails: RequestDetails): Promise<void> {
    const key = this.getKey(ipAddress);
    const ipAddressSpendingPlan = await this.cache.getAsync<IIPAddressHbarSpendingPlan>(key, 'delete', requestDetails);
    await this.cache.delete(key, 'delete', requestDetails);
    const errorMessage = ipAddressSpendingPlan
      ? `Removed IP address from HbarSpendingPlan with ID ${ipAddressSpendingPlan.planId}`
      : `Trying to remove an IP address, which is not linked to a spending plan`;
    this.logger.trace(errorMessage);
  }

  /**
   * Gets all IP address spending plans from the cache.
   *
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<IPAddressHbarSpendingPlan[]>} - A promise that resolves with an array of IP address spending plans.
   */
  async getAllPlans(requestDetails: RequestDetails): Promise<IPAddressHbarSpendingPlan[]> {
    const pattern = `${this.collectionKey}:*`;
    const keys = await this.cache.keys(pattern, 'getAllPlans', requestDetails);
    const plans = await Promise.all(
      keys.map((key) => this.cache.getAsync<IIPAddressHbarSpendingPlan>(key, 'getAllPlans', requestDetails)),
    );
    return plans.filter((plan) => plan !== null).map((plan) => new IPAddressHbarSpendingPlan(plan));
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
