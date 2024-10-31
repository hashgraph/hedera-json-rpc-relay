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

import fs from 'fs';
import findConfig from 'find-config';
import { isValidSpendingPlanConfig, SpendingPlanConfig } from '../types/spendingPlanConfig';
import { HbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { RequestDetails } from '../types';
import { Logger } from 'pino';
import { SubscriptionTier } from '../db/types/hbarLimiter/subscriptionTier';
import { IDetailedHbarSpendingPlan } from '../db/types/hbarLimiter/hbarSpendingPlan';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';

export class HbarSpendingPlanConfigService {
  /**
   * The time-to-live (TTL) for the pre-configured spending plans in the cache.
   * Defaults to `-1`, which means no TTL, i.e. the data will not expire.
   *
   * @type {number}
   * @private
   */
  private readonly TTL: number = -1;

  /**
   * Creates an instance of `HbarSpendingPlanConfigService`.
   *
   * @constructor
   * @param {Logger} logger - The logger instance.
   * @param {HbarSpendingPlanRepository} hbarSpendingPlanRepository - The repository for HBAR spending plans.
   * @param {EthAddressHbarSpendingPlanRepository} ethAddressHbarSpendingPlanRepository - The repository for ETH address associations.
   * @param {IPAddressHbarSpendingPlanRepository} ipAddressHbarSpendingPlanRepository - The repository for IP address associations.
   */
  constructor(
    private readonly logger: Logger,
    private readonly hbarSpendingPlanRepository: HbarSpendingPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
    private readonly ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
  ) {}

  /**
   * Returns the cache keys for the pre-configured spending plans.
   *
   * @param {Logger} logger - The logger instance.
   * @returns {Set<string>} - A set of cache keys for the pre-configured spending plans.
   */
  public static getPreconfiguredSpendingPlanKeys(logger: Logger): Set<string> {
    try {
      const { collectionKey: hbarSpendingPlanKey } = HbarSpendingPlanRepository;
      const { collectionKey: ethAddressHbarSpendingPlanKey } = EthAddressHbarSpendingPlanRepository;
      const { collectionKey: ipAddressHbarSpendingPlanKey } = IPAddressHbarSpendingPlanRepository;

      return new Set<string>(
        this.loadSpendingPlansConfig(logger).flatMap((plan) => {
          const { id, ethAddresses = [], ipAddresses = [] } = plan;
          return [
            `${hbarSpendingPlanKey}:${id}`,
            `${hbarSpendingPlanKey}:${id}:amountSpent`,
            `${hbarSpendingPlanKey}:${id}:spendingHistory`,
            ...ethAddresses.map((ethAddress) => `${ethAddressHbarSpendingPlanKey}:${ethAddress.trim().toLowerCase()}`),
            ...ipAddresses.map((ipAddress) => `${ipAddressHbarSpendingPlanKey}:${ipAddress}`),
          ];
        }),
      );
    } catch (error: any) {
      logger.error(`Failed to get pre-configured spending plan keys: ${error.message}`);
      return new Set<string>();
    }
  }

  /**
   * Populates the database with pre-configured spending plans.
   *
   * @returns {Promise<number>} - A promise that resolves with the number of spending plans which were added or deleted.
   * @throws {Error} - If the spending plans configuration file is not found or cannot be loaded.
   */
  public async populatePreconfiguredSpendingPlans(): Promise<number> {
    const spendingPlanConfigs = HbarSpendingPlanConfigService.loadSpendingPlansConfig(this.logger);
    if (!spendingPlanConfigs.length) {
      return 0;
    }
    this.validateSpendingPlanConfig(spendingPlanConfigs);

    const requestDetails = new RequestDetails({ requestId: '', ipAddress: '' });
    const existingPlans: IDetailedHbarSpendingPlan[] =
      await this.hbarSpendingPlanRepository.findAllActiveBySubscriptionTier(
        [SubscriptionTier.EXTENDED, SubscriptionTier.PRIVILEGED],
        requestDetails,
      );
    const plansDeleted = await this.deleteObsoletePlans(existingPlans, spendingPlanConfigs, requestDetails);
    const plansAdded = await this.addNewPlans(spendingPlanConfigs, existingPlans, requestDetails);
    await this.updatePlanAssociations(spendingPlanConfigs, requestDetails);

    return plansDeleted + plansAdded;
  }

  /**
   * Loads the pre-configured spending plans from a JSON file.
   *
   * @returns {SpendingPlanConfig[]} An array of spending plan configurations.
   * @throws {Error} If the configuration file is not found or cannot be read or parsed.
   * @private
   */
  private static loadSpendingPlansConfig(logger: Logger): SpendingPlanConfig[] {
    const spendingPlanConfig = ConfigService.get('HBAR_SPENDING_PLANS_CONFIG') as string;

    if (!spendingPlanConfig) {
      throw new Error('HBAR_SPENDING_PLANS_CONFIG is undefined');
    }

    // Try to parse the value directly as JSON
    try {
      return JSON.parse(spendingPlanConfig) as SpendingPlanConfig[];
    } catch (jsonParseError: any) {
      // If parsing as JSON fails, treat it as a file path
      logger.trace(
        `Failed to parse HBAR_SPENDING_PLAN as JSON: ${jsonParseError.message}, now treating it as a file path...`,
      );
      try {
        const configFilePath = findConfig(spendingPlanConfig);
        if (configFilePath && fs.existsSync(configFilePath)) {
          const fileContent = fs.readFileSync(configFilePath, 'utf-8');
          return JSON.parse(fileContent) as SpendingPlanConfig[];
        } else {
          throw new Error(
            `HBAR Spending Configuration file not found at path "${configFilePath ?? spendingPlanConfig}"`,
          );
        }
      } catch (fileError: any) {
        throw new Error(`File error: ${fileError.message}`);
      }
    }
  }

  /**
   * Validates the spending plan configuration.
   *
   * @param {SpendingPlanConfig[]} spendingPlans - The spending plan configurations to validate.
   * @throws {Error} If any spending plan configuration is invalid.
   * @private
   */
  private validateSpendingPlanConfig(spendingPlans: SpendingPlanConfig[]): void {
    for (const plan of spendingPlans) {
      if (!isValidSpendingPlanConfig(plan)) {
        throw new Error(`Invalid spending plan configuration: ${JSON.stringify(plan)}`);
      }
    }
  }

  /**
   * Deletes obsolete HBAR spending plans from the database.
   *
   * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<number>} - A promise that resolves with the number of plans deleted.
   * @private
   */
  private async deleteObsoletePlans(
    existingPlans: IDetailedHbarSpendingPlan[],
    spendingPlanConfigs: SpendingPlanConfig[],
    requestDetails: RequestDetails,
  ): Promise<number> {
    const plansToDelete = existingPlans.filter((plan) => !spendingPlanConfigs.some((spc) => spc.id === plan.id));
    for (const { id } of plansToDelete) {
      this.logger.info(
        `Deleting HBAR spending plan with ID "${id}", as it is no longer in the spending plan configuration...`,
      );
      await this.hbarSpendingPlanRepository.delete(id, requestDetails);
      await this.ethAddressHbarSpendingPlanRepository.deleteAllByPlanId(
        id,
        'populatePreconfiguredSpendingPlans',
        requestDetails,
      );
      await this.ipAddressHbarSpendingPlanRepository.deleteAllByPlanId(
        id,
        'populatePreconfiguredSpendingPlans',
        requestDetails,
      );
    }
    return plansToDelete.length;
  }

  /**
   * Adds new HBAR spending plans to the database.
   *
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<number>} - A promise that resolves with the number of plans added.
   * @private
   */
  private async addNewPlans(
    spendingPlanConfigs: SpendingPlanConfig[],
    existingPlans: IDetailedHbarSpendingPlan[],
    requestDetails: RequestDetails,
  ): Promise<number> {
    const plansToAdd = spendingPlanConfigs.filter((spc) => !existingPlans.some((plan) => plan.id === spc.id));
    for (const { id, name, subscriptionTier } of plansToAdd) {
      await this.hbarSpendingPlanRepository.create(subscriptionTier, requestDetails, this.TTL, id);
      this.logger.info(
        `Created HBAR spending plan "${name}" with ID "${id}" and subscriptionTier "${subscriptionTier}"`,
      );
    }
    return plansToAdd.length;
  }

  /**
   * Updates the associations of HBAR spending plans with ETH and IP addresses.
   *
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @private
   */
  private async updatePlanAssociations(
    spendingPlanConfigs: SpendingPlanConfig[],
    requestDetails: RequestDetails,
  ): Promise<void> {
    for (const planConfig of spendingPlanConfigs) {
      this.logger.trace(
        `Updating associations for HBAR spending plan '${planConfig.name}' with ID ${planConfig.id}...`,
      );
      await this.deleteObsoleteEthAddressAssociations(planConfig, requestDetails);
      await this.deleteObsoleteIpAddressAssociations(planConfig, requestDetails);
      await this.updateEthAddressAssociations(planConfig, requestDetails);
      await this.updateIpAddressAssociations(planConfig, requestDetails);
    }
  }

  /**
   * Updates the associations of an HBAR spending plan with ETH addresses.
   *
   * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @private
   */
  private async updateEthAddressAssociations(
    planConfig: SpendingPlanConfig,
    requestDetails: RequestDetails,
  ): Promise<void> {
    const currentEthAddresses = await this.ethAddressHbarSpendingPlanRepository
      .findAllByPlanId(planConfig.id, 'populatePreconfiguredSpendingPlans', requestDetails)
      .then((ethAddressPlans) => ethAddressPlans.map((plan) => plan.ethAddress));

    const addressesToDelete = currentEthAddresses.filter(
      (ethAddress) => !planConfig.ethAddresses?.includes(ethAddress),
    );
    await Promise.all(
      addressesToDelete.map(async (ethAddress) => {
        await this.ethAddressHbarSpendingPlanRepository.delete(ethAddress, requestDetails);
        this.logger.info(
          `Removed association between ETH address ${ethAddress} and HBAR spending plan '${planConfig.name}'`,
        );
      }),
    );

    const addressesToAdd =
      planConfig.ethAddresses?.filter((ethAddress) => !currentEthAddresses.includes(ethAddress)) || [];
    await Promise.all(
      addressesToAdd.map(async (ethAddress) => {
        await this.ethAddressHbarSpendingPlanRepository.save(
          { ethAddress, planId: planConfig.id },
          requestDetails,
          this.TTL,
        );
        this.logger.info(`Associated HBAR spending plan '${planConfig.name}' with ETH address ${ethAddress}`);
      }),
    );
  }

  /**
   * Updates the associations of an HBAR spending plan with IP addresses.
   *
   * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @private
   */
  private async updateIpAddressAssociations(
    planConfig: SpendingPlanConfig,
    requestDetails: RequestDetails,
  ): Promise<void> {
    const currentIpAddresses = await this.ipAddressHbarSpendingPlanRepository
      .findAllByPlanId(planConfig.id, 'populatePreconfiguredSpendingPlans', requestDetails)
      .then((ipAddressPlans) => ipAddressPlans.map((plan) => plan.ipAddress));

    const addressesToDelete = currentIpAddresses.filter((ipAddress) => !planConfig.ipAddresses?.includes(ipAddress));
    await Promise.all(
      addressesToDelete.map(async (ipAddress) => {
        await this.ipAddressHbarSpendingPlanRepository.delete(ipAddress, requestDetails);
        this.logger.info(`Removed association between IP address and HBAR spending plan '${planConfig.name}'`);
      }),
    );

    const addressesToAdd = planConfig.ipAddresses?.filter((ipAddress) => !currentIpAddresses.includes(ipAddress)) || [];
    await Promise.all(
      addressesToAdd.map(async (ipAddress) => {
        await this.ipAddressHbarSpendingPlanRepository.save(
          { ipAddress, planId: planConfig.id },
          requestDetails,
          this.TTL,
        );
        this.logger.info(`Associated HBAR spending plan '${planConfig.name}' with IP address`);
      }),
    );
  }

  /**
   * Deletes obsolete ETH address associations from the cache.
   *
   * For example, if an ETH address is associated with a plan different from the one in the {@link SPENDING_PLANS_CONFIG_FILE},
   * the association is deleted from the cache to allow the new association from the configuration file to take effect.
   *
   * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @private
   */
  private async deleteObsoleteEthAddressAssociations(planConfig: SpendingPlanConfig, requestDetails: RequestDetails) {
    for (const ethAddress of planConfig.ethAddresses || []) {
      const exists = await this.ethAddressHbarSpendingPlanRepository.existsByAddress(ethAddress, requestDetails);
      if (exists) {
        const ethAddressPlan = await this.ethAddressHbarSpendingPlanRepository.findByAddress(
          ethAddress,
          requestDetails,
        );
        if (ethAddressPlan.planId !== planConfig.id) {
          this.logger.info(
            `Deleting association between ETH address ${ethAddress} and HBAR spending plan '${planConfig.name}'`,
          );
          await this.ethAddressHbarSpendingPlanRepository.delete(ethAddress, requestDetails);
        }
      }
    }
  }

  /**
   * Deletes obsolete IP address associations from the cache.
   *
   * For example, if an IP address is associated with a plan different from the one in the {@link SPENDING_PLANS_CONFIG_FILE},
   * the association is deleted from the cache to allow the new association from the configuration file to take effect.
   *
   * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @private
   */
  private async deleteObsoleteIpAddressAssociations(planConfig: SpendingPlanConfig, requestDetails: RequestDetails) {
    for (const ipAddress of planConfig.ipAddresses || []) {
      const exists = await this.ipAddressHbarSpendingPlanRepository.existsByAddress(ipAddress, requestDetails);
      if (exists) {
        const ipAddressPlan = await this.ipAddressHbarSpendingPlanRepository.findByAddress(ipAddress, requestDetails);
        if (ipAddressPlan.planId !== planConfig.id) {
          this.logger.info(`Deleting association between IP address and HBAR spending plan '${planConfig.name}'`);
          await this.ipAddressHbarSpendingPlanRepository.delete(ipAddress, requestDetails);
        }
      }
    }
  }
}
