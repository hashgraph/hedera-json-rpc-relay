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
import { HbarLimitPlanRepository } from '../../db/repositories/hbarLimiter/HbarLimitPlanRepository';
import { EthAddressPlanRepository } from '../../db/repositories/hbarLimiter/EthAddressPlanRepository';
import { IDetailedHbarSpendingPlan } from '../../db/types/hbarLimiter/hbarSpendingPlan';
import { SubscriptionType } from '../../db/types/hbarLimiter/subscriptionType';
import { Logger } from 'pino';

export class HbarLimitService implements IHbarLimitService {
  // TODO: Replace with actual values
  private static readonly DAILY_LIMITS: Record<SubscriptionType, number> = {
    BASIC: parseInt(process.env.HBAR_DAILY_LIMIT_BASIC ?? '1000'),
    EXTENDED: parseInt(process.env.HBAR_DAILY_LIMIT_EXTENDED ?? '10000'),
    PRIVILEGED: parseInt(process.env.HBAR_DAILY_LIMIT_PRIVILEGED ?? '100000'),
  };

  constructor(
    private readonly hbarSpendingPlanRepository: HbarLimitPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressPlanRepository,
    private readonly logger: Logger,
  ) {}

  async resetLimiter(): Promise<void> {
    // TODO: Implement this
    throw new Error('Not implemented');
  }

  async shouldLimit(ethAddress: string, ipAddress?: string): Promise<boolean> {
    let spendingPlan = await this.getSpendingPlan(ethAddress, ipAddress);
    if (!spendingPlan) {
      // Create a basic spending plan if none exists for the eth address or ip address
      spendingPlan = await this.createBasicSpendingPlan(ethAddress);
    }
    return spendingPlan.spentToday >= HbarLimitService.DAILY_LIMITS[spendingPlan.subscriptionType];
  }

  private async getSpendingPlan(ethAddress: string, ipAddress?: string): Promise<IDetailedHbarSpendingPlan | null> {
    if (ethAddress) {
      try {
        return await this.getSpendingPlanByEthAddress(ethAddress);
      } catch (error) {
        this.logger.warn(error, `Failed to get spending plan for eth address '${ethAddress}'`);
      }
    }
    if (ipAddress) {
      // TODO: Implement this
    }
    return null;
  }

  private async getSpendingPlanByEthAddress(ethAddress: string): Promise<IDetailedHbarSpendingPlan> {
    const ethAddressPlan = await this.ethAddressHbarSpendingPlanRepository.findByAddress(ethAddress);
    return this.hbarSpendingPlanRepository.findByIdWithDetails(ethAddressPlan.planId);
  }

  private async createBasicSpendingPlan(ethAddress: string): Promise<IDetailedHbarSpendingPlan> {
    const spendingPlan = await this.hbarSpendingPlanRepository.create(SubscriptionType.BASIC);
    await this.ethAddressHbarSpendingPlanRepository.save({ ethAddress, planId: spendingPlan.id });
    return spendingPlan;
  }
}
