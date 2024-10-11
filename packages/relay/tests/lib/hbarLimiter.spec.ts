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
import { estimateFileTransactionsFee, random20BytesAddress, withOverriddenEnvsInMochaTest } from '../helpers';
import { RequestDetails } from '../../src/lib/types';

const registry = new Registry();
const logger = pino();

describe('HBAR Rate Limiter', async function () {
  this.timeout(20000);
  let rateLimiter: HbarLimit;
  let currentDateNow: number;
  let rateLimiterWithEmptyBudget: HbarLimit;

  const callDataSize = 6000;
  const invalidTotal: number = 0;
  const invalidDuration: number = 0;
  const validDuration: number = 60000;
  const validTotal: number = 1000000000;
  const mockedExchangeRateInCents: number = 12;
  const randomAccountAddress = random20BytesAddress();
  const randomWhiteListedAccountAddress = random20BytesAddress();
  const fileChunkSize = Number(process.env.FILE_APPEND_CHUNK_SIZE) || 5120;
  const requestDetails = new RequestDetails({ requestId: 'hbarRateLimiterTest', ipAddress: '0.0.0.0' });

  this.beforeEach(() => {
    currentDateNow = Date.now();
    rateLimiter = new HbarLimit(logger, currentDateNow, validTotal, validDuration, registry);
    rateLimiterWithEmptyBudget = new HbarLimit(logger, currentDateNow, invalidTotal, validDuration, registry);
  });

  withOverriddenEnvsInMochaTest({ HBAR_RATE_LIMIT_WHITELIST: `[${randomWhiteListedAccountAddress}]` }, () => {
    it('should be disabled, if we pass invalid total', async function () {
      const isEnabled = rateLimiterWithEmptyBudget.isEnabled();
      const limiterResetTime = rateLimiterWithEmptyBudget.getResetTime();
      const limiterRemainingBudget = rateLimiterWithEmptyBudget.getRemainingBudget();
      const shouldRateLimit = rateLimiterWithEmptyBudget.shouldLimit(
        currentDateNow,
        'QUERY',
        'eth_call',
        randomAccountAddress,
        requestDetails,
      );
      rateLimiterWithEmptyBudget.addExpense(validTotal, currentDateNow, requestDetails);

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
      const shouldRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'QUERY',
        'eth_call',
        randomAccountAddress,
        requestDetails,
      );
      rateLimiter.addExpense(validTotal, currentDateNow, requestDetails);

      expect(isEnabled).to.equal(false);
      expect(shouldRateLimit).to.equal(false);
      expect(limiterResetTime).to.equal(currentDateNow);
      expect(limiterRemainingBudget).to.equal(0);
    });

    it('should be disabled, if we pass both invalid duration and total', async function () {
      const invalidRateLimiter = new HbarLimit(logger, currentDateNow, invalidTotal, invalidDuration, registry);

      const isEnabled = invalidRateLimiter.isEnabled();
      const limiterResetTime = invalidRateLimiter.getResetTime();
      const limiterRemainingBudget = invalidRateLimiter.getRemainingBudget();
      const shouldRateLimit = invalidRateLimiter.shouldLimit(
        currentDateNow,
        'QUERY',
        'eth_call',
        randomAccountAddress,
        requestDetails,
      );
      invalidRateLimiter.addExpense(validTotal, currentDateNow, requestDetails);

      expect(isEnabled).to.equal(false);
      expect(shouldRateLimit).to.equal(false);
      expect(limiterResetTime).to.equal(currentDateNow);
      expect(limiterRemainingBudget).to.equal(0);
    });

    it('should be enabled, if we pass valid duration and total', async function () {
      const isEnabled = rateLimiter.isEnabled();
      const limiterResetTime = rateLimiter.getResetTime();
      const limiterRemainingBudget = rateLimiter.getRemainingBudget();
      const shouldRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'QUERY',
        'eth_call',
        randomAccountAddress,
        requestDetails,
      );

      expect(isEnabled).to.equal(true);
      expect(shouldRateLimit).to.equal(false);
      expect(limiterResetTime).to.equal(currentDateNow + validDuration);
      expect(limiterRemainingBudget).to.equal(validTotal);
    });

    it('should not rate limit', async function () {
      const cost = 10000000;

      rateLimiter.addExpense(cost, currentDateNow, requestDetails);

      const isEnabled = rateLimiter.isEnabled();
      const limiterResetTime = rateLimiter.getResetTime();
      const limiterRemainingBudget = rateLimiter.getRemainingBudget();
      const shouldRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
      );

      expect(isEnabled).to.equal(true);
      expect(shouldRateLimit).to.equal(false);
      expect(limiterResetTime).to.equal(currentDateNow + validDuration);
      expect(limiterRemainingBudget).to.equal(validTotal - cost);
    });

    it('should rate limit', async function () {
      const cost = 1000000000;

      rateLimiter.addExpense(cost, currentDateNow, requestDetails);

      const isEnabled = rateLimiter.isEnabled();
      const limiterResetTime = rateLimiter.getResetTime();
      const limiterRemainingBudget = rateLimiter.getRemainingBudget();
      const shouldRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
      );

      expect(isEnabled).to.equal(true);
      expect(shouldRateLimit).to.equal(true);
      expect(limiterResetTime).to.equal(currentDateNow + validDuration);
      expect(limiterRemainingBudget).to.equal(validTotal - cost);
    });

    it('should reset budget, while checking if we should rate limit', async function () {
      const cost = 1000000000;

      rateLimiter.addExpense(cost, currentDateNow, requestDetails);

      const isEnabled = rateLimiter.isEnabled();
      const futureDate = currentDateNow + validDuration * 2;
      const shouldRateLimit = rateLimiter.shouldLimit(
        futureDate,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
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

      rateLimiter.addExpense(cost, currentDateNow, requestDetails);
      const shouldRateLimitBefore = rateLimiter.shouldLimit(
        currentDateNow,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
      );

      const futureDate = currentDateNow + validDuration * 2;
      rateLimiter.addExpense(100, futureDate, requestDetails);
      const shouldRateLimitAfter = rateLimiter.shouldLimit(
        futureDate,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
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

    it('Should execute shouldPreemptivelyLimitFileTransactions() and return TRUE if expected transactionFee is greater than remaining balance', () => {
      const result = rateLimiterWithEmptyBudget.shouldPreemptivelyLimitFileTransactions(
        randomAccountAddress,
        callDataSize,
        fileChunkSize,
        mockedExchangeRateInCents,
        requestDetails,
      );
      expect(result).to.be.true;
    });

    it('Should execute shouldPreemptivelyLimitFileTransactions() and return FALSE if expected transactionFee is less than remaining balance', () => {
      const result = rateLimiter.shouldPreemptivelyLimitFileTransactions(
        randomAccountAddress,
        callDataSize,
        fileChunkSize,
        mockedExchangeRateInCents,
        requestDetails,
      );
      expect(result).to.be.false;
    });

    it('Should verify if an account is whitelisted', () => {
      const shoulNotdBeWhiteListed = rateLimiterWithEmptyBudget.isAccountWhiteListed(randomAccountAddress);
      const shouldBeWhiteListed = rateLimiterWithEmptyBudget.isAccountWhiteListed(randomWhiteListedAccountAddress);

      expect(shoulNotdBeWhiteListed).to.be.false;
      expect(shouldBeWhiteListed).to.be.true;
    });

    it('should bypass rate limit if original caller is a white listed account', async function () {
      // add expense to rate limit throttle
      rateLimiter.addExpense(validTotal, currentDateNow, requestDetails);

      // should return true as `randomAccountAddress` is not white listed
      const shouldNOTByPassRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomAccountAddress,
        requestDetails,
      );

      // should return false as `randomWhiteListedAccountAddress` is white listed
      const shouldByPassRateLimit = rateLimiter.shouldLimit(
        currentDateNow,
        'TRANSACTION',
        'eth_sendRawTransaction',
        randomWhiteListedAccountAddress,
        requestDetails,
      );

      expect(shouldByPassRateLimit).to.equal(false);
      expect(shouldNOTByPassRateLimit).to.equal(true);
    });

    it('Should execute shouldPreemptivelyLimitFileTransactions() and return FALSE if the original caller is a white listed account', () => {
      const result = rateLimiterWithEmptyBudget.shouldPreemptivelyLimitFileTransactions(
        randomWhiteListedAccountAddress,
        callDataSize,
        fileChunkSize,
        mockedExchangeRateInCents,
        requestDetails,
      );
      expect(result).to.be.false;
    });

    it('Should execute shouldPreemptivelyLimitFileTransactions() and return TRUE if the original caller is NOT a white listed account', () => {
      const result = rateLimiterWithEmptyBudget.shouldPreemptivelyLimitFileTransactions(
        randomAccountAddress,
        callDataSize,
        fileChunkSize,
        mockedExchangeRateInCents,
        requestDetails,
      );
      expect(result).to.be.true;
    });

    it('Should execute estimateFileTransactionFee() to estimate total fee of file transactions', async () => {
      const result = rateLimiter.estimateFileTransactionsFee(callDataSize, fileChunkSize, mockedExchangeRateInCents);
      const expectedResult = estimateFileTransactionsFee(callDataSize, fileChunkSize, mockedExchangeRateInCents);
      expect(result).to.eq(expectedResult);
    });
  });
});
