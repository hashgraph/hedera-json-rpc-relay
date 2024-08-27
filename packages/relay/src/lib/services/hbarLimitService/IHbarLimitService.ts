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

export interface IHbarLimitService {
  /**
   * Resets the Hbar limiter.
   */
  resetLimiter(): Promise<void>;

  /**
   * Determines if the Hbar limit should be applied based on the provided Ethereum address
   * and optionally an IP address.
   *
   * @param {string} ethAddress - The Ethereum address to check.
   * @param {string} [ipAddress] - The optional IP address to check.
   * @returns {Promise<boolean>} - True if the limit should be applied, false otherwise.
   */
  shouldLimit(ethAddress: string, ipAddress?: string): Promise<boolean>;
}
