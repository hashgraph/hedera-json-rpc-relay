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
import { RedisInMemoryServer } from '../../../redisInMemoryServer';
import { HbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { Registry } from 'prom-client';
import {
  HbarSpendingPlanNotActiveError,
  HbarSpendingPlanNotFoundError,
} from '../../../../src/lib/db/types/hbarLimiter/errors';
import { IHbarSpendingRecord } from '../../../../src/lib/db/types/hbarLimiter/hbarSpendingRecord';

import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';

chai.use(chaiAsPromised);

describe('HbarSpendingPlanRepository', function () {
  const logger = pino();
  const registry = new Registry();

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let repository: HbarSpendingPlanRepository;

    if (isSharedCacheEnabled) {
      let test: string | undefined;
      let redisEnabled: string | undefined;
      let redisUrl: string | undefined;
      let redisInMemoryServer: RedisInMemoryServer;

      this.beforeAll(async () => {
        redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 6380);
        await redisInMemoryServer.start();
        test = process.env.TEST;
        redisEnabled = process.env.REDIS_ENABLED;
        redisUrl = process.env.REDIS_URL;
        process.env.TEST = 'false';
        process.env.REDIS_ENABLED = 'true';
        process.env.REDIS_URL = 'redis://127.0.0.1:6380';
        cacheService = new CacheService(logger.child({ name: `CacheService` }), registry);
        repository = new HbarSpendingPlanRepository(cacheService, logger.child({ name: `HbarSpendingPlanRepository` }));
      });

      this.afterAll(async () => {
        await cacheService.disconnectRedisClient();
        await redisInMemoryServer.stop();
        process.env.TEST = test;
        process.env.REDIS_ENABLED = redisEnabled;
        process.env.REDIS_URL = redisUrl;
      });
    } else {
      before(async () => {
        process.env.TEST = 'true';
        process.env.REDIS_ENABLED = 'false';
        cacheService = new CacheService(logger.child({ name: `CacheService` }), registry);
        repository = new HbarSpendingPlanRepository(cacheService, logger.child({ name: `HbarSpendingPlanRepository` }));
      });
    }

    describe('create', () => {
      it('creates a plan successfully', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        await expect(repository.findByIdWithDetails(createdPlan.id)).to.be.eventually.deep.equal(createdPlan);
      });
    });

    describe('findById', () => {
      it('throws an error if plan is not found by ID', async () => {
        await expect(repository.findById('non-existent-id')).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns a plan by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        await expect(repository.findById(createdPlan.id)).to.be.eventually.deep.equal(createdPlan);
      });
    });

    describe('findByIdWithDetails', () => {
      it('throws an error if plan is not found by ID', async () => {
        await expect(repository.findByIdWithDetails('non-existent-id')).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns a plan by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        await expect(repository.findByIdWithDetails(createdPlan.id)).to.be.eventually.deep.equal(createdPlan);
      });
    });

    describe('getSpendingHistory', () => {
      it('throws an error if plan not found by ID', async () => {
        await expect(repository.getSpendingHistory('non-existent-id')).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID non-existent-id not found`,
        );
      });

      it('returns an empty array if spending history is empty', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        const spendingHistory = await repository.getSpendingHistory(createdPlan.id);
        expect(spendingHistory).to.deep.equal([]);
      });

      it('retrieves spending history for a plan', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);

        const key = `${repository['collectionKey']}:${createdPlan.id}:spendingHistory`;
        const hbarSpending = { amount: 100, timestamp: new Date() } as IHbarSpendingRecord;
        await cacheService.rPush(key, hbarSpending, 'test');

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(hbarSpending.amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');
      });
    });

    describe('addAmountToSpendingHistory', () => {
      it('adds amount to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        await expect(repository.getSpendingHistory(createdPlan.id)).to.be.eventually.deep.equal([]);

        const amount = 100;
        await repository.addAmountToSpendingHistory(createdPlan.id, amount);

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');

        const plan = await repository.findByIdWithDetails(createdPlan.id);
        expect(plan).to.not.be.null;
        expect(plan!.spendingHistory).to.have.lengthOf(1);
        expect(plan!.spendingHistory[0].amount).to.equal(amount);
        expect(plan!.spendingHistory[0].timestamp).to.be.a('Date');
      });

      it('adds multiple amounts to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        await expect(repository.getSpendingHistory(createdPlan.id)).to.be.eventually.deep.equal([]);

        const amounts = [100, 200, 300];
        for (const amount of amounts) {
          await repository.addAmountToSpendingHistory(createdPlan.id, amount);
        }

        const spendingHistory = await repository.getSpendingHistory(createdPlan.id);
        expect(spendingHistory).to.have.lengthOf(3);
        expect(spendingHistory.map((entry) => entry.amount)).to.deep.equal(amounts);

        const plan = await repository.findByIdWithDetails(createdPlan.id);
        expect(plan).to.not.be.null;
        expect(plan!.spendingHistory).to.have.lengthOf(3);
        expect(plan!.spendingHistory.map((entry) => entry.amount)).to.deep.equal(amounts);
      });

      it('throws error if plan not found when adding to spending history', async () => {
        const id = 'non-existent-id';
        const amount = 100;

        await expect(repository.addAmountToSpendingHistory(id, amount)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });
    });

    describe('getSpentToday', () => {
      let oneDayInMillis: number;

      beforeEach(() => {
        // save the oneDayInMillis value
        oneDayInMillis = repository['oneDayInMillis'];
        // set oneDayInMillis to 1 second for testing
        // @ts-ignore
        repository['oneDayInMillis'] = 1000;
      });

      afterEach(() => {
        // reset to the previous value of oneDayInMillis
        // @ts-ignore
        repository['oneDayInMillis'] = oneDayInMillis;
      });

      it('retrieves spent today for a plan', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdPlan.id, amount);

        const spentToday = await repository.getSpentToday(createdPlan.id);
        expect(spentToday).to.equal(amount);
      });

      it('returns 0 if spent today key does not exist', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);

        const spentToday = await repository.getSpentToday(createdPlan.id);
        expect(spentToday).to.equal(0);
      });

      it('should expire spent today key at the end of the day', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdPlan.id, amount);
        await expect(repository.getSpentToday(createdPlan.id)).to.eventually.equal(amount);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        await expect(repository.getSpentToday(createdPlan.id)).to.eventually.equal(0);
      });
    });

    describe('addAmountToSpentToday', () => {
      it('adds amount to spent today', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdPlan.id, amount);

        const plan = await repository.findByIdWithDetails(createdPlan.id);
        expect(plan).to.not.be.null;
        expect(plan!.spentToday).to.equal(amount);

        // Add more to spent today
        const newAmount = 100;
        await repository.addAmountToSpentToday(createdPlan.id, newAmount);

        const updatedPlan = await repository.findByIdWithDetails(createdPlan.id);
        expect(updatedPlan).to.not.be.null;
        expect(updatedPlan!.spentToday).to.equal(amount + newAmount);
      });

      it('throws error if plan not found when adding to spent today', async () => {
        const id = 'non-existent-id';
        const amount = 50;

        await expect(repository.addAmountToSpentToday(id, amount)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });

      it('throws an error if plan is not active when adding to spent today', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);

        // Manually set the plan to inactive
        const key = `${repository['collectionKey']}:${createdPlan.id}`;
        await cacheService.set(key, { ...createdPlan, active: false }, 'test');

        const amount = 50;
        await expect(repository.addAmountToSpentToday(createdPlan.id, amount)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotActiveError,
          `HbarSpendingPlan with ID ${createdPlan.id} is not active`,
        );
      });
    });

    describe('checkExistsAndActive', () => {
      it('throws error if plan does not exist when checking if exists and active', async () => {
        const id = 'non-existent-id';
        await expect(repository.checkExistsAndActive(id)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotFoundError,
          `HbarSpendingPlan with ID ${id} not found`,
        );
      });

      it('throws error if plan is not active when checking if exists and active', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdPlan = await repository.create(subscriptionType);

        // Manually set the plan to inactive
        const key = `${repository['collectionKey']}:${createdPlan.id}`;
        await cacheService.set(key, { ...createdPlan, active: false }, 'test');

        await expect(repository.checkExistsAndActive(createdPlan.id)).to.be.eventually.rejectedWith(
          HbarSpendingPlanNotActiveError,
          `HbarSpendingPlan with ID ${createdPlan.id} is not active`,
        );
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
