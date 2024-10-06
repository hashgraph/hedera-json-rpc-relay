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

import { ConfigServiceTestHelper } from '../../../config-service/tests/configServiceTestHelper';
import { expect } from 'chai';
import sinon from 'sinon';
import pino from 'pino';
import { Registry } from 'prom-client';
import { RelayImpl } from '../../src';

describe('RelayImpl', () => {
  const logger = pino();
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

  it('should return the correct subscription implementation when enabled', () => {
    ConfigServiceTestHelper.dynamicOverride('SUBSCRIPTIONS_ENABLED', true);
    relay = new RelayImpl(logger, register);

    const subs = relay.subs();
    expect(subs).to.not.be.undefined;
  });

  it('should return undefined subscription implementation when not enabled', () => {
    ConfigServiceTestHelper.dynamicOverride('SUBSCRIPTIONS_ENABLED', false);
    relay = new RelayImpl(logger, register);

    const subs = relay.subs();
    expect(subs).to.be.undefined;
  });
});
