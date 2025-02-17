// SPDX-License-Identifier: Apache-2.0

import { IDetailedHbarSpendingPlan } from '../../types/hbarLimiter/hbarSpendingPlan';
import { HbarSpendingRecord } from './hbarSpendingRecord';
import { SubscriptionTier } from '../../types/hbarLimiter/subscriptionTier';

export class HbarSpendingPlan implements IDetailedHbarSpendingPlan {
  id: string;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
  active: boolean;
  spendingHistory: HbarSpendingRecord[];
  amountSpent: number;

  constructor(data: IDetailedHbarSpendingPlan) {
    this.id = data.id;
    this.subscriptionTier = data.subscriptionTier;
    this.createdAt = new Date(data.createdAt);
    this.active = data.active;
    this.spendingHistory = data.spendingHistory?.map((spending) => new HbarSpendingRecord(spending)) || [];
    this.amountSpent = data.amountSpent ?? 0;
  }
}
