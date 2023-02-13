/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import pino from 'pino';
import HbarLimit from '../../src/lib/hbarlimiter';
import { Registry } from "prom-client";

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

    this.beforeEach(() => {
        currentDateNow = Date.now();
    });

    it('should be disabled, if we pass invalid total', async function () {
        rateLimiter = new HbarLimit(logger, currentDateNow, invalidTotal, validDuration, registry);

        const isEnabled = rateLimiter.isEnabled();
        const limiterResetTime = rateLimiter.getResetTime();
        const limiterRemainingBudget = rateLimiter.getRemainingBudget();
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call');
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
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call');
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
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call');
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
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'QUERY', 'eth_call');

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
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'TRANSACTION', 'eth_sendRawTransaction');

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
        const shouldRateLimit = rateLimiter.shouldLimit(currentDateNow, 'TRANSACTION', 'eth_sendRawTransaction');

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
        const shouldRateLimit = rateLimiter.shouldLimit(futureDate, 'TRANSACTION', 'eth_sendRawTransaction');
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
        const shouldRateLimitBefore = rateLimiter.shouldLimit(currentDateNow, 'TRANSACTION', 'eth_sendRawTransaction');
        
        const futureDate = currentDateNow + validDuration * 2;
        rateLimiter.addExpense(100, futureDate);
        const shouldRateLimitAfter = rateLimiter.shouldLimit(futureDate, 'TRANSACTION', 'eth_sendRawTransaction');
        
        const isEnabled = rateLimiter.isEnabled();
        const limiterResetTime = rateLimiter.getResetTime();
        const limiterRemainingBudget = rateLimiter.getRemainingBudget();
        
        expect(isEnabled).to.equal(true);
        expect(shouldRateLimitBefore).to.equal(true);
        expect(shouldRateLimitAfter).to.equal(false);
        expect(limiterResetTime).to.equal(futureDate + validDuration);
        expect(limiterRemainingBudget).to.equal(validTotal - 100);
    });
});