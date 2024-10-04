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
import { SubscriptionType } from '../db/types/hbarLimiter/subscriptionType';
import { IDetailedHbarSpendingPlan } from '../db/types/hbarLimiter/hbarSpendingPlan';

export class HbarSpendingPlanConfigService {
  private readonly TTL = -1; // -1 means no TTL, i.e. the data will not expire
  private readonly DEFAULT_SPENDING_PLANS_CONFIG_FILE = 'spendingPlansConfig.json';

  constructor(
    private readonly logger: Logger,
    private readonly hbarSpendingPlanRepository: HbarSpendingPlanRepository,
    private readonly ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
    private readonly ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
  ) {}

  /**
   * Loads the pre-configured spending plans from a JSON file.
   * @returns {SpendingPlanConfig[]} An array of spending plan configurations.
   * @throws {Error} If the configuration file is not found or cannot be read or parsed.
   */
  private loadSpendingPlansConfig(): SpendingPlanConfig[] {
    const filename = process.env.HBAR_SPENDING_PLANS_CONFIG_FILE || this.DEFAULT_SPENDING_PLANS_CONFIG_FILE;
    const configPath = findConfig(filename);
    if (!configPath || !fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at path: ${configPath ?? filename}`);
    }
    try {
      const rawData = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(rawData) as SpendingPlanConfig[];
    } catch (error: any) {
      throw new Error(`Failed to parse JSON from ${configPath}: ${error.message}`);
    }
  }

  /**
   * Validates the spending plan configuration.
   * @param {SpendingPlanConfig[]} spendingPlans - The spending plan configurations to validate.
   * @throws {Error} If any spending plan configuration is invalid.
   */
  private validateSpendingPlanConfig(spendingPlans: SpendingPlanConfig[]): void {
    for (const plan of spendingPlans) {
      if (!isValidSpendingPlanConfig(plan)) {
        throw new Error(`Invalid spending plan configuration: ${JSON.stringify(plan)}`);
      }
    }
  }

  /**
   * Populates the database with pre-configured spending plans.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   * @throws {Error} - If the spending plans configuration file is not found or cannot be loaded.
   */
  public async populatePreconfiguredSpendingPlans(): Promise<void> {
    const requestDetails = new RequestDetails({ requestId: '', ipAddress: '' });

    const spendingPlanConfigs = this.loadSpendingPlansConfig();
    this.validateSpendingPlanConfig(spendingPlanConfigs);

    const existingPlans: IDetailedHbarSpendingPlan[] =
      await this.hbarSpendingPlanRepository.findAllActiveBySubscriptionType(
        [SubscriptionType.EXTENDED, SubscriptionType.PRIVILEGED],
        requestDetails,
      );

    await this.deleteObsoletePlans(existingPlans, spendingPlanConfigs, requestDetails);
    await this.addNewPlans(spendingPlanConfigs, existingPlans, requestDetails);
    await this.updatePlanAssociations(spendingPlanConfigs, requestDetails);
  }

  /**
   * Deletes obsolete HBAR spending plans from the database.
   *
   * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  private async deleteObsoletePlans(
    existingPlans: IDetailedHbarSpendingPlan[],
    spendingPlanConfigs: SpendingPlanConfig[],
    requestDetails: RequestDetails,
  ): Promise<void> {
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
  }

  /**
   * Adds new HBAR spending plans to the database.
   *
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  private async addNewPlans(
    spendingPlanConfigs: SpendingPlanConfig[],
    existingPlans: IDetailedHbarSpendingPlan[],
    requestDetails: RequestDetails,
  ): Promise<void> {
    const plansToAdd = spendingPlanConfigs.filter((spc) => !existingPlans.some((plan) => plan.id === spc.id));
    for (const { id, name, subscriptionType } of plansToAdd) {
      await this.hbarSpendingPlanRepository.create(subscriptionType, requestDetails, this.TTL, id);
      this.logger.info(
        `Created HBAR spending plan "${name}" with ID "${id}" and subscriptionType "${subscriptionType}"`,
      );
    }
  }

  /**
   * Updates the associations of HBAR spending plans with ETH and IP addresses.
   *
   * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
   */
  private async updatePlanAssociations(
    spendingPlanConfigs: SpendingPlanConfig[],
    requestDetails: RequestDetails,
  ): Promise<void> {
    for (const planConfig of spendingPlanConfigs) {
      this.logger.trace(
        `Updating associations for HBAR spending plan '${planConfig.name}' with ID ${planConfig.id}...`,
      );
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
        const existsInCache = await this.ethAddressHbarSpendingPlanRepository.existsByAddress(
          ethAddress,
          requestDetails,
        );
        if (!existsInCache) {
          await this.ethAddressHbarSpendingPlanRepository.save(
            { ethAddress, planId: planConfig.id },
            requestDetails,
            this.TTL,
          );
          this.logger.info(`Associated HBAR spending plan '${planConfig.name}' with ETH address ${ethAddress}`);
        } else {
          this.logger.trace(
            `Skipping ETH address ${ethAddress} as it already has an HBAR spending plan associated with it`,
          );
        }
      }),
    );
  }

  /**
   * Updates the associations of an HBAR spending plan with IP addresses.
   *
   * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
   * @param {RequestDetails} requestDetails - The details of the current request.
   * @returns {Promise<void>} - A promise that resolves when the operation is complete.
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
        const existsInCache = await this.ipAddressHbarSpendingPlanRepository.existsByAddress(ipAddress, requestDetails);
        if (!existsInCache) {
          await this.ipAddressHbarSpendingPlanRepository.save(
            { ipAddress, planId: planConfig.id },
            requestDetails,
            this.TTL,
          );
          this.logger.info(`Associated HBAR spending plan '${planConfig.name}' with IP address`);
        } else {
          this.logger.trace(`Skipping IP address as it already has an HBAR spending plan associated with it`);
        }
      }),
    );
  }
}
