/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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
import fs from 'fs';
import pino from 'pino';
import { Registry } from 'prom-client';
import sinon from 'sinon';

import { RelayImpl } from '../../src';
import { overrideEnvsInMochaDescribe, withOverriddenEnvsInMochaTest } from '../helpers';

chai.use(chaiAsPromised);

describe('RelayImpl', () => {
  const logger = pino({ level: 'silent' });
  const register = new Registry();
  let relay: RelayImpl;

  beforeEach(() => {
    relay = new RelayImpl(logger, register);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should initialize correctly with valid parameters', () => {
    expect(relay).to.be.an.instanceof(RelayImpl);
  });

  it('should return the correct web3 implementation', () => {
    const web3 = relay.web3();
    expect(web3).to.not.be.undefined;
  });

  it('should return the correct net implementation', () => {
    const net = relay.net();
    expect(net).to.not.be.undefined;
  });

  it('should return the correct eth implementation', () => {
    const eth = relay.eth();
    expect(eth).to.not.be.undefined;
  });

  withOverriddenEnvsInMochaTest({ SUBSCRIPTIONS_ENABLED: true }, () => {
    it('should return the correct subscription implementation when enabled', () => {
      relay = new RelayImpl(logger, register);

      const subs = relay.subs();
      expect(subs).to.not.be.undefined;
    });
  });

  withOverriddenEnvsInMochaTest({ SUBSCRIPTIONS_ENABLED: false }, () => {
    it('should return undefined subscription implementation when not enabled', () => {
      relay = new RelayImpl(logger, register);

      const subs = relay.subs();
      expect(subs).to.be.undefined;
    });
  });

  describe('populatePreconfiguredSpendingPlans', () => {
    let loggerSpy: sinon.SinonSpiedInstance<pino.Logger>;
    let populatePreconfiguredSpendingPlansSpy: sinon.SinonSpy;

    beforeEach(() => {
      loggerSpy = sinon.spy(logger);
      populatePreconfiguredSpendingPlansSpy = sinon.spy(RelayImpl.prototype, <any>'populatePreconfiguredSpendingPlans');
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('when a configuration file is provided', () => {
      overrideEnvsInMochaDescribe({ HBAR_SPENDING_PLANS_CONFIG: 'spendingPlansConfig.example.json' });

      it('should populate preconfigured spending plans successfully', async () => {
        expect((relay = new RelayImpl(logger, register))).to.not.throw;

        expect(populatePreconfiguredSpendingPlansSpy.calledOnce).to.be.true;
        await expect(populatePreconfiguredSpendingPlansSpy.returnValues[0]).to.not.be.rejected;
        expect(loggerSpy.info.calledWith('Pre-configured spending plans populated successfully')).to.be.true;
      });
    });

    describe('when no configuration file is provided', () => {
      const nonExistingFile = 'nonExistingFile.json';
      overrideEnvsInMochaDescribe({ HBAR_SPENDING_PLANS_CONFIG: nonExistingFile });

      it('should not throw an error', async () => {
        expect((relay = new RelayImpl(logger, register))).to.not.throw;

        expect(populatePreconfiguredSpendingPlansSpy.calledOnce).to.be.true;
        await expect(populatePreconfiguredSpendingPlansSpy.returnValues[0]).to.not.be.rejected;
        expect(loggerSpy.warn.notCalled).to.be.true;
      });
    });

    describe('when a configuration file with invalid JSON is provided', () => {
      overrideEnvsInMochaDescribe({ HBAR_SPENDING_PLANS_CONFIG: 'spendingPlansConfig.example.json' });

      beforeEach(() => {
        sinon.stub(fs, 'readFileSync').returns('invalid JSON');
      });

      it('should log a warning', async () => {
        expect((relay = new RelayImpl(logger, register))).to.not.throw;

        expect(populatePreconfiguredSpendingPlansSpy.calledOnce).to.be.true;
        await expect(populatePreconfiguredSpendingPlansSpy.returnValues[0]).not.to.be.rejected;

        const message = `Failed to load pre-configured spending plans: File error: Unexpected token 'i', "invalid JSON" is not valid JSON`;
        expect(loggerSpy.warn.calledWith(message)).to.be.true;
      });
    });
  });
});
