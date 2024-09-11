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

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { IPAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import pino from 'pino';
import { IIPAddressHbarSpendingPlan } from '../../../../src/lib/db/types/hbarLimiter/ipAddressHbarSpendingPlan';
import { IPAddressHbarSpendingPlanNotFoundError } from '../../../../src/lib/db/types/hbarLimiter/errors';
import { randomBytes, uuidV4 } from 'ethers';
import { Registry } from 'prom-client';
import { RedisInMemoryServer } from '../../../redisInMemoryServer';

chai.use(chaiAsPromised);

describe('IPAddressHbarSpendingPlanRepository', function () {
  const logger = pino();
  const registry = new Registry();

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let repository: IPAddressHbarSpendingPlanRepository;
    const ipAddress = '555.555.555.555';
    const nonExistingIpAddress = 'xxx.xxx.xxx.xxx';

    if (isSharedCacheEnabled) {
      let test: string | undefined;
      let redisEnabled: string | undefined;
      let redisUrl: string | undefined;
      let redisInMemoryServer: RedisInMemoryServer;

      this.beforeAll(async () => {
        redisInMemoryServer = new RedisInMemoryServer(logger.child({ name: `in-memory redis server` }), 6383);
        await redisInMemoryServer.start();
        test = process.env.TEST;
        redisEnabled = process.env.REDIS_ENABLED;
        redisUrl = process.env.REDIS_URL;
        process.env.TEST = 'false';
        process.env.REDIS_ENABLED = 'true';
        process.env.REDIS_URL = 'redis://127.0.0.1:6383';
        cacheService = new CacheService(logger.child({ name: 'CacheService' }), new Registry());
        repository = new IPAddressHbarSpendingPlanRepository(
          cacheService,
          logger.child({ name: 'IPAddressHbarSpendingPlanRepository' }),
        );
      });

      this.afterAll(async () => {
        await redisInMemoryServer.stop();
        process.env.TEST = test;
        process.env.REDIS_ENABLED = redisEnabled;
        process.env.REDIS_URL = redisUrl;
      });
    } else {
      before(() => {
        process.env.TEST = 'true';
        process.env.REDIS_ENABLED = 'false';
        cacheService = new CacheService(logger.child({ name: 'CacheService' }), registry);
        repository = new IPAddressHbarSpendingPlanRepository(
          cacheService,
          logger.child({ name: 'IPAddressHbarSpendingPlanRepository' }),
        );
      });
    }

    describe('findByAddress', () => {
      it('retrieves an address plan by ip', async () => {
        const addressPlan: IIPAddressHbarSpendingPlan = { ipAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ipAddress}`, addressPlan, 'test');

        const result = await repository.findByAddress(ipAddress);
        expect(result).to.deep.equal(addressPlan);
      });

      it('throws an error if address plan is not found', async () => {
        await expect(repository.findByAddress(nonExistingIpAddress)).to.be.eventually.rejectedWith(
          IPAddressHbarSpendingPlanNotFoundError,
          `IPAddressHbarSpendingPlan with address ${nonExistingIpAddress} not found`,
        );
      });
    });

    describe('save', () => {
      it('saves an address plan successfully', async () => {
        const addressPlan: IIPAddressHbarSpendingPlan = { ipAddress, planId: uuidV4(randomBytes(16)) };

        await repository.save(addressPlan);
        const result = await cacheService.getAsync<IIPAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ipAddress}`,
          'test',
        );
        expect(result).to.deep.equal(addressPlan);
      });

      it('overwrites an existing address plan', async () => {
        const addressPlan: IIPAddressHbarSpendingPlan = { ipAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ipAddress}`, addressPlan, 'test');

        const newPlanId = uuidV4(randomBytes(16));
        const newAddressPlan: IIPAddressHbarSpendingPlan = { ipAddress, planId: newPlanId };
        await repository.save(newAddressPlan);
        const result = await cacheService.getAsync<IIPAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ipAddress}`,
          'test',
        );
        expect(result).to.deep.equal(newAddressPlan);
      });
    });

    describe('delete', () => {
      it('deletes an address plan successfully', async () => {
        const addressPlan: IIPAddressHbarSpendingPlan = { ipAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ipAddress}`, addressPlan, 'test');

        await repository.delete(ipAddress);
        const result = await cacheService.getAsync<IIPAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ipAddress}`,
          'test',
        );
        expect(result).to.be.null;
      });

      it('does not throw an error if address plan to delete does not exist', async () => {
        await expect(repository.delete(nonExistingIpAddress)).to.be.fulfilled;
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
