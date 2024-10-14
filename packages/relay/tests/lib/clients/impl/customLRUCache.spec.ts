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

import findConfig from 'find-config';
import fs from 'fs';
import pino from 'pino';
import { expect } from 'chai';
import { CustomLRUCache } from '../../../../src/lib/clients/cache/impl/customLRUCache';
import { SpendingPlanConfig } from '../../../../src/lib/types/spendingPlanConfig';
import { overrideEnvsInMochaDescribe, random20BytesAddress, randomIpAddress } from '../../../helpers';
import { randomUUID } from 'node:crypto';
import { SubscriptionTier } from '../../../../src/lib/db/types/hbarLimiter/subscriptionTier';

describe('CustomLRUCache', () => {
  let cache: CustomLRUCache<string, any>;

  const logger = pino();
  const spendingPlansConfigFile = 'spendingPlansConfig.example.json';
  const path = findConfig(spendingPlansConfigFile);
  const spendingPlansConfig = JSON.parse(fs.readFileSync(path!, 'utf-8')) as SpendingPlanConfig[];

  overrideEnvsInMochaDescribe({ HBAR_SPENDING_PLANS_CONFIG_FILE: spendingPlansConfigFile });

  before(() => {
    cache = new CustomLRUCache<string, any>(logger, { max: 10 });
  });

  describe('delete', () => {
    it('deletes a non-protected key', () => {
      cache.set('nonProtectedKey', 'value');
      expect(cache.delete('nonProtectedKey')).to.be.true;
      expect(cache.has('nonProtectedKey')).to.be.false;
    });

    it('does not delete a protected HbarSpendingPlan key', () => {
      const protectedKey = `hbarSpendingPlan:${spendingPlansConfig[0].id}`;
      cache.set(protectedKey, spendingPlansConfig[0]);
      expect(cache.delete(protectedKey)).to.be.false;
      expect(cache.has(protectedKey)).to.be.true;
    });

    it('does not delete a protected EthAddressHbarSpendingPlan key', () => {
      const ethAddressPlan = spendingPlansConfig.find((plan) => !!plan.ethAddresses);
      if (!ethAddressPlan || !ethAddressPlan.ethAddresses) {
        expect.fail('No spending plan with ethAddresses found');
      }

      const protectedKey = `ethAddressHbarSpendingPlan:${ethAddressPlan.ethAddresses[0]}`;
      cache.set(protectedKey, 'value');
      expect(cache.delete(protectedKey)).to.be.false;
      expect(cache.has(protectedKey)).to.be.true;
    });

    it('does not delete a protected IpAddressHbarSpendingPlan key', () => {
      const ipAddressPlan = spendingPlansConfig.find((plan) => !!plan.ipAddresses);
      if (!ipAddressPlan || !ipAddressPlan.ipAddresses) {
        expect.fail('No spending plan with ipAddresses found');
      }

      const protectedKey = `ipAddressHbarSpendingPlan:${ipAddressPlan.ipAddresses[0]}`;
      cache.set(protectedKey, 'value');
      expect(cache.delete(protectedKey)).to.be.false;
      expect(cache.has(protectedKey)).to.be.true;
    });

    it('deletes a HbarSpendingPlan key that is not in the spending plans config', () => {
      const nonProtectedKey = `hbarSpendingPlan:${randomUUID()}`;
      cache.set(nonProtectedKey, 'value');
      expect(cache.delete(nonProtectedKey)).to.be.true;
      expect(cache.has(nonProtectedKey)).to.be.false;
    });

    it('deletes a EthAddressHbarSpendingPlan key that is not in the spending plans config', () => {
      const nonProtectedKey = `ethAddressHbarSpendingPlan:${random20BytesAddress()}`;
      cache.set(nonProtectedKey, 'value');
      expect(cache.delete(nonProtectedKey)).to.be.true;
      expect(cache.has(nonProtectedKey)).to.be.false;
    });

    it('deletes a IpAddressHbarSpendingPlan key that is not in the spending plans config', () => {
      const nonProtectedKey = `ipAddressHbarSpendingPlan:${randomIpAddress()}`;
      cache.set(nonProtectedKey, 'value');
      expect(cache.delete(nonProtectedKey)).to.be.true;
      expect(cache.has(nonProtectedKey)).to.be.false;
    });

    describe('given empty spending plans config', () => {
      overrideEnvsInMochaDescribe({ HBAR_SPENDING_PLANS_CONFIG_FILE: 'nonExistentFile.json' });

      it('deletes a non-protected HbarSpendingPlan key', () => {
        cache = new CustomLRUCache<string, any>(logger, { max: 10 });

        const spendingPlanKey = `hbarSpendingPlan:${randomUUID()}`;
        cache.set(spendingPlanKey, { id: randomUUID(), name: 'test', subscriptionTier: SubscriptionTier.BASIC });
        expect(cache.delete(spendingPlanKey)).to.be.true;
        expect(cache.has(spendingPlanKey)).to.be.false;
      });

      it('deletes a non-protected EthAddressHbarSpendingPlan key', () => {
        const ethAddressPlanKey = `ethAddressHbarSpendingPlan:${random20BytesAddress()}`;
        cache.set(ethAddressPlanKey, 'value');
        expect(cache.delete(ethAddressPlanKey)).to.be.true;
        expect(cache.has(ethAddressPlanKey)).to.be.false;
      });

      it('deletes a non-protected IpAddressHbarSpendingPlan key', () => {
        const ipAddressPlanKey = `ipAddressHbarSpendingPlan:${randomIpAddress()}`;
        cache.set(ipAddressPlanKey, 'value');
        expect(cache.delete(ipAddressPlanKey)).to.be.true;
        expect(cache.has(ipAddressPlanKey)).to.be.false;
      });
    });
  });

  describe('deleteUnsafe', () => {
    it('deletes a non-protected key', () => {
      cache.set('nonProtectedKey', 'value');
      expect(cache.delete('nonProtectedKey')).to.be.true;
      expect(cache.has('nonProtectedKey')).to.be.false;
    });

    it('deletes a protected HbarSpendingPlan key', () => {
      const protectedKey = `hbarSpendingPlan:${spendingPlansConfig[0].id}`;
      cache.set(protectedKey, spendingPlansConfig[0]);
      expect(cache.delete(protectedKey)).to.be.true;
      expect(cache.has(protectedKey)).to.be.false;
    });

    it('deletes a protected EthAddressHbarSpendingPlan key', () => {
      const ethAddressPlan = spendingPlansConfig.find((plan) => !!plan.ethAddresses);
      if (!ethAddressPlan || !ethAddressPlan.ethAddresses) {
        expect.fail('No spending plan with ethAddresses found');
      }

      const protectedKey = `ethAddressHbarSpendingPlan:${ethAddressPlan.ethAddresses[0]}`;
      cache.set(protectedKey, 'value');
      expect(cache.delete(protectedKey)).to.be.true;
      expect(cache.has(protectedKey)).to.be.false;
    });

    it('deletes a protected IpAddressHbarSpendingPlan key', () => {
      const ipAddressPlan = spendingPlansConfig.find((plan) => !!plan.ipAddresses);
      if (!ipAddressPlan || !ipAddressPlan.ipAddresses) {
        expect.fail('No spending plan with ipAddresses found');
      }

      const protectedKey = `ipAddressHbarSpendingPlan:${ipAddressPlan.ipAddresses[0]}`;
      cache.set(protectedKey, 'value');
      expect(cache.delete(protectedKey)).to.be.true;
      expect(cache.has(protectedKey)).to.be.false;
    });
  });
});
