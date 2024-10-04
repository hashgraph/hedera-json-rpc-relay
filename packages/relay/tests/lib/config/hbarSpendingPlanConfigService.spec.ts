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
import { toHex } from '../../helpers';
import { IEthAddressHbarSpendingPlan } from '../../../src/lib/db/types/hbarLimiter/ethAddressHbarSpendingPlan';
import { EthAddressHbarSpendingPlan } from '../../../src/lib/db/entities/hbarLimiter/ethAddressHbarSpendingPlan';
import findConfig from 'find-config';
import { HbarSpendingPlanConfigService } from '../../../src/lib/config/hbarSpendingPlanConfigService';

chai.use(chaiAsPromised);

describe('HbarSpendingPlanConfigService', function () {
  const neverExpireTtl = -1;
  const emptyRequestDetails = new RequestDetails({ requestId: '', ipAddress: '' });
  const path = findConfig('spendingPlansConfig.json', { dir: __dirname });
  const spendingPlansConfig = JSON.parse(fs.readFileSync(path!, 'utf-8')) as SpendingPlanConfig[];

  let loggerSpy: sinon.SinonSpiedInstance<Logger>;
  let hbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<HbarSpendingPlanRepository>;
  let ethAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<EthAddressHbarSpendingPlanRepository>;
  let ipAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<IPAddressHbarSpendingPlanRepository>;
  let hbarSpendingPlanConfigService: HbarSpendingPlanConfigService;

  beforeEach(function () {
    loggerSpy = sinon.spy(
      pino({
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: true,
          },
        },
      }),
    );
    hbarSpendingPlanRepositoryStub = sinon.createStubInstance(HbarSpendingPlanRepository);
    ethAddressHbarSpendingPlanRepositoryStub = sinon.createStubInstance(EthAddressHbarSpendingPlanRepository);
    ipAddressHbarSpendingPlanRepositoryStub = sinon.createStubInstance(IPAddressHbarSpendingPlanRepository);
    hbarSpendingPlanConfigService = new HbarSpendingPlanConfigService(
      loggerSpy as Logger,
      hbarSpendingPlanRepositoryStub,
      ethAddressHbarSpendingPlanRepositoryStub,
      ipAddressHbarSpendingPlanRepositoryStub,
    );
  });

  describe('populatePreconfiguredSpendingPlans', function () {
    beforeEach(function () {
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionType.resolves([]);
      ethAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.resolves([]);
      ipAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.resolves([]);
      hbarSpendingPlanRepositoryStub.create.resolves();
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();
      ipAddressHbarSpendingPlanRepositoryStub.save.resolves();
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should populate the database with pre-configured spending plans', async function () {
      sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);

      await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

      spendingPlansConfig.forEach(({ id, name, subscriptionType }) => {
        sinon.assert.calledWith(
          hbarSpendingPlanRepositoryStub.create,
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
        `Configuration file not found at path: ${hbarSpendingPlanConfigService['DEFAULT_SPENDING_PLANS_CONFIG_FILE']}`,
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
      const obsoleteEthAddressPlans = [
        { ethAddress: '0x123', planId: 'plan-extended' } as IEthAddressHbarSpendingPlan,
        { ethAddress: '0x456', planId: 'plan-privileged' } as IEthAddressHbarSpendingPlan,
      ];
      const obsoloteIpAddressPlans = [
        { ipAddress: '0.0.0.1', planId: 'plan-extended' },
        { ipAddress: '0.0.0.2', planId: 'plan-privileged' },
      ];
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionType.resolves(obsoletePlans);
      ethAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.callsFake((id) =>
        Promise.resolve(obsoleteEthAddressPlans.filter((addressPlan) => addressPlan.planId === id)),
      );
      ipAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.callsFake((id) =>
        Promise.resolve(obsoloteIpAddressPlans.filter((addressPlan) => addressPlan.planId === id)),
      );
      hbarSpendingPlanRepositoryStub.delete.resolves();
      ethAddressHbarSpendingPlanRepositoryStub.delete.resolves();
      ipAddressHbarSpendingPlanRepositoryStub.delete.resolves();

      await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

      expect(hbarSpendingPlanRepositoryStub.delete.calledTwice).to.be.true;
      obsoletePlans.forEach(({ id }) => {
        sinon.assert.calledWith(hbarSpendingPlanRepositoryStub.delete, id, emptyRequestDetails);
        sinon.assert.calledWith(
          loggerSpy.info,
          `Deleting HBAR spending plan with ID "${id}", as it is no longer in the spending plan configuration...`,
        );
      });
    });

    it('should not duplicate already existing spending plans', async function () {
      sinon.stub(hbarSpendingPlanConfigService, 'loadSpendingPlansConfig' as any).returns(spendingPlansConfig);
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionType.resolves(
        spendingPlansConfig.map((plan) => ({
          id: plan.id,
          subscriptionType: plan.subscriptionType,
          createdAt: new Date(),
          active: true,
          spendingHistory: [],
          amountSpent: 0,
        })),
      );

      await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

      sinon.assert.notCalled(hbarSpendingPlanRepositoryStub.create);
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
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionType.resolves(
        spendingPlansConfig.map((plan) => ({
          id: plan.id,
          subscriptionType: plan.subscriptionType,
          createdAt: new Date(),
          active: true,
          spendingHistory: [],
          amountSpent: 0,
        })),
      );
      ethAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.callsFake((id) =>
        Promise.resolve(
          spendingPlansConfig
            .filter((plan) => plan.id === id)
            .flatMap((plan) =>
              (plan.ethAddresses ?? []).map((ethAddress) => new EthAddressHbarSpendingPlan({ ethAddress, planId: id })),
            ),
        ),
      );

      await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

      spendingPlansConfig.forEach((config, index) => {
        sinon.assert.calledWith(
          ethAddressHbarSpendingPlanRepositoryStub.save,
          { ethAddress: toHex(index), planId: config.id },
          emptyRequestDetails,
          neverExpireTtl,
        );
        if (config.ethAddresses) {
          config.ethAddresses.forEach((ethAddress) => {
            sinon.assert.neverCalledWith(
              ethAddressHbarSpendingPlanRepositoryStub.save,
              { ethAddress, planId: config.id },
              emptyRequestDetails,
              neverExpireTtl,
            );
            sinon.assert.neverCalledWith(
              ethAddressHbarSpendingPlanRepositoryStub.delete,
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
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionType.resolves(
        spendingPlansConfig.map((plan) => ({
          id: plan.id,
          subscriptionType: plan.subscriptionType,
          createdAt: new Date(),
          active: true,
          spendingHistory: [],
          amountSpent: 0,
        })),
      );
      ipAddressHbarSpendingPlanRepositoryStub.findAllByPlanId.callsFake((id) =>
        Promise.resolve(
          spendingPlansConfig
            .filter((plan) => plan.id === id)
            .flatMap((plan) => (plan.ipAddresses ?? []).map((ipAddress) => ({ ipAddress, planId: id }))),
        ),
      );
      ipAddressHbarSpendingPlanRepositoryStub.save.resolves();

      await hbarSpendingPlanConfigService.populatePreconfiguredSpendingPlans();

      spendingPlansConfig.forEach((config, index) => {
        sinon.assert.calledWith(ipAddressHbarSpendingPlanRepositoryStub.save, {
          ipAddress: toHex(index),
          planId: config.id,
        });
        if (config.ipAddresses) {
          config.ipAddresses.forEach((ipAddress) => {
            sinon.assert.neverCalledWith(ipAddressHbarSpendingPlanRepositoryStub.save, {
              ipAddress,
              planId: config.id,
            });
            sinon.assert.neverCalledWith(
              ipAddressHbarSpendingPlanRepositoryStub.delete,
              ipAddress,
              emptyRequestDetails,
            );
          });
        }
      });
    });
  });
});
