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

chai.use(chaiAsPromised);

describe('HbarLimitService', function () {
  const logger = pino();
  const mockEthAddress = '0x123';
  const mockIPAddress = '192.168.0.1';
  const mockPlanId = uuidV4(randomBytes(16));

  let hbarLimitService: HbarLimitService;
  let hbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<HbarSpendingPlanRepository>;
  let ethAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<EthAddressHbarSpendingPlanRepository>;
  let ipAddressHbarSpendingPlanRepositoryStub: sinon.SinonStubbedInstance<IPAddressHbarSpendingPlanRepository>;
  let loggerSpy: sinon.SinonSpiedInstance<Logger>;

  let mockBasicHbarSpendingPlan = (spentToday: Number) => {
    return new HbarSpendingPlan({
      id: mockPlanId,
      subscriptionType: SubscriptionType.BASIC,
      createdAt: new Date(),
      active: true,
      spendingHistory: [],
      spentToday,
    });
  };

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
    );
  });

  afterEach(function () {
    sinon.restore();
  });

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
      it('should return true if the limit should be applied', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);

        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

        expect(result).to.be.true;
      });

      it('should return false if the limit should not be applied', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(
          parseInt(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] / 2),
        );

        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

        expect(result).to.be.false;
      });

      it('should create a basic spending plan if none exists for the ethAddress', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(0);
        const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
        hbarSpendingPlanRepositoryStub.create.resolves(spendingPlan);
        ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

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

      it('should return false if ethAddress is null or empty', async function () {
        const result = await hbarLimitService.shouldLimit('');
        expect(result).to.be.false;
      });

      it('should return true if spentToday is exactly at the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);

        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

        expect(result).to.be.true;
      });

      it('should return false if spentToday is just below the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] - 1);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

        expect(result).to.be.false;
      });

      it('should return true if spentToday is just above the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] + 1);
        ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ethAddress: mockEthAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress);

        expect(result).to.be.true;
      });
    });

    describe('based on ipAddress', async function () {
      it('should return true if the limit should be applied', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });

      it('should return false if the limit should not be applied', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(
          parseInt(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] / 2),
        );
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress, mockIPAddress);

        expect(result).to.be.false;
      });

      it('should create a basic spending plan if none exists for the ipAddress', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(0);
        const error = new IPAddressHbarSpendingPlanNotFoundError(mockIPAddress);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);
        hbarSpendingPlanRepositoryStub.create.resolves(spendingPlan);
        ipAddressHbarSpendingPlanRepositoryStub.save.resolves();

        const result = await hbarLimitService.shouldLimit('', mockIPAddress);

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
        const result = await hbarLimitService.shouldLimit('', '');
        expect(result).to.be.false;
      });

      it('should return true if spentToday is exactly at the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC]);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });

      it('should return false if spentToday is just below the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] - 1);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress, mockIPAddress);

        expect(result).to.be.false;
      });

      it('should return true if spentToday is just above the limit', async function () {
        const spendingPlan = mockBasicHbarSpendingPlan(HbarLimitService.DAILY_LIMITS[SubscriptionType.BASIC] + 1);
        ipAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
          ipAddress: mockIPAddress,
          planId: mockPlanId,
        });
        hbarSpendingPlanRepositoryStub.findByIdWithDetails.resolves(spendingPlan);

        const result = await hbarLimitService.shouldLimit(mockEthAddress, mockIPAddress);

        expect(result).to.be.true;
      });
    });
  });

  describe('getSpendingPlan', function () {
    const ipAddresses = ['127.0.0.1', '', null, undefined];
    const ethAddresses = ['0x123', '', null, undefined];
    const testCases = ethAddresses.flatMap((ethAddress) => ipAddresses.map((ipAddress) => ({ ethAddress, ipAddress })));

    for (const { ethAddress, ipAddress } of testCases) {
      it(`should return null if ethAddress is ${ethAddress} and ipAddress is ${ipAddress}`, async function () {
        // @ts-ignore
        const result = await hbarLimitService['getSpendingPlan'](ethAddress, ipAddress);
        expect(result).to.be.null;
      });
    }
  });

  describe('getSpendingPlanByEthAddress', function () {
    it('should handle error when getSpendingPlanByEthAddress throws an EthAddressHbarSpendingPlanNotFoundError', async function () {
      const error = new EthAddressHbarSpendingPlanNotFoundError(mockEthAddress);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.rejects(error);

      const result = hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress);

      await expect(result).to.be.eventually.rejectedWith(EthAddressHbarSpendingPlanNotFoundError, error.message);
    });

    it('should handle error when getSpendingPlanByEthAddress throws an HbarSpendingPlanNotFoundError', async function () {
      const error = new HbarSpendingPlanNotFoundError(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.rejects(error);

      const result = hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress);

      await expect(result).to.be.eventually.rejectedWith(HbarSpendingPlanNotFoundError, error.message);
    });

    it('should handle error when getSpendingPlanByEthAddress throws an HbarSpendingPlanNotActiveError', async function () {
      const error = new HbarSpendingPlanNotActiveError(mockPlanId);
      ethAddressHbarSpendingPlanRepositoryStub.findByAddress.resolves({
        ethAddress: mockEthAddress,
        planId: mockPlanId,
      });
      hbarSpendingPlanRepositoryStub.findByIdWithDetails.rejects(error);

      const result = hbarLimitService['getSpendingPlanByEthAddress'](mockEthAddress);

      await expect(result).to.be.eventually.rejectedWith(HbarSpendingPlanNotActiveError, error.message);
    });
  });

  describe('createBasicSpendingPlan', function () {
    it('should create a basic spending plan for the given ethAddress', async function () {
      const newSpendingPlan = mockBasicHbarSpendingPlan(0);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

      const result = await hbarLimitService['createBasicSpendingPlan'](mockEthAddress);

      expect(result).to.deep.equal(newSpendingPlan);
      expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
      expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
    });

    it('should create a basic spending plan and link it to the ETH address if both ethAddress and ipAddress are provided', async function () {
      const newSpendingPlan = mockBasicHbarSpendingPlan(0);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ethAddressHbarSpendingPlanRepositoryStub.save.resolves();

      const result = await hbarLimitService['createBasicSpendingPlan'](mockEthAddress, '127.0.0.1');

      expect(result).to.deep.equal(newSpendingPlan);
      expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
      expect(ethAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
      expect(ipAddressHbarSpendingPlanRepositoryStub.save.called).to.be.false;
    });

    it('should create a basic spending plan for the given ipAddress', async function () {
      const newSpendingPlan = mockBasicHbarSpendingPlan(0);
      hbarSpendingPlanRepositoryStub.create.resolves(newSpendingPlan);
      ipAddressHbarSpendingPlanRepositoryStub.save.resolves();

      const result = await hbarLimitService['createBasicSpendingPlan']('', mockIPAddress);

      expect(result).to.deep.equal(newSpendingPlan);
      expect(hbarSpendingPlanRepositoryStub.create.calledOnce).to.be.true;
      expect(ipAddressHbarSpendingPlanRepositoryStub.save.calledOnce).to.be.true;
      expect(ethAddressHbarSpendingPlanRepositoryStub.save.called).to.be.false;
    });
  });
});