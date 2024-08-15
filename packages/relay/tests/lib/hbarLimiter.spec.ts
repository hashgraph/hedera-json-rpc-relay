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

import pino from 'pino';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import HbarLimit from '../../src/lib/hbarlimiter';
import { random20BytesAddress } from '../helpers';

const registry = new Registry();
const logger = pino();

describe('HBAR Rate Limiter', async function () {
  this.timeout(20000);
  let rateLimiter: HbarLimit;
  let currentDateNow: number;
  const invalidDuration: number = 0;
  const invalidTotal: number = 0;
  const validDuration: number = 60000;
  const validTotal: number = 100000000;
  const randomAccountAddress = random20BytesAddress();
  const randomWhiteListedAccountAddress = random20BytesAddress();

  this.beforeEach(() => {
    currentDateNow = Date.now();
    process.env.HBAR_RATE_LIMIT_WHITELIST = `[${randomWhiteListedAccountAddress}]`;
  });

  this.beforeAll(() => {
    process.env.HBAR_RATE_LIMIT_WHITELIST = `[${randomWhiteListedAccountAddress}]`;
  });

  this.afterAll(() => {
    delete process.env.HBAR_RATE_LIMIT_WHITELIST;
  });

  it('should be disabled, if we pass invalid total', async function () {
    rateLimiter = new HbarLimit(logger, currentDateNow, invalidTotal, validDuration, registry);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call', randomAccountAddress);
    rateLimiter.addExpense(validTotal, currentDateNow);

    expect(isEnabled).to.equal(false);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(currentDateNow);
    expect(limiterRemainingBudget).to.equal(0);
  });

  it('should be disabled, if we pass invalid duration', async function () {
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, invalidDuration, registry);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call', randomAccountAddress);
    rateLimiter.addExpense(validTotal, currentDateNow);

    expect(isEnabled).to.equal(false);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(currentDateNow);
    expect(limiterRemainingBudget).to.equal(0);
  });

  it('should be disabled, if we pass both invalid duration and total', async function () {
    rateLimiter = new HbarLimit(logger, currentDateNow, invalidTotal, invalidDuration, registry);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call', randomAccountAddress);
    rateLimiter.addExpense(validTotal, currentDateNow);

    expect(isEnabled).to.equal(false);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(currentDateNow);
    expect(limiterRemainingBudget).to.equal(0);
  });

  it('should be enabled, if we pass valid duration and total', async function () {
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call', randomAccountAddress);

    expect(isEnabled).to.equal(true);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(currentDateNow + validDuration);
    expect(limiterRemainingBudget).to.equal(validTotal);
  });

  it('should not rate limit', async function () {
    const cost = 10000000;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);
    rateLimiter.addExpense(cost, currentDateNow);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(
      currentDateNow,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );

    expect(isEnabled).to.equal(true);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(currentDateNow + validDuration);
    expect(limiterRemainingBudget).to.equal(validTotal - cost);
  });

  it('should rate limit', async function () {
    const cost = 1000000000;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);
    rateLimiter.addExpense(cost, currentDateNow);

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();
    const shouldRateLimit = rateLimiter.shouldLimit(
      currentDateNow,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );

    expect(isEnabled).to.equal(true);
    expect(shouldRateLimit).to.equal(true);
    expect(limiterResetTime).to.equal(currentDateNow + validDuration);
    expect(limiterRemainingBudget).to.equal(validTotal - cost);
  });

  it('should reset budget, while checking if we should rate limit', async function () {
    const cost = 1000000000;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);
    rateLimiter.addExpense(cost, currentDateNow);

    const isEnabled = rateLimiter.isEnabled();
    const futureDate = currentDateNow + validDuration * 2;
    const shouldRateLimit = rateLimiter.shouldLimit(
      futureDate,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();

    expect(isEnabled).to.equal(true);
    expect(shouldRateLimit).to.equal(false);
    expect(limiterResetTime).to.equal(futureDate + validDuration);
    expect(limiterRemainingBudget).to.equal(validTotal);
  });

  it('should reset budget, while adding expense', async function () {
    const cost = 1000000000;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);

    rateLimiter.addExpense(cost, currentDateNow);
    const shouldRateLimitBefore = rateLimiter.shouldLimit(
      currentDateNow,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );

    const futureDate = currentDateNow + validDuration * 2;
    rateLimiter.addExpense(100, futureDate);
    const shouldRateLimitAfter = rateLimiter.shouldLimit(
      futureDate,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );

    const isEnabled = rateLimiter.isEnabled();
    const limiterResetTime = rateLimiter.getResetTime();
    const limiterRemainingBudget = rateLimiter.getRemainingBudget();

    expect(isEnabled).to.equal(true);
    expect(shouldRateLimitBefore).to.equal(true);
    expect(shouldRateLimitAfter).to.equal(false);
    expect(limiterResetTime).to.equal(futureDate + validDuration);
    expect(limiterRemainingBudget).to.equal(validTotal - 100);
  });

  it('Should preemtively limit while expected transactionFee is greater than remaining balance', () => {
    const validTotalTxFee = validTotal - 100;
    const invalidTotalTxFee = validTotal + 100;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);

    const shouldNotPreemtivelyLimit = rateLimiter.shouldPreemtivelyLimit(randomAccountAddress, validTotalTxFee);
    const shouldPreemtivelyLimit = rateLimiter.shouldPreemtivelyLimit(randomAccountAddress, invalidTotalTxFee);

    expect(shouldPreemtivelyLimit).to.be.true;
    expect(shouldNotPreemtivelyLimit).to.be.false;
  });

  it('Should verify if an account is whitelisted', () => {
    rateLimiter = new HbarLimit(logger, currentDateNow, invalidTotal, validDuration, registry);

    const shoulNotdBeWhiteListed = rateLimiter.isAccountWhiteListed(randomAccountAddress);
    const shouldBeWhiteListed = rateLimiter.isAccountWhiteListed(randomWhiteListedAccountAddress);

    expect(shoulNotdBeWhiteListed).to.be.false;
    expect(shouldBeWhiteListed).to.be.true;
  });

  it('should bypass rate limit if original caller is a white listed account', async function () {
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);

    // add expense to rate limit throttle
    rateLimiter.addExpense(1000000000, currentDateNow);

    // should return true as `randomAccountAddress` is not white listed
    const shouldNOTByPassRateLimit = rateLimiter.shouldLimit(
      currentDateNow,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomAccountAddress,
    );

    // should return false as `randomWhiteListedAccountAddress` is white listed
    const shouldByPassRateLimit = rateLimiter.shouldLimit(
      currentDateNow,
      'TRANSACTION',
      'eth_sendRawTransaction',
      randomWhiteListedAccountAddress,
    );

    expect(shouldByPassRateLimit).to.equal(false);
    expect(shouldNOTByPassRateLimit).to.equal(true);
  });

  it('Should bypass preemtively limit if original caller is a white listed account', () => {
    const totalTxFee = validTotal + 100;
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);

    // should return true as `randomAccountAddress` is not white listed
    const shouldNOTByPassPreemtiveRateLimit = rateLimiter.shouldPreemtivelyLimit(randomAccountAddress, totalTxFee);

    // should return false as `randomWhiteListedAccountAddress` is white listed
    const shouldByPassPreemtiveRateLimit = rateLimiter.shouldPreemtivelyLimit(
      randomWhiteListedAccountAddress,
      totalTxFee,
    );

    expect(shouldNOTByPassPreemtiveRateLimit).to.be.true;
    expect(shouldByPassPreemtiveRateLimit).to.be.false;
  });
});
