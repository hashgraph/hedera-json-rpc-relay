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
import { IEthAddressPlan } from '../../types/hbarLimiter/ethAddressPlan';
import { EthAddressPlanNotFoundError } from '../../types/hbarLimiter/errors';
import { EthAddressPlan } from '../../entities/hbarLimiter/ethAddressPlan';

export class EthAddressPlanRepository {
  private readonly collectionKey = 'ethAddressPlan';
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

  async findByAddress(ethAddress: string): Promise<IEthAddressPlan> {
    const key = this.getKey(ethAddress);
    const addressPlan = await this.cache.getAsync<IEthAddressPlan>(key, 'findByAddress');
    if (!addressPlan) {
      throw new EthAddressPlanNotFoundError(ethAddress);
    }
    this.logger.trace(`Retrieved EthAddressPlan with address ${ethAddress}`);
    return new EthAddressPlan(addressPlan);
  }

  async save(addressPlan: IEthAddressPlan): Promise<void> {
    const key = this.getKey(addressPlan.ethAddress);
    await this.cache.set(key, addressPlan, 'save', this.threeMonthsInMillis);
    this.logger.trace(`Saved EthAddressPlan with address ${addressPlan.ethAddress}`);
  }

  async delete(ethAddress: string): Promise<void> {
    const key = this.getKey(ethAddress);
    await this.cache.delete(key, 'delete');
    this.logger.trace(`Deleted EthAddressPlan with address ${ethAddress}`);
  }

  private getKey(ethAddress: string): string {
    return `${this.collectionKey}:${ethAddress}`;
  }
}
