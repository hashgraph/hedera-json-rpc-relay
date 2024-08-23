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
import { SubscriptionRepository } from '../../../../src/lib/db/repositories/hbarLimiter/SubscriptionRepository';
import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import { Registry } from 'prom-client';
import { SubscriptionNotActiveError, SubscriptionNotFoundError } from '../../../../src/lib/db/types/hbarLimiter/errors';
import { IHbarSpending } from '../../../../src/lib/db/types/hbarLimiter/hbarSpending';

chai.use(chaiAsPromised);

describe('SubscriptionRepository', function () {
  this.timeout(10000);

  const logger = pino();
  const registry = new Registry();

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let repository: SubscriptionRepository;

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
      });

      this.afterAll(async () => {
        await redisInMemoryServer.stop();
        process.env.TEST = test;
        process.env.REDIS_ENABLED = redisEnabled;
        process.env.REDIS_URL = redisUrl;
      });
    }

    before(async () => {
      cacheService = new CacheService(logger.child({ name: `CacheService` }), registry);
      repository = new SubscriptionRepository(cacheService, logger.child({ name: `SubscriptionRepository` }));
    });

    after(async () => {
      await cacheService.clear();
      await cacheService.disconnectRedisClient();
    });

    describe('createSubscription', () => {
      it('creates a subscription by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        await expect(repository.getDetailedSubscriptionById(createdSubscription.id)).to.be.eventually.deep.equal(
          createdSubscription,
        );
      });
    });

    describe('getSubscriptionById', () => {
      it('throws an error if subscription not found by ID', async () => {
        await expect(repository.getSubscriptionById('non-existent-id')).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID non-existent-id not found`,
        );
      });

      it('returns a subscription by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        await expect(repository.getSubscriptionById(createdSubscription.id)).to.be.eventually.deep.equal(
          createdSubscription,
        );
      });
    });

    describe('getDetailedSubscriptionById', () => {
      it('throws an error if subscription not found by ID', async () => {
        await expect(repository.getDetailedSubscriptionById('non-existent-id')).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID non-existent-id not found`,
        );
      });

      it('returns a subscription by ID', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        await expect(repository.getDetailedSubscriptionById(createdSubscription.id)).to.be.eventually.deep.equal(
          createdSubscription,
        );
      });
    });

    describe('getSpendingHistory', () => {
      it('throws an error if subscription not found by ID', async () => {
        await expect(repository.getSpendingHistory('non-existent-id')).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID non-existent-id not found`,
        );
      });

      it('returns an empty array if spending history is empty', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        const spendingHistory = await repository.getSpendingHistory(createdSubscription.id);
        expect(spendingHistory).to.deep.equal([]);
      });

      it('retrieves spending history for a subscription', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);

        const key = `${repository['collectionKey']}:${createdSubscription.id}:spendingHistory`;
        const hbarSpending = { amount: 100, timestamp: new Date() } as IHbarSpending;
        await cacheService.rPush(key, hbarSpending, 'test');

        const spendingHistory = await repository.getSpendingHistory(createdSubscription.id);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(hbarSpending.amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');
      });
    });

    describe('addAmountToSpendingHistory', () => {
      it('adds amount to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        await expect(repository.getSpendingHistory(createdSubscription.id)).to.be.eventually.deep.equal([]);

        const amount = 100;
        await repository.addAmountToSpendingHistory(createdSubscription.id, amount);

        const spendingHistory = await repository.getSpendingHistory(createdSubscription.id);
        expect(spendingHistory).to.have.lengthOf(1);
        expect(spendingHistory[0].amount).to.equal(amount);
        expect(spendingHistory[0].timestamp).to.be.a('Date');

        const subscription = await repository.getDetailedSubscriptionById(createdSubscription.id);
        expect(subscription).to.not.be.null;
        expect(subscription!.spendingHistory).to.have.lengthOf(1);
        expect(subscription!.spendingHistory[0].amount).to.equal(amount);
        expect(subscription!.spendingHistory[0].timestamp).to.be.a('Date');
      });

      it('adds multiple amounts to spending history', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        await expect(repository.getSpendingHistory(createdSubscription.id)).to.be.eventually.deep.equal([]);

        const amounts = [100, 200, 300];
        for (const amount of amounts) {
          await repository.addAmountToSpendingHistory(createdSubscription.id, amount);
        }

        const spendingHistory = await repository.getSpendingHistory(createdSubscription.id);
        expect(spendingHistory).to.have.lengthOf(3);
        expect(spendingHistory.map((entry) => entry.amount)).to.deep.equal(amounts);

        const subscription = await repository.getDetailedSubscriptionById(createdSubscription.id);
        expect(subscription).to.not.be.null;
        expect(subscription!.spendingHistory).to.have.lengthOf(3);
        expect(subscription!.spendingHistory.map((entry) => entry.amount)).to.deep.equal(amounts);
      });

      it('throws error if subscription not found when adding to spending history', async () => {
        const id = 'non-existent-id';
        const amount = 100;

        await expect(repository.addAmountToSpendingHistory(id, amount)).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID ${id} not found`,
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

      it('retrieves spent today for a subscription', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdSubscription.id, amount);

        const spentToday = await repository.getSpentToday(createdSubscription.id);
        expect(spentToday).to.equal(amount);
      });

      it('returns 0 if spent today key does not exist', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);

        const spentToday = await repository.getSpentToday(createdSubscription.id);
        expect(spentToday).to.equal(0);
      });

      it('should expire spent today key at the end of the day', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdSubscription.id, amount);
        await expect(repository.getSpentToday(createdSubscription.id)).to.eventually.equal(amount);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        await expect(repository.getSpentToday(createdSubscription.id)).to.eventually.equal(0);
      });
    });

    describe('addAmountToSpentToday', () => {
      it('adds amount to spent today', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);
        const amount = 50;

        await repository.addAmountToSpentToday(createdSubscription.id, amount);

        const subscription = await repository.getDetailedSubscriptionById(createdSubscription.id);
        expect(subscription).to.not.be.null;
        expect(subscription!.spentToday).to.equal(amount);

        // Add more to spent today
        const newAmount = 100;
        await repository.addAmountToSpentToday(createdSubscription.id, newAmount);

        const updatedSubscription = await repository.getDetailedSubscriptionById(createdSubscription.id);
        expect(updatedSubscription).to.not.be.null;
        expect(updatedSubscription!.spentToday).to.equal(amount + newAmount);
      });

      it('throws error if subscription not found when adding to spent today', async () => {
        const id = 'non-existent-id';
        const amount = 50;

        await expect(repository.addAmountToSpentToday(id, amount)).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID ${id} not found`,
        );
      });

      it('throws an error if subscription is not active when adding to spent today', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);

        // Manually set the subscription to inactive
        const key = `${repository['collectionKey']}:${createdSubscription.id}`;
        await cacheService.set(key, { ...createdSubscription, active: false }, 'test');

        const amount = 50;
        await expect(repository.addAmountToSpentToday(createdSubscription.id, amount)).to.be.eventually.rejectedWith(
          SubscriptionNotActiveError,
          `Subscription with ID ${createdSubscription.id} is not active`,
        );
      });
    });

    describe('checkExistsAndActive', () => {
      it('throws error if subscription does not exist when checking if exists and active', async () => {
        const id = 'non-existent-id';
        await expect(repository.checkExistsAndActive(id)).to.be.eventually.rejectedWith(
          SubscriptionNotFoundError,
          `Subscription with ID ${id} not found`,
        );
      });

      it('throws error if subscription is not active when checking if exists and active', async () => {
        const subscriptionType = SubscriptionType.BASIC;
        const createdSubscription = await repository.createSubscription(subscriptionType);

        // Manually set the subscription to inactive
        const key = `${repository['collectionKey']}:${createdSubscription.id}`;
        await cacheService.set(key, { ...createdSubscription, active: false }, 'test');

        await expect(repository.checkExistsAndActive(createdSubscription.id)).to.be.eventually.rejectedWith(
          SubscriptionNotActiveError,
          `Subscription with ID ${createdSubscription.id} is not active`,
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
