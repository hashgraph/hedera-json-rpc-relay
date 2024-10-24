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
import pino, { Logger } from 'pino';
import chai, { expect } from 'chai';
import { randomBytes, uuidV4 } from 'ethers';
import chaiAsPromised from 'chai-as-promised';
import constants from '../../../../src/lib/constants';
import { Counter, Gauge, Registry } from 'prom-client';
import { HbarLimitService } from '../../../../src/lib/services/hbarLimitService';
import { SubscriptionTier } from '../../../../src/lib/db/types/hbarLimiter/subscriptionTier';
import { HbarSpendingPlan } from '../../../../src/lib/db/entities/hbarLimiter/hbarSpendingPlan';
import { HbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/hbarSpendingPlanRepository';
import { EthAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ethAddressHbarSpendingPlanRepository';
import { IPAddressHbarSpendingPlanRepository } from '../../../../src/lib/db/repositories/hbarLimiter/ipAddressHbarSpendingPlanRepository';
import {
  EthAddressHbarSpendingPlanNotFoundError,
  HbarSpendingPlanNotActiveError,
  HbarSpendingPlanNotFoundError,
  IPAddressHbarSpendingPlanNotFoundError,
} from '../../../../src/lib/db/types/hbarLimiter/errors';
import { RequestDetails } from '../../../../src/lib/types';
import { Hbar } from '@hashgraph/sdk';
import { Long } from 'long';

chai.use(chaiAsPromised);

describe('HBAR Rate Limit Service', function () {
  const logger = pino();
  const register = new Registry();
  const totalBudget = Hbar.fromTinybars(constants.HBAR_RATE_LIMIT_TOTAL);
  const totalBudgetInTinybars = constants.HBAR_RATE_LIMIT_TOTAL.toNumber();
  const limitDuration = constants.HBAR_RATE_LIMIT_DURATION;
  const mode = constants.EXECUTION_MODE.TRANSACTION;
  const methodName = 'testMethod';
  const txConstructorName = 'testConstructorName';
  const mockEthAddress = '0x123';
  const mockIpAddress = 'x.x.x';
  const mockEstimatedTxFee = 300;
  const mockPlanId = uuidV4(randomBytes(16));
  const todayAtMidnight = new Date().setHours(0, 0, 0, 0);

  const requestDetails = new RequestDetails({ requestId: 'hbarLimitServiceTest', ipAddress: mockIpAddress });

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
      limitDuration,
    );
  });

  afterEach(function () {
    sinon.restore();
  });

  function createSpendingPlan(id: string, amountSpent: number | Long | Hbar = 0) {
    return new HbarSpendingPlan({
      id,
      subscriptionTier: SubscriptionTier.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      amountSpent: amountSpent instanceof Hbar ? Number(amountSpent.toTinybars()) : Number(amountSpent),
    });
  }

  it('should initialize metrics correctly', () => {
    expect(hbarLimitService['hbarLimitCounter']).to.be.instanceOf(Counter);
    expect(hbarLimitService['hbarLimitRemainingGauge']).to.be.instanceOf(Gauge);
    Object.values(SubscriptionTier).forEach((tier) => {
      expect(hbarLimitService['uniqueSpendingPlansCounter'][tier]).to.be.instanceOf(Counter);
      expect(hbarLimitService['averageSpendingPlanAmountSpentGauge'][tier]).to.be.instanceOf(Gauge);
    });
  });

  it('should set the reset date properly', () => {
    const times = Math.ceil((Date.now() - todayAtMidnight) / limitDuration);
    const expectedDate = new Date(todayAtMidnight + limitDuration * times);
    const actualDate = hbarLimitService['reset'];
    expect(new Date(actualDate)).to.deep.equal(new Date(expectedDate));
  });

  describe('getResetTimestamp', function () {
    it('should return the current timestamp plus the limit duration', function () {
      const times = Math.ceil((Date.now() - todayAtMidnight) / limitDuration);
      const expectedDate = new Date(todayAtMidnight + limitDuration * times);
      const actualDate = hbarLimitService['reset'];
      expect(new Date(actualDate)).to.deep.equal(new Date(expectedDate));
      expect(hbarLimitService['getResetTimestamp']()).to.deep.equal(expectedDate);
    });

    describe('given a limit duration that is 1 day', function () {
      const limitDuration = 24 * 60 * 60 * 1000; // one day

      it('should return tomorrow at midnight', function () {
        const hbarLimitService = new HbarLimitService(
          hbarSpendingPlanRepositoryStub,
          ethAddressHbarSpendingPlanRepositoryStub,
          ipAddressHbarSpendingPlanRepositoryStub,
          logger,
          register,
          totalBudget,
          limitDuration,
        );
        const tomorrow = new Date(Date.now() + limitDuration);
        const tomorrowAtMidnight = new Date(tomorrow.setHours(0, 0, 0, 0));
        expect(hbarLimitService['getResetTimestamp']()).to.deep.equal(tomorrowAtMidnight);
      });
    });
  });

  describe('resetLimiter', function () {
    beforeEach(() => {
      hbarSpendingPlanRepositoryStub.resetAmountSpentOfAllPlans.resolves();
    });

    afterEach(() => {
      hbarSpendingPlanRepositoryStub.resetAmountSpentOfAllPlans.restore();
    });

    it('should reset the amountSpent field of all spending plans', async function () {
      await hbarLimitService.resetLimiter(requestDetails);
      expect(hbarSpendingPlanRepositoryStub.resetAmountSpentOfAllPlans.called).to.be.true;
    });

    it('should reset the remaining budget and update the gauge', async function () {
      // @ts-ignore
      hbarLimitService.remainingBudget = Hbar.fromTinybars(1000);
      const setSpy = sinon.spy(hbarLimitService['hbarLimitRemainingGauge'], 'set');
      await hbarLimitService.resetLimiter(requestDetails);
      expect(hbarLimitService['remainingBudget'].toTinybars().toNumber()).to.eq(totalBudgetInTinybars);
      expect(setSpy.calledOnceWith(totalBudgetInTinybars)).to.be.true;
    });

    it('should set the reset date to the current timestamp plus the limit duration', async function () {
      const times = Math.ceil((Date.now() - todayAtMidnight) / limitDuration);
      const expectedDate = new Date(todayAtMidnight + limitDuration * times);
      await hbarLimitService.resetLimiter(requestDetails);
      const resetDate = hbarLimitService['reset'];
      expect(new Date(resetDate)).to.deep.equal(new Date(expectedDate));
    });
  });

  describe('shouldLimit', function () {
    describe('based on ethAddress', async function () {
      it('should return true if the total budget is exceeded', async function () {
        // @ts-ignore
        hbarLimitService.remainingBudget = Hbar.fromTinybars(0);
        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );
        expect(result).to.be.true;
      });

      it('should return true when remainingBudget < estimatedTxFee ', async function () {
        // @ts-ignore
        hbarLimitService.remainingBudget = Hbar.fromTinybars(mockEstimatedTxFee - 1);
        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
          mockEstimatedTxFee,
        );
        expect(result).to.be.true;
      });

      it('should create a basic spending plan if none exists for the ethAddress', async function () {
        const newSpendingPlan = createSpendingPlan(mockPlanId);
        const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
        hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
        ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

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

      it('should return false if ethAddress and ipAddress is empty string', async function () {
        const requestDetails = new RequestDetails({ requestId: 'hbarLimterTest', ipAddress: '' });
        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);
        expect(result).to.be.false;
      });

      it('should return true if amountSpent is exactly at the limit', async function () {
        const spendingPlan = createSpendingPlan(mockPlanId, HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC]);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

        expect(result).to.be.true;
      });

      it('should return false if amountSpent is just below the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(1),
        );
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

        expect(result).to.be.false;
      });

      it('should return true if amountSpent is just above the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().add(1),
        );
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

        expect(result).to.be.true;
      });

      it('should return true if amountSpent + estimatedTxFee is above the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee).add(1),
        );
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
          mockEstimatedTxFee,
        );

        expect(result).to.be.true;
      });

      it('should return false if amountSpent + estimatedTxFee is below the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee).sub(1),
        );
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

        expect(result).to.be.false;
      });

      it('should return false if amountSpent + estimatedTxFee is at the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee),
        );
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          mockEthAddress,
          requestDetails,
        );

        expect(result).to.be.false;
      });
    });

    describe('based on ipAddress', async function () {
      it('should return true if the total budget is exceeded', async function () {
        // @ts-ignore
        hbarLimitService.remainingBudget = Hbar.fromTinybars(0);
        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);
        expect(result).to.be.true;
      });

      it('should return true when remainingBudget < estimatedTxFee ', async function () {
        // @ts-ignore
        hbarLimitService.remainingBudget = Hbar.fromTinybars(mockEstimatedTxFee - 1);
        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          '',
          requestDetails,
          mockEstimatedTxFee,
        );
        expect(result).to.be.true;
      });

      it('should return false if ipAddress is null or empty', async function () {
        const requestDetails = new RequestDetails({ requestId: 'hbarLimterTest', ipAddress: '' });
        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);
        expect(result).to.be.false;
      });

      it('should return true if amountSpent is exactly at the limit', async function () {
        const spendingPlan = createSpendingPlan(mockPlanId, HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC]);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);

        expect(result).to.be.true;
      });

      it('should return false if amountSpent is just below the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(1),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);

        expect(result).to.be.false;
      });

      it('should return true if amountSpent is just above the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().add(1),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);

        expect(result).to.be.true;
      });

      it('should return true if amountSpent + estimatedTxFee is above the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee).add(1),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(
          mode,
          methodName,
          txConstructorName,
          '',
          requestDetails,
          mockEstimatedTxFee,
        );

        expect(result).to.be.true;
      });

      it('should return false if amountSpent + estimatedTxFee is below the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee).sub(1),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);

        expect(result).to.be.false;
      });

      it('should return false if amountSpent + estimatedTxFee is at the limit', async function () {
        const spendingPlan = createSpendingPlan(
          mockPlanId,
          HbarLimitService.TIER_LIMITS[SubscriptionTier.BASIC].toTinybars().sub(mockEstimatedTxFee),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIpAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mode, methodName, txConstructorName, '', requestDetails);

        expect(result).to.be.false;
      });
    });
  });

  describe('getSpendingPlan', function () {
    it(`should return null if neither ethAddress nor ipAddress is provided`, async function () {
      const ipAddresses = [''];
      const ethAddresses = [''];
      const testCases = ethAddresses.flatMap((ethAddress) =>
        ipAddresses.map((ipAddress) => ({ ethAddress, ipAddress })),
      );
      for (const { ethAddress, ipAddress } of testCases) {
        // @ts-ignore
        const requestDetails = new RequestDetails({ requestId: 'hbarLimterTest', ipAddress: ipAddress });
        const result = await hbarLimitService['getSpendingPlan'](ethAddress, requestDetails);
        expect(result).to.be.null;
      }
    });

    it('should return spending plan for ethAddress if ethAddress is provided', async function () {
      const spendingPlan = createSpendingPlan(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlan'](mockEthAddress, requestDetails);

      expect(result).to.deep.equal(spendingPlan);
    });

    it('should return spending plan for ipAddress if ipAddress is provided', async function () {
      const spendingPlan = createSpendingPlan(mockPlanId);
      ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ipAddress: mockIpAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlan']('', requestDetails);

      expect(result).to.deep.equal(spendingPlan);
    });

    it('should return null if no spending plan is found for ethAddress', async function () {
      const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);

      const result = await hbarLimitService['getSpendingPlan'](mockEthAddress, requestDetails);

      expect(result).to.be.null;
    });

    it('should return null if no spending plan is found for ipAddress', async function () {
      const error = new IPAddressHbarSpendingPlanNotFoundError(mockIpAddress);
      ipAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);

      const result = await hbarLimitService['getSpendingPlan']('', requestDetails);

      expect(result).to.be.null;
    });
  });

  describe('getSpendingPlanByEthAddress', function () {
    const testGetSpendingPlanByEthAddressError = async (error: Error, errorClass: any) => {
      const result = hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress, requestDetails);
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
      const spendingPlan = createSpendingPlan(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

      const result = await hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress, requestDetails);

      expect(result).to.deep.equal(spendingPlan);
    });
  });

  describe('createBasicSpendingPlan', function () {
    const testCreateBasicSpendingPlan = async (ethAddress: string, ipAddress?: string) => {
      const requestDetails = new RequestDetails({ requestId: 'hbarLimitServiceTest', ipAddress: ipAddress ?? '' });
      const newSpendingPlan = createSpendingPlan(mockPlanId);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

      const promise = hbarLimitService['createBasicSpendingPlan'](ethAddress, requestDetails);

      if (ethAddress) {
        await expect(promise).eventually.to.deep.equal(newSpendingPlan);
        expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
        expect(ipAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.false;
        expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
      } else {
        await expect(promise).to.be.rejectedWith('Cannot create a spending plan without an associated eth address');
        expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.false;
        expect(ipAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.false;
        expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.false;
      }
    };

    it('should create a basic spending plan for the given ethAddress', async function () {
      await testCreateBasicSpendingPlan(mockEthAddress);
    });

    it('should create a basic spending plan and link it only to the given ethAddress, if also an ipAddress is available', async function () {
      await testCreateBasicSpendingPlan(mockEthAddress, '127.0.0.1');
    });

    it('should throw an error if no ethAddress is provided', async function () {
      await testCreateBasicSpendingPlan('');
    });
  });

  describe('addExpense', function () {
    const testAddExpense = async (ethAddress: string, ipAddress: string, expense: number = 100) => {
      const otherPlanOfTheSameTier = createSpendingPlan(uuidV4(randomBytes(16)), 200);
      const existingSpendingPlan = createSpendingPlan(mockPlanId, 0);
      if (ethAddress) {
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress,
          planId: mockPlanId,
        });
      } else if (ipAddress) {
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress,
          planId: mockPlanId,
        });
      } else {
        hbarSpendingPlanRepositoryStub.create.resolves(existingSpendingPlan);
      }
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(existingSpendingPlan);
      hbarSpendingPlanRepositoryStub.addToAmountSpent.resolves();
      hbarSpendingPlanRepositoryStub.findAllActiveBySubscriptionTier.resolves([
        otherPlanOfTheSameTier,
        {
          ...existingSpendingPlan,
          amountSpent: expense,
          spendingHistory: [{ amount: expense, timestamp: new Date() }],
        },
      ]);
      const incUniqueSpendingPlansCounterSpy = sinon.spy(
        hbarLimitService['uniqueSpendingPlansCounter'][SubscriptionTier.BASIC],
        'inc',
      );
      const setAverageSpendingPlanAmountSpentGaugeSpy = sinon.spy(
        hbarLimitService['averageSpendingPlanAmountSpentGauge'][SubscriptionTier.BASIC],
        'set',
      );
      const updateAverageAmountSpentPerSubscriptionTierSpy = sinon.spy(
        hbarLimitService,
        'updateAverageAmountSpentPerSubscriptionTier' as any,
      );

      await hbarLimitService.addExpense(expense, ethAddress, requestDetails);

      expect(hbarSpendingPlanRepositoryStub.addToAmountSpent.calledOnceWith(mockPlanId, expense)).to.be.true;
      expect(hbarLimitService['remainingBudget'].toTinybars().toNumber()).to.eq(
        hbarLimitService['totalBudget'].toTinybars().sub(expense).toNumber(),
      );
      expect((await hbarLimitService['hbarLimitRemainingGauge'].get()).values[0].value).to.equal(
        hbarLimitService['totalBudget'].toTinybars().sub(expense).toNumber(),
      );
      await Promise.all(updateAverageAmountSpentPerSubscriptionTierSpy.returnValues);
      const expectedAverageUsage = Math.round((otherPlanOfTheSameTier.amountSpent + expense) / 2);
      sinon.assert.calledOnceWithExactly(setAverageSpendingPlanAmountSpentGaugeSpy, expectedAverageUsage);
      sinon.assert.calledOnceWithExactly(incUniqueSpendingPlansCounterSpy, 1);
    };

    it('should create a basic spending plan if none exists', async function () {
      const newSpendingPlan = createSpendingPlan(mockPlanId);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(
        new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress),
      );
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

      await hbarLimitService.addExpense(100, mockEthAddress, requestDetails);

      expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
      expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
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

    it('should handle errors when adding expense fails', async function () {
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(createSpendingPlan(mockPlanId));
      hbarSpendingPlanRepositoryStub.addToAmountSpent.rejects(new Error('Failed to add expense'));

      await expect(hbarLimitService.addExpense(100, mockEthAddress, requestDetails)).to.be.eventually.rejectedWith(
        'Failed to add expense',
      );
    });
  });

  describe('isTotalBudgetExceeded', function () {
    const testIsTotalBudgetExceeded = async (remainingBudget: number, expected: boolean) => {
      // @ts-ignore
      hbarLimitService.remainingBudget = Hbar.fromTinybars(remainingBudget);
      await expect(
        hbarLimitService['isTotalBudgetExceeded'](mode, methodName, txConstructorName, 0, requestDetails),
      ).to.eventually.equal(expected);
    };

    it('should return true when the remaining budget is zero', async function () {
      await testIsTotalBudgetExceeded(0, true);
    });

    it('should return true when the remaining budget is negative', async function () {
      await testIsTotalBudgetExceeded(-1, true);
    });

    it('should return false when the remaining budget is greater than zero', async function () {
      await testIsTotalBudgetExceeded(100, false);
    });

    it('should update the hbar limit counter when a method is called and the total budget is exceeded', async function () {
      // @ts-ignore
      const hbarLimitCounterSpy = sinon.spy(hbarLimitService.hbarLimitCounter, <any>'inc');
      await testIsTotalBudgetExceeded(0, true);
      expect(hbarLimitCounterSpy.calledWithMatch({ mode, methodName }, 1)).to.be.true;
    });

    it('should reset the limiter when the reset date is reached', async function () {
      // @ts-ignore
      hbarLimitService.reset = new Date();
      const resetLimiterSpy = sinon.spy(hbarLimitService, 'resetLimiter');
      await testIsTotalBudgetExceeded(0, false);
      expect(resetLimiterSpy.calledOnce).to.be.true;
    });
  });
});
