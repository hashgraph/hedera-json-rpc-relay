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
import { RequestDetails } from '../../../types';

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
   * Checks if an {@link EthAddressHbarSpendingPlan} exists for an ETH address.
   *
   * @param {string} ethAddress - The ETH address to check for.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<boolean>} - A promise that resolves with a boolean indicating if the plan exists.
   */
  async existsByAddress(ethAddress: string, requestDetails: RequestDetails): Promise<boolean> {
    const key = this.getKey(ethAddress);
    const addressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, 'existsByAddress', requestDetails);
    return !!addressPlan;
  }

  /**
   * Finds all ETH addresses associated with a spending plan.
   * @param {string} planId - The ID of the spending plan to search for.
   * @param {string} callingMethod - The method calling this function.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<EthAddressHbarSpendingPlan[]>} - A promise that resolves with an array of associated plans.
   */
  async findAllByPlanId(
    planId: string,
    callingMethod: string,
    requestDetails: RequestDetails,
  ): Promise<EthAddressHbarSpendingPlan[]> {
    const ethAddressPlans: EthAddressHbarSpendingPlan[] = [];
    const key = this.getKey('*');
    const keys = await this.cache.keys(key, callingMethod, requestDetails);
    for (const key of keys) {
      const addressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, callingMethod, requestDetails);
      if (addressPlan?.planId === planId) {
        ethAddressPlans.push(new EthAddressHbarSpendingPlan(addressPlan));
      }
    }
    return ethAddressPlans;
  }

  /**
   * Deletes all ETH addresses associated with a spending plan.
   * @param planId - The ID of the spending plan to search for.
   * @param callingMethod - The method calling this function.
   * @param requestDetails - The request details for logging and tracking.
   */
  async deleteAllByPlanId(planId: string, callingMethod: string, requestDetails: RequestDetails): Promise<void> {
    const key = this.getKey('*');
    const keys = await this.cache.keys(key, callingMethod, requestDetails);
    for (const key of keys) {
      const addressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, callingMethod, requestDetails);
      if (addressPlan?.planId === planId) {
        this.logger.trace(
          `${requestDetails.formattedRequestId} Removing ETH address ${addressPlan.ethAddress} from HbarSpendingPlan with ID ${planId}`,
        );
        await this.cache.delete(key, callingMethod, requestDetails);
      }
    }
  }

  /**
   * Finds an {@link EthAddressHbarSpendingPlan} for an ETH address.
   *
   * @param {string} ethAddress - The ETH address to search for.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<EthAddressHbarSpendingPlan>} - The associated plan for the ETH address.
   */
  async findByAddress(ethAddress: string, requestDetails: RequestDetails): Promise<EthAddressHbarSpendingPlan> {
    const key = this.getKey(ethAddress);
    const addressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, 'findByAddress', requestDetails);
    if (!addressPlan) {
      throw new EthAddressHbarSpendingPlanNotFoundError(ethAddress);
    }
    this.logger.trace(
      `${requestDetails.formattedRequestId} Retrieved link between ETH address ${ethAddress} and HbarSpendingPlan with ID ${addressPlan.planId}`,
    );
    return new EthAddressHbarSpendingPlan(addressPlan);
  }

  /**
   * Saves an {@link EthAddressHbarSpendingPlan} to the cache, linking the plan to the ETH address.
   *
   * @param {IEthAddressHbarSpendingPlan} addressPlan - The plan to save.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @param {number} ttl - The time-to-live for the cache entry.
   * @returns {Promise<void>} - A promise that resolves when the ETH address is linked to the plan.
   */
  async save(addressPlan: IEthAddressHbarSpendingPlan, requestDetails: RequestDetails, ttl: number): Promise<void> {
    const key = this.getKey(addressPlan.ethAddress);
    await this.cache.set(key, addressPlan, 'save', requestDetails, ttl);
    this.logger.trace(
      `${requestDetails.formattedRequestId} Linked ETH address ${addressPlan.ethAddress} to HbarSpendingPlan with ID ${addressPlan.planId}`,
    );
  }

  /**
   * Deletes an {@link EthAddressHbarSpendingPlan} from the cache, unlinking the plan from the ETH address.
   *
   * @param {string} ethAddress - The ETH address to unlink the plan from.
   * @param {RequestDetails} requestDetails - The request details for logging and tracking.
   * @returns {Promise<void>} - A promise that resolves when the ETH address is unlinked from the plan.
   */
  async delete(ethAddress: string, requestDetails: RequestDetails): Promise<void> {
    const key = this.getKey(ethAddress);
    const ethAddressPlan = await this.cache.getAsync<IEthAddressHbarSpendingPlan>(key, 'delete', requestDetails);
    await this.cache.delete(key, 'delete', requestDetails);
    const errorMessage = ethAddressPlan
      ? `Removed ETH address ${ethAddress} from HbarSpendingPlan with ID ${ethAddressPlan.planId}`
      : `Trying to remove ETH address ${ethAddress}, which is not linked to a spending plan`;
    this.logger.trace(`${requestDetails.formattedRequestId} ${errorMessage}`);
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
