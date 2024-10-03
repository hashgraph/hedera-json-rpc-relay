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
import { SpendingPlanConfig } from '../types/spendingPlanConfig';
import { HbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { RequestDetails } from '../types';
import { Logger } from 'pino';

const PRE_CONFIGURED_SPENDING_PLANS_TTL = -1; // Never expire
const SPENDING_PLANS_CONFIG_FILE = 'spendingPlansConfig.json';

/**
 * Loads the pre-configured spending plans from a JSON file.
 * @returns {SpendingPlanConfig[]} An array of spending plan configurations.
 * @throws {Error} If the configuration file is not found or cannot be read.
 */
const loadSpendingPlansConfig = (): SpendingPlanConfig[] => {
  const path = findConfig(SPENDING_PLANS_CONFIG_FILE);
  if (!path || !fs.existsSync(path)) {
    throw new Error(`Configuration file not found at path: ${path || SPENDING_PLANS_CONFIG_FILE}`);
  }
  const rawData = fs.readFileSync(path, 'utf-8');
  return JSON.parse(rawData) as SpendingPlanConfig[];
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
  const ttl = PRE_CONFIGURED_SPENDING_PLANS_TTL;

  const spendingPlans = loadSpendingPlansConfig();

  for (const plan of spendingPlans) {
    const { name, ethAddresses, ipAddresses, subscriptionTier } = plan;

    if (!ethAddresses?.length && !ipAddresses?.length) {
      logger.warn(
        `${requestDetails.formattedRequestId} Skipping HBAR spending plan '${name}' as it has no ethAddresses or ipAddresses`,
      );
      continue;
    }

    const spendingPlan = await hbarSpendingPlanRepository.create(subscriptionTier, requestDetails, ttl);
    logger.info(`${requestDetails.formattedRequestId} Created HBAR spending plan '${name}' with ID ${spendingPlan.id}`);

    if (ethAddresses) {
      for (const ethAddress of ethAddresses) {
        if (!(await ethAddressHbarSpendingPlanRepository.existsByAddress(ethAddress, requestDetails))) {
          await ethAddressHbarSpendingPlanRepository.save({ ethAddress, planId: spendingPlan.id }, requestDetails, ttl);
          logger.info(
            `${requestDetails.formattedRequestId} Associated HBAR spending plan '${name}' with ETH address ${ethAddress}`,
          );
        } else {
          logger.warn(
            `${requestDetails.formattedRequestId} Skipping ETH address ${ethAddress} as it already has an HBAR spending plan associated with it`,
          );
        }
      }
    }

    if (ipAddresses) {
      for (const ipAddress of ipAddresses) {
        if (!(await ipAddressHbarSpendingPlanRepository.existsByAddress(ipAddress, requestDetails))) {
          await ipAddressHbarSpendingPlanRepository.save({ ipAddress, planId: spendingPlan.id }, requestDetails, ttl);
          logger.info(`${requestDetails.formattedRequestId} Associated HBAR spending plan '${name}' with IP address`);
        } else {
          logger.warn(
            `${requestDetails.formattedRequestId} Skipping IP address as it already has an HBAR spending plan associated with it`,
          );
        }
      }
    }
  }
};
