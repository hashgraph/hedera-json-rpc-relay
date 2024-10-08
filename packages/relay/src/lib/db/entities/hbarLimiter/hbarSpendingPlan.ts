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

import { IDetailedHbarSpendingPlan } from '../../types/hbarLimiter/hbarSpendingPlan';
import { HbarSpendingRecord } from './hbarSpendingRecord';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';

export class HbarSpendingPlan implements IDetailedHbarSpendingPlan {
  id: string;
  subscriptionType: SubscriptionType;
  createdAt: Date;
  active: boolean;
  spendingHistory: HbarSpendingRecord[];
  amountSpent: number;

  constructor(data: IDetailedHbarSpendingPlan) {
    this.id = data.id;
    this.subscriptionType = data.subscriptionType;
    this.createdAt = new Date(data.createdAt);
    this.active = data.active;
    this.spendingHistory = data.spendingHistory?.map((spending) => new HbarSpendingRecord(spending)) || [];
    this.amountSpent = data.amountSpent ?? 0;
  }
}
