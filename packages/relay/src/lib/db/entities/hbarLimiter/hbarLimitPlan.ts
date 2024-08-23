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

import { IDetailedHbarLimitPlan } from '../../types/hbarLimiter/hbarLimitPlan';
import { HbarSpending } from './hbarSpending';
import { SubscriptionType } from '../../types/hbarLimiter/subscriptionType';

export class HbarLimitPlan implements IDetailedHbarLimitPlan {
  id: string;
  subscriptionType: SubscriptionType;
  createdAt: Date;
  active: boolean;
  spendingHistory: HbarSpending[];
  spentToday: number;

  constructor(data: IDetailedHbarLimitPlan) {
    this.id = data.id;
    this.subscriptionType = data.subscriptionType;
    this.createdAt = new Date(data.createdAt);
    this.active = data.active;
    this.spendingHistory = data.spendingHistory?.map((spending) => new HbarSpending(spending)) || [];
    this.spentToday = data.spentToday ?? 0;
  }
}
