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
import ClientService from '../../src/lib/services/hapiService';
import { SDKClient } from '../../src/lib/clients';
import { Client } from '@hashgraph/sdk';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const registry = new Registry();
const logger = pino();

describe.only('Client Service', async function () {
    this.timeout(20000);
    let clientService: ClientService | null;
    const errorStatus = 50;
    
    this.beforeEach(() => {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "0";
        process.env.HAPI_CLIENT_DURATION_RESET = "0";
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
    })

    this.afterEach(() => {
        clientService = null;
    })

    it('should be able to initialize SDK instance', async function () {
        clientService = new ClientService(logger, registry);
        const client = clientService.getSingletonSDKClient();
        const sdkClient = clientService.getSDKClient();

        expect(client).to.be.instanceof(Client);
        expect(sdkClient).to.be.instanceof(SDKClient);
    });

    it('should be able to reinitialise SDK instance upon reaching transaction limit', async function () {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "2";
        clientService = new ClientService(logger, registry);
        expect(clientService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!));

        let oldSDKInstance = clientService.getSDKClient(); // decrease transaction limit by taking the instance
        oldSDKInstance = clientService.getSDKClient(); // decrease transaction limit by taking the instance
        expect(clientService.getTransactionCount()).to.eq(0);
        const newSDKInstance = clientService.getSDKClient();

        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(clientService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!) - 1); // one less because we took the instance once and decreased the counter
    });

    it('should be able to reinitialise SDK instance upon reaching time limit', async function () {
        process.env.HAPI_CLIENT_DURATION_RESET = "100";
        clientService = new ClientService(logger, registry);
        expect(clientService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));

        await new Promise(r => setTimeout(r, 200)); // await to reach time limit
        const oldSDKInstance = clientService.getSDKClient();
        const newSDKInstance = clientService.getSDKClient();

        expect(clientService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));
        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
    });

    it('should be able to reinitialise SDK instance upon error status code encounter', async function () {
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
        clientService = new ClientService(logger, registry);
        expect(clientService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);

        const oldSDKInstance = clientService.getSDKClient();
        clientService.decrementErrorCounter(errorStatus);
        const newSDKInstance = clientService.getSDKClient();

        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(clientService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
    });

    it('should be able to reset all counter upon reinitialization of the SDK Client', async function () {
        process.env.HAPI_CLIENT_ERROR_RESET = "[50]";
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "50";
        process.env.HAPI_CLIENT_DURATION_RESET = "36000";
        clientService = new ClientService(logger, registry);

        expect(clientService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
        const oldSDKInstance = clientService.getSDKClient();
        clientService.decrementErrorCounter(errorStatus);
        const newSDKInstance = clientService.getSDKClient();

        expect(oldSDKInstance).to.not.be.equal(newSDKInstance);
        expect(clientService.getErrorCodes()[0]).to.eq(JSON.parse(process.env.HAPI_CLIENT_ERROR_RESET!)[0]);
        expect(clientService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!) - 1); // one less because we took the instance once and decreased the counter
        expect(clientService.getTimeUntilReset()).to.eq(parseInt(process.env.HAPI_CLIENT_DURATION_RESET!));
    });

    it('should not be able to reinitialise and decrement counters, if it is disabled', async function () {
        process.env.HAPI_CLIENT_TRANSACTION_RESET = "0";
        process.env.HAPI_CLIENT_DURATION_RESET = "0";
        process.env.HAPI_CLIENT_ERROR_RESET = "0";
        
        clientService = new ClientService(logger, registry);
        expect(clientService.getTransactionCount()).to.eq(parseInt(process.env.HAPI_CLIENT_TRANSACTION_RESET!));

        const oldSDKInstance = clientService.getSDKClient();
        const newSDKInstance = clientService.getSDKClient();

        expect(oldSDKInstance).to.be.equal(newSDKInstance);
        expect(clientService.getIsReinitEnabled()).to.be.equal(false);
    });
});
