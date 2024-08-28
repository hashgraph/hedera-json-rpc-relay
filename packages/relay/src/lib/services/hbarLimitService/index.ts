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

import { IHbarLimitService } from './IHbarLimitService';
import { HbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IDetailedHbarSpendingPlan } from '../../db/types/hbarLimiter/hbarSpendingPlan';
import { SubscriptionType } from '../../db/types/hbarLimiter/subscriptionType';
import { Logger } from 'pino';
import { formatRequestIdMessage } from '../../../formatters';

export class HbarLimitService implements IHbarLimitService {
  // TODO: Replace with actual values
  private static readonly DAILY_LIMITS: Record<SubscriptionType, number> = {
    BASIC: parseInt(process.env.HBAR_DAILY_LIMIT_BASIC ?? '1000'),
    EXTENDED: parseInt(process.env.HBAR_DAILY_LIMIT_EXTENDED ?? '10000'),
    PRIVILEGED: parseInt(process.env.HBAR_DAILY_LIMIT_PRIVILEGED ?? '100000'),
  };

  constructor(
    private readonly hbarSpendingPlanRepository: HbarSpendingPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
    private readonly logger: Logger,
  ) {}

  /**
   * Resets the {@link HbarSpendingPlan#spentToday} field for all existing plans.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  async resetLimiter(): Promise<void> {
    // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2868
    throw new Error('Not implemented');
  }

  /**
   * Checks if the given eth address or ip address should be limited.
   * @param {string} ethAddress - The eth address to check.
   * @param {string} [ipAddress] - The ip address to check.
   * @param {string} [requestId] - A prefix to include in log messages (optional).
   * @returns {Promise<boolean>} - A promise that resolves with a boolean indicating if the address should be limited.
   */
  async shouldLimit(ethAddress: string, ipAddress?: string, requestId?: string): Promise<boolean> {
    if (!ethAddress && !ipAddress) {
      this.logger.warn('No eth address or ip address provided, cannot check if address should be limited');
      return false;
    }
    const requestIdPrefix = formatRequestIdMessage(requestId);
    const user = `(ethAddress=${ethAddress}, ipAddress=${ipAddress})`;
    this.logger.trace(`${requestIdPrefix} Checking if ${user} should be limited...`);
    let spendingPlan = await this.getSpendingPlan(ethAddress, ipAddress);
    if (!spendingPlan) {
      // Create a basic spending plan if none exists for the eth address or ip address
      spendingPlan = await this.createBasicSpendingPlan(ethAddress, ipAddress);
    }
    const dailyLimit = HbarLimitService.DAILY_LIMITS[spendingPlan.subscriptionType];
    const exceedsLimit = spendingPlan.spentToday >= dailyLimit;
    this.logger.trace(
      `${requestIdPrefix} ${user} ${exceedsLimit ? 'should' : 'should not'} be limited, spentToday=${
        spendingPlan.spentToday
      }, limit=${dailyLimit}`,
    );
    return exceedsLimit;
  }

  /**
   * Gets the spending plan for the given eth address or ip address.
   * @param {string} ethAddress - The eth address to get the spending plan for.
   * @param {string} [ipAddress] - The ip address to get the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan | null>} - A promise that resolves with the spending plan or null if none exists.
   * @private
   */
  private async getSpendingPlan(ethAddress: string, ipAddress?: string): Promise<IDetailedHbarSpendingPlan | null> {
    if (ethAddress) {
      try {
        return await this.getSpendingPlanByEthAddress(ethAddress);
      } catch (error) {
        this.logger.warn(error, `Failed to get spending plan for eth address '${ethAddress}'`);
      }
    }
    if (ipAddress) {
      // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2888
    }
    return null;
  }

  /**
   * Gets the spending plan for the given eth address.
   * @param {string} ethAddress - The eth address to get the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - A promise that resolves with the spending plan.
   * @private
   */
  private async getSpendingPlanByEthAddress(ethAddress: string): Promise<IDetailedHbarSpendingPlan> {
    const ethAddressHbarSpendingPlan = await this.ethAddressHbarSpendingPlanRepository.findByAddress(ethAddress);
    return this.hbarSpendingPlanRepository.findByIdWithDetails(ethAddressHbarSpendingPlan.planId);
  }

  /**
   * Creates a basic spending plan for the given eth address.
   * @param {string} ethAddress - The eth address to create the spending plan for.
   * @param {stirng} [ipAddress] - The ip address to create the spending plan for.
   * @returns {Promise<IDetailedHbarSpendingPlan>} - A promise that resolves with the created spending plan.
   * @private
   */
  private async createBasicSpendingPlan(ethAddress: string, ipAddress?: string): Promise<IDetailedHbarSpendingPlan> {
    if (!ethAddress && !ipAddress) {
      throw new Error('Cannot create a spending plan without an associated eth address or ip address');
    }
    const spendingPlan = await this.hbarSpendingPlanRepository.create(SubscriptionType.BASIC);
    if (ethAddress) {
      this.logger.trace(`Linking spending plan with ID ${spendingPlan.id} to eth address ${ethAddress}`);
      await this.ethAddressHbarSpendingPlanRepository.save({ ethAddress, planId: spendingPlan.id });
    } else if (ipAddress) {
      this.logger.trace(`Linking spending plan with ID ${spendingPlan.id} to ip address ${ipAddress}`);
      // TODO: Implement this with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2888
      // await this.ipAddressHbarSpendingPlanRepository.save({ ipAddress, planId: spendingPlan.id });
    }
    return spendingPlan;
  }
}
