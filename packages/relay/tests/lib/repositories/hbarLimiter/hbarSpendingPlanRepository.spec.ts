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

import { pino } from 'pino';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { HbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { Registry } from 'prom-client';
import {
  HbarSpendingPlanNotActiveError,
  HbarSpendingPlanNotFoundError,
} from '../../../../src/lib/db/types/hbarLimiter/errors';
import { IHbarSpendingRecord } from '../../../../src/lib/db/types/hbarLimiter/hbarSpendingRecord';

import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';
import { IDetailedHbarSpendingPlan } from '../../../../src/lib/db/types/hbarLimiter/hbarSpendingPlan';
import { useInMemoryRedisServer } from '../../../helpers';
import { RequestDetails } from '../../../../src/lib/types';

chai.use(chaiAsPromised);

describe('HbarSpendingPlanRepository', function () {
  const logger = pino();
  const registry = new Registry();
  const requestDetails = new RequestDetails({ requestId: 'hbarSpendingPlanRepositoryTest', ipAddress: '0.0.0.0' });

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let repository: HbarSpendingPlanRepository;

    if (isSharedCacheEnabled) {
      useInMemoryRedisServer(logger, 6380);

      before(async () => {
        cacheService = new CacheService(logger.child({ name: `CacheService` }), registry);
        repository = new HbarSpendingPlanRepository(cacheService, logger.child({ name: `HbarSpendingPlanRepository` }));
      });

      after(async () => {
        await cacheService.disconnectRedisClient();
      });
    } else {
      before(async () => {
        process.env.TEST = 'true';
        process.env.REDIS_ENABLED = 'false';
        cacheService = new CacheService(logger.child({ name: `CacheService` }), registry);
        repository = new HbarSpendingPlanRepository(cacheService, logger.child({ name: `HbarSpendingPlanRepository` }));
      });
    }

    afterEach(async () => {
      await cacheService.clear(requestDetails);
    });

    describe('create', () => {
      it('creates a plan successfully', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        await expect(repository.findByIdWithDetails(createdPlan.id, requestDetails)).to.be.eventually.deep.equal(
          createdPlan,
        );
      });
    });

    describe('findById', () => {
      it('throws an error if plan is not found by ID', async () => {
        await expect(repository.findById('non-existent-id', requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns a plan by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        await expect(repository.findById(createdPlan.id, requestDetails)).to.be.eventually.deep.equal(createdPlan);
      });
    });

    describe('findByIdWithDetails', () => {
      it('throws an error if plan is not found by ID', async () => {
        await expect(repository.findByIdWithDetails('non-existent-id', requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns a plan by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        await expect(repository.findByIdWithDetails(createdPlan.id, requestDetails)).to.be.eventually.deep.equal(
          createdPlan,
        );
      });
    });

    describe('getSpendingHistory', () => {
      it('throws an error if plan not found by ID', async () => {
        await expect(repository.getSpendingHistory('non-existent-id', requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns an empty array if spending history is empty', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        const spendingHistory = await repository.getSpendingHistory(createdPlan.id, requestDetails);
        expect(spendingHistory).to.deep.equal([]);
      });

      it('retrieves spending history for a plan', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);

        const key = `${repository['collectionKey']}:${createdPlan.id}:spendingHistory`;
        const hbarSpending = { amount: 100, timestamp: new Date() } as IHbarSpendingRecord;
        await cacheService.rPush(key, hbarSpending, 'test', requestDetails);

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id, requestDetails);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(hbarSpending.amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');
      });
    });

    describe('addAmountToSpendingHistory', () => {
      it('adds amount to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        await expect(repository.getSpendingHistory(createdPlan.id, requestDetails)).to.be.eventually.deep.equal([]);

        const amount = 100;
        await repository.addAmountToSpendingHistory(createdPlan.id, amount, requestDetails);

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id, requestDetails);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');
      });

      it('adds multiple amounts to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        await expect(repository.getSpendingHistory(createdPlan.id, requestDetails)).to.be.eventually.deep.equal([]);

        const amounts = [100, 200, 300];
        for (const amount of amounts) {
          await repository.addAmountToSpendingHistory(createdPlan.id, amount, requestDetails);
        }

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id, requestDetails);
        expect(spendingHistory).to.have.lengthOf(3);
        expect(spendingHistory.map((entry) => entry.amount)).to.deep.equal(amounts);
      });

      it('throws error if plan not found when adding to spending history', async () => {
        const id = 'non-existent-id';
        const amount = 100;

        await expect(repository.addAmountToSpendingHistory(id, amount, requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });
    });

    describe('getAmountSpent', () => {
      const mockedOneDayInMillis: number = 200;
      let oneDayInMillis: number;
      let createdPlan: IDetailedHbarSpendingPlan;

      beforeEach(async () => {
        createdPlan = await repository.create(SubscriptionType.BASIC);
        oneDayInMillis = repository['oneDayInMillis'];
        // mock the oneDayInMillis value to speed up the test
        // @ts-ignore
        repository['oneDayInMillis'] = mockedOneDayInMillis;
      });

      afterEach(() => {
        // reset to the previous value of oneDayInMillis
        // @ts-ignore
        repository['oneDayInMillis'] = oneDayInMillis;
      });

      it('retrieves amountSpent for a plan', async () => {
        const amount = 50;
        await repository.addToAmountSpent(createdPlan.id, amount, requestDetails);
        await expect(repository.getAmountSpent(createdPlan.id, requestDetails)).to.eventually.equal(amount);
      });

      it('returns 0 if amountSpent key does not exist', async () => {
        await expect(repository.getAmountSpent(createdPlan.id, requestDetails)).to.eventually.equal(0);
      });

      it('should expire amountSpent key at the end of the day', async () => {
        const amount = 50;
        await repository.addToAmountSpent(createdPlan.id, amount, requestDetails);
        await expect(repository.getAmountSpent(createdPlan.id, requestDetails)).to.eventually.equal(amount);

        await new Promise((resolve) => setTimeout(resolve, mockedOneDayInMillis + 100));

        await expect(repository.getAmountSpent(createdPlan.id, requestDetails)).to.eventually.equal(0);
      });
    });

    describe('resetAllAmountSpentEntries', () => {
      it('resets all amountSpent entries', async () => {
        const plans: IDetailedHbarSpendingPlan[] = [];
        for (const subscriptionType of Object.values(SubscriptionType)) {
          const createdPlan = await repository.create(subscriptionType, requestDetails);
          plans.push(createdPlan);
          const amount = 50 * plans.length;
          await repository.addToAmountSpent(createdPlan.id, amount, requestDetails);
          await expect(repository.getAmountSpent(createdPlan.id, requestDetails)).to.eventually.equal(amount);
        }

        await repository.resetAmountSpentOfAllPlans(requestDetails);

        for (const plan of plans) {
          await expect(repository.getAmountSpent(plan.id, requestDetails)).to.eventually.equal(0);
        }
      });

      it('does not throw an error if no amountSpent keys exist', async () => {
        await expect(repository.resetAmountSpentOfAllPlans(requestDetails)).to.not.be.rejected;
      });
    });

    describe('addAmountToAmountSpent', () => {
      it('adds amount to amountSpent', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);
        const amount = 50;

        await repository.addToAmountSpent(createdPlan.id, amount, requestDetails);

        const plan = await repository.findByIdWithDetails(createdPlan.id, requestDetails);
        expect(plan).to.not.be.null;
        expect(plan!.amountSpent).to.equal(amount);

        // Add more to amountSpent
        const newAmount = 100;
        await repository.addToAmountSpent(createdPlan.id, newAmount, requestDetails);

        const updatedPlan = await repository.findByIdWithDetails(createdPlan.id, requestDetails);
        expect(updatedPlan).to.not.be.null;
        expect(updatedPlan!.amountSpent).to.equal(amount + newAmount);
      });

      it('throws error if plan not found when adding to amountSpent', async () => {
        const id = 'non-existent-id';
        const amount = 50;

        await expect(repository.addToAmountSpent(id, amount, requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });

      it('throws an error if plan is not active when adding to amountSpent', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);

        // Manually set the plan to inactive
        const key = `${repository['collectionKey']}:${createdPlan.id}`;
        await cacheService.set(key, { ...createdPlan, active: false }, 'test', requestDetails);

        const amount = 50;
        await expect(repository.addToAmountSpent(createdPlan.id, amount, requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotActiveError,
          `HbarSpendingPlan with ID ${createdPlan.id} is not active`,
        );
      });
    });

    describe('checkExistsAndActive', () => {
      it('throws error if plan does not exist when checking if exists and active', async () => {
        const id = 'non-existent-id';
        await expect(repository.checkExistsAndActive(id, requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });

      it('throws error if plan is not active when checking if exists and active', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType, requestDetails);

        // Manually set the plan to inactive
        const key = `${repository['collectionKey']}:${createdPlan.id}`;
        await cacheService.set(key, { ...createdPlan, active: false }, 'test', requestDetails);

        await expect(repository.checkExistsAndActive(createdPlan.id, requestDetails)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotActiveError,
          `HbarSpendingPlan with ID ${createdPlan.id} is not active`,
        );
      });
    });

    describe('findAllActiveBySubscriptionType', () => {
      it('returns an empty array if no active plans exist for the subscription type', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const activePlans = await repository.findAllActiveBySubscriptionType(subscriptionType, requestDetails);
        expect(activePlans).to.deep.equal([]);
      });

      it('returns all active plans for the subscription type', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan1 = await repository.create(subscriptionType, requestDetails);
        const createdPlan2 = await repository.create(subscriptionType, requestDetails);

        const activePlans = await repository.findAllActiveBySubscriptionType(subscriptionType, requestDetails);
        expect(activePlans).to.have.lengthOf(2);
        expect(activePlans.map((plan) => plan.id)).to.include.members([createdPlan1.id, createdPlan2.id]);
      });

      it('does not return inactive plans for the subscription type', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const activePlan = await repository.create(subscriptionType, requestDetails);
        const inactivePlan = await repository.create(subscriptionType, requestDetails);

        // Manually set the plan to inactive
        const key = `${repository['collectionKey']}:${inactivePlan.id}`;
        await cacheService.set(key, { ...inactivePlan, active: false }, 'test', requestDetails);

        const activePlans = await repository.findAllActiveBySubscriptionType(subscriptionType, requestDetails);
        expect(activePlans).to.deep.equal([activePlan]);
      });

      it('returns only active plans for the specified subscription type', async () => {
        const basicPlan = await repository.create(SubscriptionType.BASIC, requestDetails);
        const extendedPlan = await repository.create(SubscriptionType.EXTENDED, requestDetails);
        const privilegedPlan = await repository.create(SubscriptionType.PRIVILEGED, requestDetails);

        const activeBasicPlans = await repository.findAllActiveBySubscriptionType(
          SubscriptionType.BASIC,
          requestDetails,
        );
        expect(activeBasicPlans).to.have.lengthOf(1);
        expect(activeBasicPlans[0].id).to.equal(basicPlan.id);

        const activeExtendedPlans = await repository.findAllActiveBySubscriptionType(
          SubscriptionType.EXTENDED,
          requestDetails,
        );
        expect(activeExtendedPlans).to.have.lengthOf(1);
        expect(activeExtendedPlans[0].id).to.equal(extendedPlan.id);

        const activePrivilegedPlans = await repository.findAllActiveBySubscriptionType(
          SubscriptionType.PRIVILEGED,
          requestDetails,
        );
        expect(activePrivilegedPlans).to.have.lengthOf(1);
        expect(activePrivilegedPlans[0].id).to.equal(privilegedPlan.id);
      });
    });
  };

  describe('with shared cache', () => {
    tests(true);
  });

  describe('without shared cache', () => {
    tests(false);
  });
});
