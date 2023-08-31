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

import { expect } from 'chai';
import { CacheService } from "../../../../packages/relay/src/lib/services/cacheService/cacheService";
import {Registry} from "prom-client";
const registry = new Registry();
const Redis = require("ioredis");

const { hostname, port } = new URL(process.env.REDIS_URL || "");
const redis = new Redis({
    port: port,
    host: hostname,
});

const DATA_LABEL_PREFIX = 'acceptance-test-';
const DATA = {
    foo: 'bar'
};
const CALLING_METHOD = 'AcceptanceTest'

const getConnectedClients = async () => {
    const info = await redis.info('clients');
    const infoRows = info.split('\n');
    const connectedClientsRow = infoRows.find(row => row.indexOf('connected_clients') !== -1);
    if (connectedClientsRow) {
        return parseInt((connectedClientsRow.split(':'))[1]);
    }

    return 0;
}

const clearAllTestCache = async () => {
    const keys = await redis.keys(`${DATA_LABEL_PREFIX}*`);
    for(const key of keys) {
        await redis.del(key);
    }
}

describe('@cache-service Acceptance Tests', function () {
    let cacheService: CacheService;

    before(async () => {
        const pong = await redis.ping();
        expect(pong).to.eq('PONG', 'redis server is running');

        const connectedClientsBefore = await getConnectedClients();
        cacheService = new CacheService(global.logger, registry);
        await new Promise(r => setTimeout(r, 1000));
        const connectedClientsAfter = await getConnectedClients();
        expect(connectedClientsAfter).to.eq(connectedClientsBefore + 1, 'successfully connected to redis server');

        await clearAllTestCache();
    });

    afterEach(async () => {
        await clearAllTestCache();
    })

    it('Correctly performs set, get and delete operations', async () => {
        const dataLabel = `${DATA_LABEL_PREFIX}1`;

        cacheService.set(dataLabel, DATA, CALLING_METHOD, undefined, undefined, true);
        await new Promise(r => setTimeout(r, 200));

        const cache = await redis.get(dataLabel);
        expect(JSON.parse(cache)).to.deep.eq(DATA, 'set method saves to shared cache');

        const cacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
        expect(cacheFromService).to.deep.eq(DATA, 'getAsync method reads correctly from shared cache');

        cacheService.delete(dataLabel, CALLING_METHOD, undefined, true);
        await new Promise(r => setTimeout(r, 200));

        const deletedCache = await redis.get(dataLabel);
        expect(deletedCache).to.eq(null, 'the delete method correctly deletes from shared cache');

        const deletedCacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
        expect(deletedCacheFromService).to.eq(null, 'getAsync method cannot read deleted cache');
    });

    it('Correctly sets TTL time', async () => {
        const ttl = 1000;
        const dataLabel = `${DATA_LABEL_PREFIX}2`;

        cacheService.set(dataLabel, DATA, CALLING_METHOD, ttl, undefined, true);
        await new Promise(r => setTimeout(r, 200));

        const cache = await redis.get(dataLabel);
        expect(JSON.parse(cache)).to.deep.eq(DATA, 'data is stored with TTL');

        await new Promise(r => setTimeout(r, ttl));

        const expiredCache = await redis.get(dataLabel);
        expect(JSON.parse(expiredCache)).to.eq(null, 'cache expires after TTL period');

        const deletedCacheFromService = await cacheService.getAsync(dataLabel, CALLING_METHOD);
        expect(deletedCacheFromService).to.eq(null, 'getAsync method cannot read expired cache');
    })

    // Fallback to lru-cache if redis is not available or respective feature flags are set.

    // More complex acceptance tests, like: call to relay instance 1 which sets cache value, then query for this cache from relay instance 2 and assertion whether it's the appropriate answer.
});
