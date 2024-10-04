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

const TTL = -1; // -1 means no TTL, i.e. the data will not expire
const DEFAULT_SPENDING_PLANS_CONFIG_FILE = 'spendingPlansConfig.json';

/**
 * Loads the pre-configured spending plans from a JSON file.
 * @param {string} [filename] - (Optional) The name of the spending plans configuration file.
 * @returns {SpendingPlanConfig[]} An array of spending plan configurations.
 * @throws {Error} If the configuration file is not found or cannot be read or parsed.
 */
const loadSpendingPlansConfig = (filename?: string): SpendingPlanConfig[] => {
  const configPath = findConfig(filename || DEFAULT_SPENDING_PLANS_CONFIG_FILE);
  if (!configPath || !fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found at path: ${configPath || DEFAULT_SPENDING_PLANS_CONFIG_FILE}`);
  }
  try {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(rawData) as SpendingPlanConfig[];
  } catch (error: any) {
    throw new Error(`Failed to parse JSON from ${configPath}: ${error.message}`);
  }
};

/**
 * Validates the spending plan configuration.
 * @param {SpendingPlanConfig[]} spendingPlans - The spending plan configurations to validate.
 * @throws {Error} If any spending plan configuration is invalid.
 */
const validateSpendingPlanConfig = (spendingPlans: SpendingPlanConfig[]): void => {
  for (const plan of spendingPlans) {
    if (!isValidSpendingPlanConfig(plan)) {
      throw new Error(`Invalid spending plan configuration: ${JSON.stringify(plan)}`);
    }
  }
};

/**
 * Populates the database with pre-configured spending plans.
 * @param {Logger} logger - The logger instance.
 * @param {HbarSpendingPlanRepository} hbarSpendingPlanRepository - The HBAR spending plan repository.
 * @param {EthAddressHbarSpendingPlanRepository} ethAddressHbarSpendingPlanRepository - The ETH address HBAR spending plan repository.
 * @param {IPAddressHbarSpendingPlanRepository} ipAddressHbarSpendingPlanRepository - The IP address HBAR spending plan repository.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 * @throws {Error} - If the spending plans configuration file is not found or cannot be loaded.
 * @async
 */
export const populatePreconfiguredSpendingPlans = async (
  logger: Logger,
  hbarSpendingPlanRepository: HbarSpendingPlanRepository,
  ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
  ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
): Promise<void> => {
  const requestDetails = new RequestDetails({ requestId: '', ipAddress: '' });

  const spendingPlanConfigs = loadSpendingPlansConfig(process.env.HBAR_SPENDING_PLANS_CONFIG_FILE);
  validateSpendingPlanConfig(spendingPlanConfigs);

  const existingPlans: IDetailedHbarSpendingPlan[] = await hbarSpendingPlanRepository.findAllActiveBySubscriptionType(
    [SubscriptionType.EXTENDED, SubscriptionType.PRIVILEGED],
    requestDetails,
  );

  await deleteObsoletePlans(
    existingPlans,
    spendingPlanConfigs,
    hbarSpendingPlanRepository,
    ethAddressHbarSpendingPlanRepository,
    ipAddressHbarSpendingPlanRepository,
    requestDetails,
    logger,
  );
  await addNewPlans(spendingPlanConfigs, existingPlans, hbarSpendingPlanRepository, requestDetails, logger);
  await updatePlanAssociations(
    spendingPlanConfigs,
    ethAddressHbarSpendingPlanRepository,
    ipAddressHbarSpendingPlanRepository,
    requestDetails,
    logger,
  );
};

/**
 * Deletes obsolete HBAR spending plans from the database.
 *
 * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
 * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
 * @param {HbarSpendingPlanRepository} hbarSpendingPlanRepository - The repository for HBAR spending plans.
 * @param {EthAddressHbarSpendingPlanRepository} ethAddressHbarSpendingPlanRepository - The repository for ETH address HBAR spending plans.
 * @param {IPAddressHbarSpendingPlanRepository} ipAddressHbarSpendingPlanRepository - The repository for IP address HBAR spending plans.
 * @param {RequestDetails} requestDetails - The details of the current request.
 * @param {Logger} logger - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const deleteObsoletePlans = async (
  existingPlans: IDetailedHbarSpendingPlan[],
  spendingPlanConfigs: SpendingPlanConfig[],
  hbarSpendingPlanRepository: HbarSpendingPlanRepository,
  ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
  ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
  requestDetails: RequestDetails,
  logger: Logger,
): Promise<void> => {
  const plansToDelete = existingPlans.filter((plan) => !spendingPlanConfigs.some((spc) => spc.id === plan.id));
  for (const { id } of plansToDelete) {
    logger.info(
      `Deleting HBAR spending plan with ID "${id}", as it is no longer in the spending plan configuration...`,
    );
    await hbarSpendingPlanRepository.delete(id, requestDetails);
    await ethAddressHbarSpendingPlanRepository.deleteAllByPlanId(
      id,
      'populatePreconfiguredSpendingPlans',
      requestDetails,
    );
    await ipAddressHbarSpendingPlanRepository.deleteAllByPlanId(
      id,
      'populatePreconfiguredSpendingPlans',
      requestDetails,
    );
  }
};

/**
 * Adds new HBAR spending plans to the database.
 *
 * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
 * @param {IDetailedHbarSpendingPlan[]} existingPlans - The existing HBAR spending plans in the database.
 * @param {HbarSpendingPlanRepository} hbarSpendingPlanRepository - The repository for HBAR spending plans.
 * @param {RequestDetails} requestDetails - The details of the current request.
 * @param {Logger} logger - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const addNewPlans = async (
  spendingPlanConfigs: SpendingPlanConfig[],
  existingPlans: IDetailedHbarSpendingPlan[],
  hbarSpendingPlanRepository: HbarSpendingPlanRepository,
  requestDetails: RequestDetails,
  logger: Logger,
): Promise<void> => {
  const plansToAdd = spendingPlanConfigs.filter((spc) => !existingPlans.some((plan) => plan.id === spc.id));
  for (const { id, name, subscriptionType } of plansToAdd) {
    await hbarSpendingPlanRepository.create(subscriptionType, requestDetails, TTL, id);
    logger.info(`Created HBAR spending plan "${name}" with ID "${id}" and subscriptionType "${subscriptionType}"`);
  }
};

/**
 * Updates the associations of HBAR spending plans with ETH and IP addresses.
 *
 * @param {SpendingPlanConfig[]} spendingPlanConfigs - The current spending plan configurations.
 * @param {EthAddressHbarSpendingPlanRepository} ethAddressHbarSpendingPlanRepository - The repository for ETH address HBAR spending plans.
 * @param {IPAddressHbarSpendingPlanRepository} ipAddressHbarSpendingPlanRepository - The repository for IP address HBAR spending plans.
 * @param {RequestDetails} requestDetails - The details of the current request.
 * @param {Logger} logger - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const updatePlanAssociations = async (
  spendingPlanConfigs: SpendingPlanConfig[],
  ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
  ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
  requestDetails: RequestDetails,
  logger: Logger,
): Promise<void> => {
  for (const planConfig of spendingPlanConfigs) {
    logger.trace(`Updating associations for HBAR spending plan '${planConfig.name}' with ID ${planConfig.id}...`);
    await updateEthAddressAssociations(planConfig, ethAddressHbarSpendingPlanRepository, requestDetails, logger);
    await updateIpAddressAssociations(planConfig, ipAddressHbarSpendingPlanRepository, requestDetails, logger);
  }
};

/**
 * Updates the associations of an HBAR spending plan with ETH addresses.
 *
 * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
 * @param {EthAddressHbarSpendingPlanRepository} ethAddressHbarSpendingPlanRepository - The repository for ETH address HBAR spending plans.
 * @param {RequestDetails} requestDetails - The details of the current request.
 * @param {Logger} logger - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const updateEthAddressAssociations = async (
  planConfig: SpendingPlanConfig,
  ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository,
  requestDetails: RequestDetails,
  logger: Logger,
): Promise<void> => {
  const currentEthAddresses = await ethAddressHbarSpendingPlanRepository
    .findAllByPlanId(planConfig.id, 'populatePreconfiguredSpendingPlans', requestDetails)
    .then((ethAddressPlans) => ethAddressPlans.map((plan) => plan.ethAddress));

  const addressesToDelete = currentEthAddresses.filter((ethAddress) => !planConfig.ethAddresses?.includes(ethAddress));
  await Promise.all(
    addressesToDelete.map(async (ethAddress) => {
      await ethAddressHbarSpendingPlanRepository.delete(ethAddress, requestDetails);
      logger.info(`Removed association between ETH address ${ethAddress} and HBAR spending plan '${planConfig.name}'`);
    }),
  );

  const addressesToAdd =
    planConfig.ethAddresses?.filter((ethAddress) => !currentEthAddresses.includes(ethAddress)) || [];
  await Promise.all(
    addressesToAdd.map(async (ethAddress) => {
      const existsInCache = await ethAddressHbarSpendingPlanRepository.existsByAddress(ethAddress, requestDetails);
      if (!existsInCache) {
        await ethAddressHbarSpendingPlanRepository.save({ ethAddress, planId: planConfig.id }, requestDetails, TTL);
        logger.info(`Associated HBAR spending plan '${planConfig.name}' with ETH address ${ethAddress}`);
      } else {
        logger.trace(`Skipping ETH address ${ethAddress} as it already has an HBAR spending plan associated with it`);
      }
    }),
  );
};

/**
 * Updates the associations of an HBAR spending plan with IP addresses.
 *
 * @param {SpendingPlanConfig} planConfig - The spending plan configuration.
 * @param {IPAddressHbarSpendingPlanRepository} ipAddressHbarSpendingPlanRepository - The repository for IP address HBAR spending plans.
 * @param {RequestDetails} requestDetails - The details of the current request.
 * @param {Logger} logger - The logger instance.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const updateIpAddressAssociations = async (
  planConfig: SpendingPlanConfig,
  ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository,
  requestDetails: RequestDetails,
  logger: Logger,
): Promise<void> => {
  const currentIpAddresses = await ipAddressHbarSpendingPlanRepository
    .findAllByPlanId(planConfig.id, 'populatePreconfiguredSpendingPlans', requestDetails)
    .then((ipAddressPlans) => ipAddressPlans.map((plan) => plan.ipAddress));

  const addressesToDelete = currentIpAddresses.filter((ipAddress) => !planConfig.ipAddresses?.includes(ipAddress));
  await Promise.all(
    addressesToDelete.map(async (ipAddress) => {
      await ipAddressHbarSpendingPlanRepository.delete(ipAddress, requestDetails);
      logger.info(`Removed association between IP address and HBAR spending plan '${planConfig.name}'`);
    }),
  );

  const addressesToAdd = planConfig.ipAddresses?.filter((ipAddress) => !currentIpAddresses.includes(ipAddress)) || [];
  await Promise.all(
    addressesToAdd.map(async (ipAddress) => {
      const existsInCache = await ipAddressHbarSpendingPlanRepository.existsByAddress(ipAddress, requestDetails);
      if (!existsInCache) {
        await ipAddressHbarSpendingPlanRepository.save({ ipAddress, planId: planConfig.id }, requestDetails, TTL);
        logger.info(`Associated HBAR spending plan '${planConfig.name}' with IP address`);
      } else {
        logger.trace(`Skipping IP address as it already has an HBAR spending plan associated with it`);
      }
    }),
  );
};
