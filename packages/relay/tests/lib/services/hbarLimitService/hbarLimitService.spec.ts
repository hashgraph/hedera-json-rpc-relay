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

import { expect } from 'chai';
import sinon from 'sinon';
import { HbarLimitService } from '../../../../src/lib/services/hbarLimitService';
import { HbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import pino from 'pino';
import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';
import { EthAddressHbarSpendingPlanNotFoundError } from '../../../../src/lib/db/types/hbarLimiter/errors';
import { HbarSpendingPlan } from '../../../../src/lib/db/entities/hbarLimiter/hbarSpendingPlan';

describe('HbarLimitService', function () {
  const logger = pino();
  let hbarLimitService: HbarLimitService;
  let hbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<HbarSpendingPlanRepository>;
  let ethAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<EthAddressHbarSpendingPlanRepository>;

  beforeEach(function () {
    hbarSpendingPlanRepositoryStub = sinon.createStubInstance(HbarSpendingPlanRepository);
    ethAddressHbarSpendingPlanRepositoryStub = sinon.createStubInstance(EthAddressHbarSpendingPlanRepository);
    hbarLimitService = new HbarLimitService(
      hbarSpendingPlanRepositoryStub,
      ethAddressHbarSpendingPlanRepositoryStub,
      logger,
    );
  });

  it('should return true if the limit should be applied based on ethAddress', async function () {
    const ethAddress = '0x123';
    const spendingPlan = new HbarSpendingPlan({
      id: 'plan1',
      subscriptionType: SubscriptionType.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 1000,
    });
    ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({ ethAddress, planId: 'plan1' });
    hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

    const result = await hbarLimitService.shouldLimit(ethAddress);

    expect(result).to.be.true;
  });

  it('should return false if the limit should not be applied based on ethAddress', async function () {
    const ethAddress = '0x123';
    const spendingPlan = new HbarSpendingPlan({
      id: 'plan1',
      subscriptionType: SubscriptionType.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 500,
    });
    ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({ ethAddress, planId: 'plan1' });
    hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

    const result = await hbarLimitService.shouldLimit(ethAddress);

    expect(result).to.be.false;
  });

  it('should create a basic spending plan if none exists for the ethAddress', async function () {
    const newSpendingPlan = new HbarSpendingPlan({
      id: 'plan1',
      subscriptionType: SubscriptionType.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday: 0,
    });
    const ethAddress = '0x123';
    const error = new EthAddressHbarSpendingPlanNotFoundError(ethAddress);
    ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
    hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
    ethAddressHbarSpendingPlanRepositoryStub.save.resolves();
    const warnSpy = sinon.spy(logger, 'warn');

    const result = await hbarLimitService.shouldLimit(ethAddress);

    expect(result).to.be.false;
    expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
    expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
    expect(
      warnSpy.calledWithMatch(
        sinon.match.instanceOf(EthAddressHbarSpendingPlanNotFoundError),
        `Failed to get spending plan for eth address '${ethAddress}'`,
      ),
    ).to.be.true;
  });

  it('should throw an error when resetLimiter is called', async function () {
    try {
      await hbarLimitService.resetLimiter();
    } catch (error: any) {
      expect(error.message).to.equal('Not implemented');
    }
  });
});
