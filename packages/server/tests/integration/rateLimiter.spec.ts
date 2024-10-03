/*-
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

import { expect } from 'chai';
import sinon from 'sinon';
import { Registry } from 'prom-client';
import pino, { Logger } from 'pino';
import RateLimit from '../../src/rateLimit';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { configServiceTestHelper } from '../../../config-service/tests/configServiceTestHelper';

describe('RateLimit', () => {
  let logger: Logger;
  let registry: Registry;
  let rateLimit: RateLimit;
  const duration = 1000;

  before(() => {
    logger = pino();
    registry = new Registry();
  });

  beforeEach(() => {
    configServiceTestHelper.dynamicOverride('RATE_LIMIT_DISABLED', false);
    // Create a new instance of RateLimit
    rateLimit = new RateLimit(logger, registry, duration);
  });

  afterEach(() => {
    // Restore any stubbed methods
    sinon.restore();
  });

  it('should not rate limit when RATE_LIMIT_DISABLED is true', () => {
    configServiceTestHelper.dynamicOverride('RATE_LIMIT_DISABLED', true);
    rateLimit = new RateLimit(logger, registry, duration);
    const shouldLimit = rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    expect(shouldLimit).to.be.false;
  });

  it('should set a new IP and method when first encountered', () => {
    rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    const database = (rateLimit as any).database;

    expect(database['127.0.0.1']).to.exist;
    expect(database['127.0.0.1'].methodInfo['method1']).to.exist;
    expect(database['127.0.0.1'].methodInfo['method1'].remaining).to.equal(9);
  });

  it('should decrease remaining calls on subsequent requests', () => {
    rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    const shouldLimit = rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    const database = (rateLimit as any).database;

    expect(shouldLimit).to.be.false;
    expect(database['127.0.0.1'].methodInfo['method1'].remaining).to.equal(8);
  });

  it('should rate limit when remaining calls are exhausted', () => {
    for (let i = 0; i < 10; i++) {
      rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');
    }

    const shouldLimit = rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    const database = (rateLimit as any).database;

    expect(shouldLimit).to.be.true;
    expect(database['127.0.0.1'].methodInfo['method1'].remaining).to.equal(0);
  });

  it('should reset rate limit after duration', (done) => {
    rateLimit.shouldRateLimit('127.0.0.1', 'method1', 1, 'requestId');

    setTimeout(() => {
      const shouldLimit = rateLimit.shouldRateLimit('127.0.0.1', 'method1', 1, 'requestId');

      const database = (rateLimit as any).database;

      expect(shouldLimit).to.be.false;
      expect(database['127.0.0.1'].methodInfo['method1'].remaining).to.equal(0);
      done();
    }, duration + 1); // Adding 1ms to ensure the reset happens
  });

  it('should log a warning and increment counter when rate limited', () => {
    const logSpy = sinon.spy(logger, 'warn');
    const counterSpy = sinon.spy(rateLimit['ipRateLimitCounter'], 'inc');

    for (let i = 0; i < 10; i++) {
      rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');
    }

    rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    expect(logSpy.calledOnce).to.be.true;
    expect(counterSpy.calledOnce).to.be.true;
  });

  it('should prioritize environment variable RATE_LIMIT_DISABLED', () => {
    configServiceTestHelper.dynamicOverride('RATE_LIMIT_DISABLED', true);

    const logSpy = sinon.spy(logger, 'warn');
    const counterSpy = sinon.spy(rateLimit['ipRateLimitCounter'], 'inc');

    for (let i = 0; i < 10; i++) {
      rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');
    }

    rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

    expect(logSpy.called).to.be.false;
    expect(counterSpy.called).to.be.false;
  });
});
