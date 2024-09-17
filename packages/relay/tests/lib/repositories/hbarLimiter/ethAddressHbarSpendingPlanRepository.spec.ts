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

import { EnvProviderService } from '@hashgraph/env-provider/dist/services';
EnvProviderService.hotReload();
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { EthAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { CacheService } from '../../../../src/lib/services/cacheService/cacheService';
import pino from 'pino';
import { IEthAddressHbarSpendingPlan } from '../../../../src/lib/db/types/hbarLimiter/ethAddressHbarSpendingPlan';
import { EthAddressHbarSpendingPlanNotFoundError } from '../../../../src/lib/db/types/hbarLimiter/errors';
import { randomBytes, uuidV4 } from 'ethers';
import { Registry } from 'prom-client';
import { useInMemoryRedisServer } from '../../../helpers';

chai.use(chaiAsPromised);

describe('EthAddressHbarSpendingPlanRepository', function () {
  const logger = pino();
  const registry = new Registry();

  const tests = (isSharedCacheEnabled: boolean) => {
    let cacheService: CacheService;
    let repository: EthAddressHbarSpendingPlanRepository;

    if (isSharedCacheEnabled) {
      useInMemoryRedisServer(logger, 6382);

      this.beforeAll(async () => {
        cacheService = new CacheService(logger.child({ name: 'CacheService' }), new Registry());
        repository = new EthAddressHbarSpendingPlanRepository(
          cacheService,
          logger.child({ name: 'EthAddressHbarSpendingPlanRepository' }),
        );
      });

      this.afterAll(async () => {
        await cacheService.disconnectRedisClient();
      });
    } else {
      before(() => {
        EnvProviderService.getInstance().dynamicOverride('TEST', 'true');
        EnvProviderService.getInstance().dynamicOverride('REDIS_ENABLED', 'false');
        cacheService = new CacheService(logger.child({ name: 'CacheService' }), registry);
        repository = new EthAddressHbarSpendingPlanRepository(
          cacheService,
          logger.child({ name: 'EthAddressHbarSpendingPlanRepository' }),
        );
      });
    }

    describe('findByAddress', () => {
      it('retrieves an address plan by address', async () => {
        const ethAddress = '0x123';
        const addressPlan: IEthAddressHbarSpendingPlan = { ethAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ethAddress}`, addressPlan, 'test');

        const result = await repository.findByAddress(ethAddress);
        expect(result).to.deep.equal(addressPlan);
      });

      it('throws an error if address plan is not found', async () => {
        const ethAddress = '0xnonexistent';
        await expect(repository.findByAddress(ethAddress)).to.be.eventually.rejectedWith(
          EthAddressHbarSpendingPlanNotFoundError,
          `EthAddressHbarSpendingPlan with address ${ethAddress} not found`,
        );
      });
    });

    describe('save', () => {
      it('saves an address plan successfully', async () => {
        const ethAddress = '0x123';
        const addressPlan: IEthAddressHbarSpendingPlan = { ethAddress, planId: uuidV4(randomBytes(16)) };

        await repository.save(addressPlan);
        const result = await cacheService.getAsync<IEthAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ethAddress}`,
          'test',
        );
        expect(result).to.deep.equal(addressPlan);
      });

      it('overwrites an existing address plan', async () => {
        const ethAddress = '0x123';
        const addressPlan: IEthAddressHbarSpendingPlan = { ethAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ethAddress}`, addressPlan, 'test');

        const newPlanId = uuidV4(randomBytes(16));
        const newAddressPlan: IEthAddressHbarSpendingPlan = { ethAddress, planId: newPlanId };
        await repository.save(newAddressPlan);
        const result = await cacheService.getAsync<IEthAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ethAddress}`,
          'test',
        );
        expect(result).to.deep.equal(newAddressPlan);
      });
    });

    describe('delete', () => {
      it('deletes an address plan successfully', async () => {
        const ethAddress = '0x123';
        const addressPlan: IEthAddressHbarSpendingPlan = { ethAddress, planId: uuidV4(randomBytes(16)) };
        await cacheService.set(`${repository['collectionKey']}:${ethAddress}`, addressPlan, 'test');

        await repository.delete(ethAddress);
        const result = await cacheService.getAsync<IEthAddressHbarSpendingPlan>(
          `${repository['collectionKey']}:${ethAddress}`,
          'test',
        );
        expect(result).to.be.null;
      });

      it('does not throw an error if address plan to delete does not exist', async () => {
        const ethAddress = '0xnonexistent';
        await expect(repository.delete(ethAddress)).to.be.fulfilled;
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
