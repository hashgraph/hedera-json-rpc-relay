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
import { SubscriptionType } from '../../../src/lib/db/types/hbarLimiter/subscriptionType';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SpendingPlanConfig } from '../../../src/lib/types/spendingPlanConfig';
import { RequestDetails } from '../../../src/lib/types';
import { toHex, useInMemoryRedisServer } from '../../helpers';
import { IEthAddressHbarSpendingPlan } from '../../../src/lib/db/types/hbarLimiter/ethAddressHbarSpendingPlan';
import findConfig from 'find-config';
import { HbarSpendingPlanConfigService } from '../../../src/lib/config/hbarSpendingPlanConfigService';
import { IIPAddressHbarSpendingPlan } from '../../../src/lib/db/types/hbarLimiter/ipAddressHbarSpendingPlan';
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

        spendingPlansConfig.forEach(({ id, name, subscriptionType }) => {
          sinon.assert.calledWith(
            hbarSpendingPlanRepositorySpy.create,
            subscriptionType,
            emptyRequestDetails,
            neverExpireTtl,
            id,
          );
          sinon.assert.calledWith(
            loggerSpy.info,
            `Created HBAR spending plan "${name}" with ID "${id}" and subscriptionType "${subscriptionType}"`,
          );
        });
      });

      it('should throw an error if the configuration file is not found', async function () {
        sinon.stub(fs, 'existsSync').returns(false);
        await expect(hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans()).to.be.rejectedWith(
          `Configuration file not found at path "${hbarSpendingPlanConfigService['DEFAULT_SPENDING_PLANS_CONFIG_FILE']}"`,
        );
      });

      it('should delete obsolete EXTENDED and PRIVILEGED plans from the database', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);

        const obsoletePlans = [
          {
            id: 'plan-extended',
            subscriptionType: SubscriptionType.EXTENDED,
            createdAt: new Date(),
            active: true,
            spendingHistory: [],
            amountSpent: 0,
          },
          {
            id: 'plan-privileged',
            subscriptionType: SubscriptionType.PRIVILEGED,
            createdAt: new Date(),
            active: true,
            spendingHistory: [],
            amountSpent: 0,
          },
        ];
        await hbarSpendingPlanRepository.create(
          obsoletePlans[0].subscriptionType,
          emptyRequestDetails,
          neverExpireTtl,
          obsoletePlans[0].id,
        );
        await hbarSpendingPlanRepository.create(
          obsoletePlans[1].subscriptionType,
          emptyRequestDetails,
          neverExpireTtl,
          obsoletePlans[1].id,
        );

        const obsoleteEthAddressPlans: IEthAddressHbarSpendingPlan[] = [
          { ethAddress: '0x123', planId: 'plan-extended' },
          { ethAddress: '0x456', planId: 'plan-privileged' },
        ];
        await ethAddressHbarSpendingPlanRepository.save(
          obsoleteEthAddressPlans[0],
          emptyRequestDetails,
          neverExpireTtl,
        );
        await ethAddressHbarSpendingPlanRepository.save(
          obsoleteEthAddressPlans[1],
          emptyRequestDetails,
          neverExpireTtl,
        );

        const obsoleteIpAddressPlans: IIPAddressHbarSpendingPlan[] = [
          { ipAddress: '0.0.0.1', planId: 'plan-extended' },
          { ipAddress: '0.0.0.2', planId: 'plan-privileged' },
        ];
        await ipAddressHbarSpendingPlanRepository.save(obsoleteIpAddressPlans[0], emptyRequestDetails, neverExpireTtl);
        await ipAddressHbarSpendingPlanRepository.save(obsoleteIpAddressPlans[1], emptyRequestDetails, neverExpireTtl);

        await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

        expect(hbarSpendingPlanRepositorySpy.delete.calledTwice).to.be.true;
        obsoletePlans.forEach(({ id }) => {
          sinon.assert.calledWith(hbarSpendingPlanRepositorySpy.delete, id, emptyRequestDetails);
          sinon.assert.calledWith(
            loggerSpy.info,
            `Deleting HBAR spending plan with ID "${id}", as it is no longer in the spending plan configuration...`,
          );
        });
      });

      it('should not duplicate already existing spending plans', async function () {
        sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionType, emptyRequestDetails, neverExpireTtl, plan.id);
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
            subscriptionType: plan.subscriptionType,
            ethAddresses: [toHex(index)].concat(plan.ethAddresses ? plan.ethAddresses : []),
            ipAddresses: plan.ipAddresses,
          })),
        );
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionType, emptyRequestDetails, neverExpireTtl, plan.id);
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
            subscriptionType: plan.subscriptionType,
            ethAddresses: plan.ethAddresses,
            ipAddresses: [toHex(index)].concat(plan.ipAddresses ? plan.ipAddresses : []),
          })),
        );
        for (const plan of spendingPlansConfig) {
          await hbarSpendingPlanRepository.create(plan.subscriptionType, emptyRequestDetails, neverExpireTtl, plan.id);
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
