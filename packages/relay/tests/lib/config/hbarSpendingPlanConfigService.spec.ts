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

import sinon from 'sinon';
import fs from 'fs';
import pino, { Logger } from 'pino';
import { HbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../../../src/lib/db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { SubscriptionTier } from '../../../src/lib/db/types/hbarLimiter/subscriptionTier';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SpendingPlanConfig } from '../../../src/lib/types/spendingPlanConfig';
import { RequestDetails } from '../../../src/lib/types';
import { toHex, useInMemoryRedisServer } from '../../helpers';
import findConfig from 'find-config';
import { HbarSpendingPlanConfigService } from '../../../src/lib/config/hbarSpendingPlanConfigService';
import { CacheService } from '../../../src/lib/services/cacheService/cacheService';
import { Registry } from 'prom-client';

chai.use(chaiAsPromised);

describe('HbarSpendingPlanConfigService', function () {
  const logger = pino();
  const registry = new Registry();
  const neverExpireTtl = -1;
  const emptyRequestDetails = new RequestDetails({ requestId: '', ipAddress: '' });
  const path = findConfig('spendingPlansConfig.json', { dir: __dirname });
  const spendingPlansConfig = JSON.parse(fs.readFileSync(path!, 'utf-8')) as SpendingPlanConfig[];

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let hbarSpendingPlanRepository: HbarSpendingPlanRepository;
    let ethAddressHbarSpendingPlanRepository: EthAddressHbarSpendingPlanRepository;
    let ipAddressHbarSpendingPlanRepository: IPAddressHbarSpendingPlanRepository;
    let hbarSpendingPlanConfigService: HbarSpendingPlanConfigService;

    let loggerSpy: sinon.SinonSpiedInstance<Logger>;
    let cacheServiceSpy: sinon.SinonSpiedInstance<CacheService>;
    let hbarSpendingPlanRepositorySpy: sinon.SinonSpiedInstance<HbarSpendingPlanRepository>;
    let ethAddressHbarSpendingPlanRepositorySpy: sinon.SinonSpiedInstance<EthAddressHbarSpendingPlanRepository>;
    let ipAddressHbarSpendingPlanRepositorySpy: sinon.SinonSpiedInstance<IPAddressHbarSpendingPlanRepository>;

    before(function () {
      cacheService = new CacheService(logger, registry);
      hbarSpendingPlanRepository = new HbarSpendingPlanRepository(cacheService, logger);
      ethAddressHbarSpendingPlanRepository = new EthAddressHbarSpendingPlanRepository(cacheService, logger);
      ipAddressHbarSpendingPlanRepository = new IPAddressHbarSpendingPlanRepository(cacheService, logger);
      hbarSpendingPlanConfigService = new HbarSpendingPlanConfigService(
        logger,
        hbarSpendingPlanRepository,
        ethAddressHbarSpendingPlanRepository,
        ipAddressHbarSpendingPlanRepository,
      );
    });

    if (isSharedCacheEnabled) {
      useInMemoryRedisServer(logger, 6384);
    }

    beforeEach(function () {
      loggerSpy = sinon.spy(logger);
      cacheServiceSpy = sinon.spy(cacheService);
      hbarSpendingPlanRepositorySpy = sinon.spy(hbarSpendingPlanRepository);
      ethAddressHbarSpendingPlanRepositorySpy = sinon.spy(ethAddressHbarSpendingPlanRepository);
      ipAddressHbarSpendingPlanRepositorySpy = sinon.spy(ipAddressHbarSpendingPlanRepository);
    });

    afterEach(async function () {
      sinon.restore();
      await cacheService.clear(emptyRequestDetails);
    });

    describe('populatePreconfiguredSpendingPlans', function () {
      it('should populate the database with pre-configured spending plans', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        spendingPlansConfig.forEach(({ id, name, subscriptionTier }) => {
          sinon.assert.calledWith(
            hbarSpendingPlanRepositorySpy.create,
            subscriptionTier,
            emptyRequestDetails,
            neverExpireTtl,
            id,
          );
          sinon.assert.calledWith(
            loggerSpy.info,
            `Created HBAR spending plan "${name}" with ID "${id}" and subscriptionTier "${subscriptionTier}"`,
          );
        });
      });

      it('should throw an error if the configuration file is not found', async function () {
        sinon.stub(fs, 'existsSync').returns(false);
        await expect(hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans()).to.be.rejectedWith(
          `Configuration file not found at path "${hbarSpendingPlanConfigService['DEFAULT_SPENDING_PLANS_CONFIG_FILE']}"`,
        );
      });

      it('should remove obsolete associations of IP and ETH addresses linked to BASIC spending plans if they appear in the configuration', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);
        for (const plan of spendingPlansConfig) {
          const basicPlan = await hbarSpendingPlanRepository.create(
            SubscriptionTier.BASIC,
            emptyRequestDetails,
            neverExpireTtl,
          );
          for (const ethAddress of plan.ethAddresses || []) {
            await ethAddressHbarSpendingPlanRepository.save(
              { ethAddress, planId: basicPlan.id },
              emptyRequestDetails,
              neverExpireTtl,
            );
          }
          for (const ipAddress of plan.ipAddresses || []) {
            await ipAddressHbarSpendingPlanRepository.save(
              { ipAddress, planId: basicPlan.id },
              emptyRequestDetails,
              neverExpireTtl,
            );
          }
        }
        hbarSpendingPlanRepositorySpy.create.resetHistory();
        ethAddressHbarSpendingPlanRepositorySpy.save.resetHistory();
        ipAddressHbarSpendingPlanRepositorySpy.save.resetHistory();

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        spendingPlansConfig.forEach((plan) => {
          if (plan.ethAddresses) {
            plan.ethAddresses.forEach((ethAddress) => {
              sinon.assert.calledWith(
                ethAddressHbarSpendingPlanRepositorySpy.save,
                { ethAddress, planId: plan.id },
                emptyRequestDetails,
                neverExpireTtl,
              );
              sinon.assert.calledWith(ethAddressHbarSpendingPlanRepositorySpy.delete, ethAddress, emptyRequestDetails);
            });
          }

          if (plan.ipAddresses) {
            plan.ipAddresses.forEach((ipAddress) => {
              sinon.assert.calledWith(
                ipAddressHbarSpendingPlanRepositorySpy.save,
                { ipAddress, planId: plan.id },
                emptyRequestDetails,
                neverExpireTtl,
              );
              sinon.assert.calledWith(ipAddressHbarSpendingPlanRepositorySpy.delete, ipAddress, emptyRequestDetails);
            });
          }
        });
      });

      it('should delete obsolete EXTENDED and PRIVILEGED plans from the database', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);

        const obsoletePlans: SpendingPlanConfig[] = [
          {
            id: 'plan-extended',
            name: 'Extended Plan',
            subscriptionTier: SubscriptionTier.EXTENDED,
            ethAddresses: ['0x123'],
            ipAddresses: ['127.0.0.1'],
          },
          {
            id: 'plan-privileged',
            name: 'Privileged Plan',
            subscriptionTier: SubscriptionTier.PRIVILEGED,
            ethAddresses: ['0x124'],
            ipAddresses: ['128.0.0.1'],
          },
        ];
        for (const { id, subscriptionTier, ethAddresses, ipAddresses } of obsoletePlans) {
          const plan = await hbarSpendingPlanRepository.create(
            subscriptionTier,
            emptyRequestDetails,
            neverExpireTtl,
            id,
          );
          for (const ethAddress of ethAddresses || []) {
            await ethAddressHbarSpendingPlanRepository.save(
              { ethAddress, planId: plan.id },
              emptyRequestDetails,
              neverExpireTtl,
            );
          }
          for (const ipAddress of ipAddresses || []) {
            await ipAddressHbarSpendingPlanRepository.save(
              { ipAddress, planId: plan.id },
              emptyRequestDetails,
              neverExpireTtl,
            );
          }
        }

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        expect(hbarSpendingPlanRepositorySpy.delete.calledTwice).to.be.true;
        obsoletePlans.forEach(({ id, ethAddresses, ipAddresses }) => {
          sinon.assert.calledWith(hbarSpendingPlanRepositorySpy.delete, id, emptyRequestDetails);
          sinon.assert.calledWith(
            loggerSpy.info,
            `Deleting HBAR spending plan with ID "${id}", as it is no longer in the spending plan configuration...`,
          );
          sinon.assert.calledWithMatch(ethAddressHbarSpendingPlanRepositorySpy.deleteAllByPlanId, id);
          sinon.assert.calledWithMatch(ipAddressHbarSpendingPlanRepositorySpy.deleteAllByPlanId, id);
          ethAddresses?.forEach((ethAddress) => {
            const key = ethAddressHbarSpendingPlanRepository['getKey'](ethAddress);
            sinon.assert.calledWithMatch(cacheServiceSpy.delete, key);
          });
          ipAddresses?.forEach((ipAddress) => {
            const key = ipAddressHbarSpendingPlanRepository['getKey'](ipAddress);
            sinon.assert.calledWithMatch(cacheServiceSpy.delete, key);
          });
        });
      });

      it('should not duplicate already existing spending plans', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionTier, emptyRequestDetails, neverExpireTtl, plan.id);
        }
        hbarSpendingPlanRepositorySpy.create.resetHistory();

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        sinon.assert.notCalled(hbarSpendingPlanRepositorySpy.create);
      });

      it('should update new associations for ETH addresses', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(
          spendingPlansConfig.map((plan, index) => ({
            id: plan.id,
            name: plan.name,
            subscriptionTier: plan.subscriptionTier,
            ethAddresses: [toHex(index)].concat(plan.ethAddresses ? plan.ethAddresses : []),
            ipAddresses: plan.ipAddresses,
          })),
        );
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionTier, emptyRequestDetails, neverExpireTtl, plan.id);
        }
        hbarSpendingPlanRepositorySpy.create.resetHistory();

        const ethAddressPlans = spendingPlansConfig
          .filter((plan) => plan.ethAddresses)
          .flatMap((plan) => plan.ethAddresses!.map((ethAddress) => ({ ethAddress, planId: plan.id })));
        for (const ethAddressPlan of ethAddressPlans) {
          await ethAddressHbarSpendingPlanRepository.save(ethAddressPlan, emptyRequestDetails, neverExpireTtl);
        }
        ethAddressHbarSpendingPlanRepositorySpy.save.resetHistory();

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        spendingPlansConfig.forEach((config, index) => {
          sinon.assert.calledWith(
            ethAddressHbarSpendingPlanRepositorySpy.save,
            { ethAddress: toHex(index), planId: config.id },
            emptyRequestDetails,
            neverExpireTtl,
          );
          if (config.ethAddresses) {
            config.ethAddresses.forEach((ethAddress) => {
              sinon.assert.neverCalledWith(
                ethAddressHbarSpendingPlanRepositorySpy.save,
                { ethAddress, planId: config.id },
                emptyRequestDetails,
                neverExpireTtl,
              );
              sinon.assert.neverCalledWith(
                ethAddressHbarSpendingPlanRepositorySpy.delete,
                ethAddress,
                emptyRequestDetails,
              );
            });
          }
        });
      });

      it('should update associations for IP addresses', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(
          spendingPlansConfig.map((plan, index) => ({
            id: plan.id,
            name: plan.name,
            subscriptionTier: plan.subscriptionTier,
            ethAddresses: plan.ethAddresses,
            ipAddresses: [`255.0.0.${index}`].concat(plan.ipAddresses ? plan.ipAddresses : []),
          })),
        );
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionTier, emptyRequestDetails, neverExpireTtl, plan.id);
        }
        hbarSpendingPlanRepositorySpy.create.resetHistory();

        const ipAddressPlans = spendingPlansConfig
          .filter((plan) => plan.ipAddresses)
          .flatMap((plan) => plan.ipAddresses!.map((ipAddress) => ({ ipAddress, planId: plan.id })));
        for (const ipAddressPlan of ipAddressPlans) {
          await ipAddressHbarSpendingPlanRepository.save(ipAddressPlan, emptyRequestDetails, neverExpireTtl);
        }
        ipAddressHbarSpendingPlanRepositorySpy.save.resetHistory();

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        spendingPlansConfig.forEach((config, index) => {
          sinon.assert.calledWith(ipAddressHbarSpendingPlanRepositorySpy.save, {
            ipAddress: toHex(index),
            planId: config.id,
          });
          if (config.ipAddresses) {
            config.ipAddresses.forEach((ipAddress) => {
              sinon.assert.neverCalledWith(ipAddressHbarSpendingPlanRepositorySpy.save, {
                ipAddress,
                planId: config.id,
              });
              sinon.assert.neverCalledWith(
                ipAddressHbarSpendingPlanRepositorySpy.delete,
                ipAddress,
                emptyRequestDetails,
              );
            });
          }
        });
      });
    });
  };

  describe('with shared cache enabled', function () {
    tests(true);
  });

  describe('with shared cache disabled', function () {
    tests(false);
  });
});
