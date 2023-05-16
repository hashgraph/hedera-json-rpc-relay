/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import path from 'path';
import { expect } from 'chai';
import dotenv from 'dotenv';
import pino from 'pino';
import { Registry } from "prom-client";
import HAPIService from '../../src/lib/services/hapiService/hapiService';
import { SDKClient } from '../../src/lib/clients';
import { Client } from '@hashgraph/sdk';
import HbarLimit from '../../src/lib/hbarlimiter';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const registry = new Registry();
const logger = pino();

describe('HAPI Service', async function () {
    this.timeout(20000);
    let hapiService: HAPIService | null;
    let hbarLimiter: HbarLimit;
    const errorStatus = 50;
    
    this.beforeAll(() => {
        const duration: number = 60000;
        const total: number = 100000000;
        hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);
    });

    this.beforeEach(() => {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "0";
        process.env.HAPI_CLIENT_DURATION_RESET = "0";
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
    })

    this.afterEach(() => {
        hapiService = null;
    })

    it('should be able to initialize SDK instance', async function () {
        hapiService = new HAPIService(logger, registry, hbarLimiter);
        const client = hapiService.getMainClientInstance();
        const sdkClient = hapiService.getSDKClient();

        expect(client).to.be.instanceof(Client);
        expect(sdkClient).to.be.instanceof(SDKClient);
    });

    it('should be able to reinitialise SDK instance upon reaching transaction limit', async function () {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "2";
        hapiService = new HAPIService(logger, registry, hbarLimiter);
        expect(hapiService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!));
        
        const oldClientInstance = hapiService.getMainClientInstance();
        let oldSDKInstance = hapiService.getSDKClient(); // decrease transaction limit by taking the instance
        oldSDKInstance = hapiService.getSDKClient(); // decrease transaction limit by taking the instance
        expect(hapiService.getTransactionCount()).to.eq(0);
        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();

        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(oldClientInstance).to.not.be.equal(newClientInstance);
        expect(hapiService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!) - 1); // one less because we took the instance once and decreased the counter
    });

    it('should be able to reinitialise SDK instance upon reaching time limit', async function () {
        process.env.HAPI_CLIENT_DURATION_RESET = "100";
        hapiService = new HAPIService(logger, registry, hbarLimiter);
        expect(hapiService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));

        const oldClientInstance = hapiService.getMainClientInstance();
        await new Promise(r => setTimeout(r, 200)); // await to reach time limit
        const oldSDKInstance = hapiService.getSDKClient();
        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();

        expect(hapiService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));
        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(oldClientInstance).to.not.be.equal(newClientInstance);
    });

    it('should be able to reinitialise SDK instance upon error status code encounter', async function () {
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
        hapiService = new HAPIService(logger, registry, hbarLimiter);
        expect(hapiService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);

        const oldClientInstance = hapiService.getMainClientInstance();
        const oldSDKInstance = hapiService.getSDKClient();
        hapiService.decrementErrorCounter(errorStatus);
        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();

        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(oldClientInstance).to.not.be.equal(newClientInstance);
        expect(hapiService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
    });

    it('should be able to reset all counter upon reinitialization of the SDK Client', async function () {
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "50";
        process.env.HAPI_CLIENT_DURATION_RESET = "36000";
        hapiService = new HAPIService(logger, registry, hbarLimiter);

        expect(hapiService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
        const oldClientInstance = hapiService.getMainClientInstance();
        const oldSDKInstance = hapiService.getSDKClient();
        hapiService.decrementErrorCounter(errorStatus);
        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();

        expect(hapiService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));
        expect(hapiService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
        expect(hapiService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!) - 1); // one less because we took the instance once and decreased the counter
        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(oldClientInstance).to.not.be.equal(newClientInstance);
    });

    it('should keep the same instance of hbar limiter and not reset the budget', async function () {
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "50";
        process.env.HAPI_CLIENT_DURATION_RESET = "36000";
        const costAmount = 10000;
        hapiService = new HAPIService(logger, registry, hbarLimiter);

        const hbarLimiterBudgetBefore = hbarLimiter.getRemainingBudget();
        const oldClientInstance = hapiService.getMainClientInstance();
        const oldSDKInstance = hapiService.getSDKClient();

        hbarLimiter.addExpense(costAmount, Date.now());
        hapiService.decrementErrorCounter(errorStatus);

        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();
        const hbarLimiterBudgetAfter = hbarLimiter.getRemainingBudget();

        expect(hbarLimiterBudgetBefore).to.be.greaterThan(hbarLimiterBudgetAfter);
        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(oldClientInstance).to.not.be.equal(newClientInstance);
    });

    it('should not be able to reinitialise and decrement counters, if it is disabled', async function () {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "0";
        process.env.HAPI_CLIENT_DURATION_RESET = "0";
        process.env.HAPI_CLIENT_ERROR_RESET = "[]";
        
        hapiService = new HAPIService(logger, registry, hbarLimiter);
        expect(hapiService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!));

        const oldClientInstance = hapiService.getMainClientInstance();
        const oldSDKInstance = hapiService.getSDKClient();
        const newSDKInstance = hapiService.getSDKClient();
        const newClientInstance = hapiService.getMainClientInstance();

        expect(oldSDKInstance).to.be.equal(newSDKInstance);
        expect(oldClientInstance).to.be.equal(newClientInstance);
        expect(hapiService.getIsReinitEnabled()).to.be.equal(false);
    });
});
