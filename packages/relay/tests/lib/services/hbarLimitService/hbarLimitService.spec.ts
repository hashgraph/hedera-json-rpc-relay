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
import sinon from 'sinon';
import { HbarLimitService } from '../../../../src/lib/services/hbarLimitService';
import { HbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import pino, { Logger } from 'pino';
import { SubscriptionType } from '../../../../src/lib/db/types/hbarLimiter/subscriptionType';
import {
  EthAddressHbarSpendingPlanNotFoundError,
  HbarSpendingPlanNotActiveError,
  HbarSpendingPlanNotFoundError,
  IPAddressHbarSpendingPlanNotFoundError,
} from '../../../../src/lib/db/types/hbarLimiter/errors';
import { HbarSpendingPlan } from '../../../../src/lib/db/entities/hbarLimiter/hbarSpendingPlan';
import { randomBytes, uuidV4 } from 'ethers';
import { IPAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import { Registry } from 'prom-client';
import { SDKClient } from '../../../../src/lib/clients';

chai.use(chaiAsPromised);

describe('HbarLimitService', function () {
  const logger = pino();
  const register = new Registry();
  const totalBudget = 100_000;
  const mode = SDKClient.transactionMode;
  const methodName = 'testMethod';
  const mockEthAddress = '0x123';
  const mockIPAddress = '555.555.555.555';
  const mockPlanId = uuidV4(randomBytes(16));

  let hbarLimitService: HbarLimitService;
  let hbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<HbarSpendingPlanRepository>;
  let ethAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<EthAddressHbarSpendingPlanRepository>;
  let ipAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<IPAddressHbarSpendingPlanRepository>;
  let loggerSpy: sinon.SinonSpiedInstance<Logger>;

  beforeEach(function () {
    loggerSpy = sinon.spy(logger);
    hbarSpendingPlanRepositoryStub = sinon.createStubInstance(HbarSpendingPlanRepository);
    ethAddressHbarSpendingPlanRepositoryStub = sinon.createStubInstance(EthAddressHbarSpendingPlanRepository);
    ipAddressHbarSpendingPlanRepositoryStub = sinon.createStubInstance(IPAddressHbarSpendingPlanRepository);
    hbarLimitService = new HbarLimitService(
      hbarSpendingPlanRepositoryStub,
      ethAddressHbarSpendingPlanRepositoryStub,
      ipAddressHbarSpendingPlanRepositoryStub,
      logger,
      register,
      totalBudget,
    );
  });

  afterEach(function () {
    sinon.restore();
  });

  function createSpendingPlan(spentToday: number) {
    return new HbarSpendingPlan({
      id: mockPlanId,
      subscriptionType: SubscriptionType.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday,
    });
  }

  describe('resetLimiter', function () {
    // TODO: Add tests here with https://github.com/hashgraph/hedera-json-rpc-relay/issues/2868

    it('should throw an error when resetLimiter is called', async function () {
      try {
        await hbarLimitService.resetLimiter();
      } catch (error: any) {
        expect(error.message).to.equal('Not implemented');
      }
    });
  });

  describe('shouldLimit', function () {
    describe('based on ethAddress', async function () {
      it('should return true if the total daily budget is exceeded', async function () {
        // @ts-ignore
        hbarLimitService.remainingBudget = 0;
        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);
        expect(result).to.be.true;
      });

      it('should create a basic spending plan if none exists for the ethAddress', async function () {
        const newSpendingPlan = createSpendingPlan(0);
        const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
        hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
        ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.false;
        expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
        expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
        expect(
          loggerSpy.warn.calledWithMatch(
            sinon.match.instanceOf(EthAddressHbarSpendingPlanNotFoundError),
            `Failed to get spending plan for eth address '${mockEthAddress}'`,
          ),
        ).to.be.true;
      });

      it('should return true if the limit should be applied', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);

        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.true;
      });

      it('should return false if the limit should not be applied', async function () {
        const spendingPlan = createSpendingPlan(parseInt(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] / 2));

        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.false;
      });

      it('should return false if ethAddress is null or empty', async function () {
        const result = await hbarLimitService.shouldLimit(mode, methodName, '');
        expect(result).to.be.false;
      });

      it('should return true if spentToday is exactly at the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.true;
      });

      it('should return false if spentToday is just below the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] - 1);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.false;
      });

      it('should return true if spentToday is just above the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] + 1);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress);

        expect(result).to.be.true;
      });
    });

    describe('based on ipAddress', async function () {
      it('should return true if the limit should be applied', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });

      it('should return false if the limit should not be applied', async function () {
        const spendingPlan = createSpendingPlan(parseInt(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] / 2));
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress, mockIPAddress);

        expect(result).to.be.false;
      });

      it('should create a basic spending plan if none exists for the ipAddress', async function () {
        const spendingPlan = createSpendingPlan(0);
        const error = new IPAddressHbarSpendingPlanNotFoundError(mockIPAddress);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
        hbarSpendingPlanRepositoryStub.create.resolves(spendingPlan);
        ipAddressHbarSpendingPlanRepositoryStub.save.resolves();

        const result = await hbarLimitService.shouldLimit(mode, methodName, '', mockIPAddress);

        expect(result).to.be.false;
        expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
        expect(ipAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
        expect(
          loggerSpy.warn.calledWithMatch(
            sinon.match.instanceOf(IPAddressHbarSpendingPlanNotFoundError),
            `Failed to get spending plan for IP address '${mockIPAddress}'`,
          ),
        ).to.be.true;
      });

      it('should return false if ipAddress is null or empty', async function () {
        const result = await hbarLimitService.shouldLimit(mode, methodName, '', '');
        expect(result).to.be.false;
      });

      it('should return true if spentToday is exactly at the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });

      it('should return false if spentToday is just below the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] - 1);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress, mockIPAddress);

        expect(result).to.be.false;
      });

      it('should return true if spentToday is just above the limit', async function () {
        const spendingPlan = createSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] + 1);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });
    });
  });

  describe('getSpendingPlan', function () {
    it(`should return null if neither ethAddress nor ipAddress is provided`, async function () {
      const ipAddresses = ['', null, undefined];
      const ethAddresses = ['', null, undefined];
      const testCases = ethAddresses.flatMap((ethAddress) =>
        ipAddresses.map((ipAddress) => ({ ethAddress, ipAddress })),
      );
      for (const { ethAddress, ipAddress } of testCases) {
        // @ts-ignore
        const result = await hbarLimitService['getSpendingPlan'](ethAddress, ipAddress);
        expect(result).to.be.null;
      }
    });

    it('should return spending plan for ethAddress if ethAddress is provided', async function () {
      const spendingPlan = createSpendingPlan(0);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlan'](mockEthAddress);
      expect(result).to.deep.equal(spendingPlan);
    });

    it('should return spending plan for ipAddress if ipAddress is provided', async function () {
      const spendingPlan = createSpendingPlan(0);
      ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ipAddress: mockIPAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlan']('', mockIPAddress);

      expect(result).to.deep.equal(spendingPlan);
    });

    it('should return null if no spending plan is found for ethAddress', async function () {
      const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);

      const result = await hbarLimitService['getSpendingPlan'](mockEthAddress);

      expect(result).to.be.null;
    });

    it('should return null if no spending plan is found for ipAddress', async function () {
      const error = new IPAddressHbarSpendingPlanNotFoundError(mockIPAddress);
      ipAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);

      const result = await hbarLimitService['getSpendingPlan']('', mockIPAddress);

      expect(result).to.be.null;
    });
  });

  describe('getSpendingPlanByEthAddress', function () {
    const testGetSpendingPlanByEthAddressError = async (error: Error, errorClass: any) => {
      const result = hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress);
      await expect(result).to.be.eventually.rejectedWith(errorClass, error.message);
    };

    it('should handle error when getSpendingPlanByEthAddress throws an EthAddressHbarSpendingPlanNotFoundError', async function () {
      const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
      await testGetSpendingPlanByEthAddressError(error, EthAddressHbarSpendingPlanNotFoundError);
    });

    it('should handle error when getSpendingPlanByEthAddress throws an HbarSpendingPlanNotFoundError', async function () {
      const error = new HbarSpendingPlanNotFoundError(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.rejects(error);
      await testGetSpendingPlanByEthAddressError(error, HbarSpendingPlanNotFoundError);
    });

    it('should handle error when getSpendingPlanByEthAddress throws an HbarSpendingPlanNotActiveError', async function () {
      const error = new HbarSpendingPlanNotActiveError(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.rejects(error);
      await testGetSpendingPlanByEthAddressError(error, HbarSpendingPlanNotActiveError);
    });

    it('should return the spending plan for the given ethAddress', async function () {
      const spendingPlan = createSpendingPlan(0);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress);

      expect(result).to.deep.equal(spendingPlan);
    });
  });

  describe('createBasicSpendingPlan', function () {
    const testCreateBasicSpendingPlan = async (ethAddress: string, ipAddress?: string) => {
      const newSpendingPlan = createSpendingPlan(0);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

      const result = await hbarLimitService['createBasicSpendingPlan'](ethAddress, ipAddress);

      expect(result).to.deep.equal(newSpendingPlan);
      expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
      if (ethAddress) {
        expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
      }
      if (ipAddress) {
        expect(ipAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.eq(!!ipAddress);
      }
    };

    it('should create a basic spending plan for the given ethAddress', async function () {
      await testCreateBasicSpendingPlan(mockEthAddress);
    });

    it('should create a basic spending plan for the given ipAddress', async function () {
      await testCreateBasicSpendingPlan('', mockIPAddress);
    });

    it('should create a basic spending plan and link it to the ETH address if both ethAddress and ipAddress are provided', async function () {
      await testCreateBasicSpendingPlan(mockEthAddress, '127.0.0.1');
    });

    it('should create a basic spending plan if none exists', async function () {
      const newSpendingPlan = createSpendingPlan(0);
      await testCreateBasicSpendingPlan(mockEthAddress, '127.0.0.1');
    });
  });

  describe('addExpense', function () {
    const testAddExpense = async (ethAddress: string, ipAddress?: string) => {
      const existingSpendingPlan = createSpendingPlan(0);
      if (ethAddress) {
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress,
          planId: mockPlanId,
        });
      } else if (ipAddress) {
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves(existingSpendingPlan);
        hbarSpendingPlanRepositoryStub.create.resolves(existingSpendingPlan);
      } else {
        hbarSpendingPlanRepositoryStub.create.resolves(existingSpendingPlan);
      }
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(existingSpendingPlan);
      hbarSpendingPlanRepositoryStub.addAmountToSpentToday.resolves();
      hbarSpendingPlanRepositoryStub.addAmountToSpendingHistory.resolves();

      await hbarLimitService.addExpense(100, ethAddress, ipAddress);

      expect(hbarSpendingPlanRepositoryStub.addAmountToSpentToday.calledOnceWith(mockPlanId, 100)).to.be.true;
      expect(hbarSpendingPlanRepositoryStub.addAmountToSpendingHistory.calledOnceWith(mockPlanId, 100)).to.be.true;
      // @ts-ignore
      expect(hbarLimitService.remainingBudget).to.equal(hbarLimitService.totalBudget - 100);
      // @ts-ignore
      expect((await hbarLimitService.hbarLimitRemainingGauge.get()).values[0].value).to.equal(
        // @ts-ignore
        hbarLimitService.totalBudget - 100,
      );
    };

    it('should throw an error if neither ethAddress nor ipAddress is provided', async function () {
      const ipAddresses = ['', null, undefined];
      const ethAddresses = ['', null, undefined];
      const testCases = ethAddresses.flatMap((ethAddress) =>
        ipAddresses.map((ipAddress) => ({ ethAddress, ipAddress })),
      );
      for (const { ethAddress, ipAddress } of testCases) {
        // @ts-ignore
        await expect(hbarLimitService.addExpense(100, ethAddress, ipAddress)).to.be.eventually.rejectedWith(
          'Cannot add expense without an eth address or ip address',
        );
      }
    });

    it('should add the expense to the spending plan and update the remaining budget when both ethAddress and ipAddress are provided', async function () {
      await testAddExpense(mockEthAddress, '127.0.0.1');
    });

    it('should add the expense to the spending plan and update the remaining budget when ethAddress is provided but ipAddress is not', async function () {
      await testAddExpense(mockEthAddress, '');
    });

    it('should add the expense to the spending plan and update the remaining budget when ipAddress is provided but ethAddress is not', async function () {
      await testAddExpense('', '127.0.0.1');
    });
  });

  describe('isDailyBudgetExceeded', function () {
    const testIsDailyBudgetExceeded = async (remainingBudget: number, expected: boolean) => {
      // @ts-ignore
      hbarLimitService.remainingBudget = remainingBudget;
      await expect(hbarLimitService['isDailyBudgetExceeded'](mode, methodName)).to.eventually.equal(expected);
    };

    it('should return true when the remaining budget is zero', async function () {
      await testIsDailyBudgetExceeded(0, true);
    });

    it('should return true when the remaining budget is negative', async function () {
      await testIsDailyBudgetExceeded(-1, true);
    });

    it('should handle errors when adding expense fails', async function () {
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(createSpendingPlan(0));
      hbarSpendingPlanRepositoryStub.addAmountToSpentToday.rejects(new Error('Failed to add expense'));

      await expect(hbarLimitService.addExpense(100, mockEthAddress)).to.be.eventually.rejectedWith(
        'Failed to add expense',
      );
    });

    it('should return false when the remaining budget is greater than zero', async function () {
      await testIsDailyBudgetExceeded(100, false);
    });

    it('should update the hbar limit counter when a method is called and the daily budget is exceeded', async function () {
      // @ts-ignore
      const hbarLimitCounterSpy = sinon.spy(hbarLimitService.hbarLimitCounter, <any>'inc');
      await testIsDailyBudgetExceeded(0, true);
      expect(hbarLimitCounterSpy.calledWithMatch({ mode, methodName }, 1)).to.be.true;
    });

    it('should reset the limiter when the reset date is reached', async function () {
      // @ts-ignore
      hbarLimitService.reset = new Date();
      // @ts-ignore
      const resetLimiterSpy = sinon.spy(hbarLimitService, 'resetLimiter');
      await expect(testIsDailyBudgetExceeded(0, true)).to.be.eventually.rejectedWith('Not implemented');
      expect(resetLimiterSpy.calledOnce).to.be.true;
    });
  });
});
