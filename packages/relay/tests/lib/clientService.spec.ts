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
import ClientService from '../../src/lib/services/clientService';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const registry = new Registry();
const logger = pino();

describe('HBAR Rate Limiter', async function () {
    this.timeout(20000);
    let clientService: ClientService;

    this.beforeEach(() => {
        clientService = new ClientService(logger, registry);
    });

    it('should be able to initialize SDK instance', async function () {

    });

    it('should be able to reinitialise SDK instance upon reaching transaction limit', async function () {

    });

    it('should be able to reinitialise SDK instance upon reaching time limit', async function () {

    });

    it('should be able to reinitialise SDK instance upon reaching error limit', async function () {

    });

    it('should be able to reset all counter upon reinitialization of the SDK Client', async function () {

    });

    it('should not be able to reinitialise and decrement counters, if it is disabled', async function () {

    });
});
