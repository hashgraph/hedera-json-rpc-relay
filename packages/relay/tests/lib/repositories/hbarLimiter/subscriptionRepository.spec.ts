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
import { RedisClientType, createClient } from 'redis';
import { RedisInMemoryServer } from '../../../redisInMemoryServer';
import { SubscriptionRepository } from '../../../../src/lib/db/repositories/hbarLimiter/subscriptionRepository';
import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';

chai.use(chaiAsPromised);

describe('SubscriptionRepository', function () {
  this.timeout(10000);

  const logger = pino();
  let redisClient: RedisClientType;
  let redisInMemoryServer: RedisInMemoryServer;
  let repository: SubscriptionRepository;

  before(async () => {
    redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 6379);
    await redisInMemoryServer.start();
    redisClient = createClient({ url: 'redis://localhost:6379' });
    await redisClient.connect();
    repository = new SubscriptionRepository(redisClient, logger.child({ name: `SubscriptionRepository` }));
  });

  after(async () => {
    await redisClient.disconnect();
    await redisInMemoryServer.stop();
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
      const amount = 100;
      await redisClient.lPush(key, JSON.stringify({ amount, timestamp: new Date() }));

      const spendingHistory = await repository.getSpendingHistory(createdSubscription.id);
      expect(spendingHistory).to.have.lengthOf(1);
      expect(spendingHistory[0].amount).to.equal(amount);
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
        `Subscription with ID ${id} not found`,
      );
    });
  });

  describe('getSpentToday', () => {
    let oneDayInSeconds: number;

    beforeEach(() => {
      oneDayInSeconds = repository['oneDayInSeconds']; // save the oneDayInSeconds value
      // @ts-ignore
      repository['oneDayInSeconds'] = 1; // set oneDayInSeconds to 1 second for testing
    });

    afterEach(() => {
      // @ts-ignore
      repository['oneDayInSeconds'] = oneDayInSeconds; // reset the oneDayInSeconds value
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
        `Subscription with ID ${id} not found`,
      );
    });

    it('throws an error if subscription is not active when adding to spent today', async () => {
      const subscriptionType = SubscriptionType.BASIC;
      const createdSubscription = await repository.createSubscription(subscriptionType);

      // Manually set the subscription to inactive
      await redisClient.hSet(
        repository['collectionKey'],
        createdSubscription.id,
        JSON.stringify({ ...createdSubscription, active: false }),
      );

      const amount = 50;
      await expect(repository.addAmountToSpentToday(createdSubscription.id, amount)).to.be.eventually.rejectedWith(
        `Subscription with ID ${createdSubscription.id} is not active`,
      );
    });
  });

  describe('checkExistsAndActive', () => {
    it('throws error if subscription does not exist when checking if exists and active', async () => {
      const id = 'non-existent-id';
      await expect(repository.checkExistsAndActive(id)).to.be.eventually.rejectedWith(
        `Subscription with ID ${id} not found`,
      );
    });

    it('throws error if subscription is not active when checking if exists and active', async () => {
      const subscriptionType = SubscriptionType.BASIC;
      const createdSubscription = await repository.createSubscription(subscriptionType);

      // Manually set the subscription to inactive
      await redisClient.hSet(
        repository['collectionKey'],
        createdSubscription.id,
        JSON.stringify({ ...createdSubscription, active: false }),
      );

      await expect(repository.checkExistsAndActive(createdSubscription.id)).to.be.eventually.rejectedWith(
        `Subscription with ID ${createdSubscription.id} is not active`,
      );
    });
  });
});
