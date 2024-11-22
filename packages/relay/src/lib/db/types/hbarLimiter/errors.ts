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

export class HbarSpendingPlanNotFoundError extends Error {
  constructor(id: string) {
    super(`HbarSpendingPlan with ID ${id} not found`);
    this.name = 'HbarSpendingPlanNotFoundError';
  }
}

export class HbarSpendingPlanNotActiveError extends Error {
  constructor(id: string) {
    super(`HbarSpendingPlan with ID ${id} is not active`);
    this.name = 'HbarSpendingPlanNotActiveError';
  }
}

export class EvmAddressHbarSpendingPlanNotFoundError extends Error {
  constructor(evmAddress: string) {
    super(`EvmAddressHbarSpendingPlan with address ${evmAddress} not found`);
    this.name = 'EvmAddressHbarSpendingPlanNotFoundError';
  }
}

export class IPAddressHbarSpendingPlanNotFoundError extends Error {
  constructor(ipAddress: string) {
    super(`IPAddressHbarSpendingPlan not found`);
    this.name = 'IPAddressHbarSpendingPlanNotFoundError';
  }
}
