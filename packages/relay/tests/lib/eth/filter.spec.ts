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
import dotenv from 'dotenv';
import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { MirrorNodeClient } from '../../../src/lib/clients/mirrorNodeClient';
import pino from 'pino';
import constants from '../../../src/lib/constants';
import { ClientCache } from '../../../src/lib/clients';
import { FilterService } from '../../../src/lib/services/ethService';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

const logger = pino();
const registry = new Registry();

let restMock: MockAdapter, web3Mock: MockAdapter;
let mirrorNodeInstance: MirrorNodeClient;
let filterService: FilterService;
let clientCache: ClientCache;
let mirrorNodeCache: ClientCache;


describe('Filter API Test Suite', async function () {
    this.timeout(10000);

    this.beforeAll(() => {
        clientCache = new ClientCache(logger.child({ name: `cache` }), registry);
        // @ts-ignore
        mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, clientCache);
    
        // @ts-ignore
        mirrorNodeCache = mirrorNodeInstance.cache;
    
        // @ts-ignore
        restMock = new MockAdapter(mirrorNodeInstance.getMirrorNodeRestInstance(), { onNoMatch: "throwException" });
    
        // @ts-ignore
        web3Mock = new MockAdapter(mirrorNodeInstance.getMirrorNodeWeb3Instance(), { onNoMatch: "throwException" });
    
        // @ts-ignore
        filterService = new FilterService(mirrorNodeInstance, logger, clientCache);
      });

    this.beforeEach(() => {
        // reset cache and restMock
        mirrorNodeCache.clear();
        clientCache.clear();
        restMock.reset();
    });

    this.afterEach(() => {
        restMock.resetHandlers();
    });

    const filterObject = {

        toBlock: "latest"
    }
    const existingFilterId = "0x1112233";
    const nonExistingFilterId = "0x1112231";

    it('should return true if filter is deleted', async function () {
        const cacheKey = `${constants.CACHE_KEY.FILTERID}_${existingFilterId}`;
        clientCache.set(cacheKey, filterObject, filterService.ethUninstallFilter, 300000, undefined);

        const result = await filterService.uninstallFilter(existingFilterId);

        const isDeleted = clientCache.get(cacheKey, filterService.ethUninstallFilter, undefined) ? false : true;
        expect(result).to.eq(true);
        expect(isDeleted).to.eq(true);
    });

    it('should return false if filter does not exist, therefore is not deleted', async function () {
        const result = await filterService.uninstallFilter(nonExistingFilterId);

        expect(result).to.eq(false);
    });
});
