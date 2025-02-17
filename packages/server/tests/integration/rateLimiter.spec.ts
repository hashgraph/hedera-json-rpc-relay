// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';
import pino, { Logger } from 'pino';
import { Registry } from 'prom-client';
import sinon from 'sinon';

import { overrideEnvsInMochaDescribe, withOverriddenEnvsInMochaTest } from '../../../relay/tests/helpers';
import RateLimit from '../../src/rateLimit';

describe('RateLimit', () => {
  let logger: Logger;
  let registry: Registry;
  let rateLimit: RateLimit;
  const duration = 1000;

  before(() => {
    logger = pino({ level: 'silent' });
    registry = new Registry();
  });

  overrideEnvsInMochaDescribe({ RATE_LIMIT_DISABLED: false });

  beforeEach(() => {
    rateLimit = new RateLimit(logger, registry, duration);
  });

  afterEach(() => {
    // Restore any stubbed methods
    sinon.restore();
  });

  withOverriddenEnvsInMochaTest({ RATE_LIMIT_DISABLED: true }, () => {
    it('should not rate limit when RATE_LIMIT_DISABLED is true', () => {
      rateLimit = new RateLimit(logger, registry, duration);
      const shouldLimit = rateLimit.shouldRateLimit('127.0.0.1', 'method1', 10, 'requestId');

      expect(shouldLimit).to.be.false;
    });
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

  withOverriddenEnvsInMochaTest({ RATE_LIMIT_DISABLED: true }, () => {
    it('should prioritize environment variable RATE_LIMIT_DISABLED', () => {
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
});
