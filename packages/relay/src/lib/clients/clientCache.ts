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

import { Logger } from "pino";
import { Gauge, Registry } from "prom-client";
import constants from "../constants";

const LRU = require('lru-cache');

export class ClientCache {
    /**
     * Configurable options used when initializing the cache.
     *
     * @private
     */
    private readonly options = {
        // The maximum number (or size) of items that remain in the cache (assuming no TTL pruning or explicit deletions).
        max: Number.parseInt(process.env.CACHE_MAX ?? constants.CACHE_MAX.toString()),
        // Max time to live in ms, for items before they are considered stale.
        ttl: Number.parseInt(process.env.CACHE_TTL ?? constants.CACHE_TTL.ONE_HOUR.toString()),
    }

    /**
     * The LRU cache used for caching items from requests.
     *
     * @private
     */
    private readonly cache;

        /**
     * The logger used for logging all output from this class.
     * @private
     */
    private readonly logger: Logger;

    /**
     * The metrics register used for metrics tracking.
     * @private
     */
    private readonly register: Registry;
    private cacheKeyGauge: Gauge<string>;

    private static getCacheLabel = 'get';
    private static setCacheLabel = 'set';

    public constructor(logger: Logger, register: Registry) {
        this.cache = new LRU(this.options);
        this.logger = logger;
        this.register = register;

        const cacheSizeCollect = () => {
            this.purgeStale();
            this.cacheKeyGauge.set(this.cache.size);
        };

        const metricCounterName = 'rpc_relay_cache';
        register.removeSingleMetric(metricCounterName);
        this.cacheKeyGauge = new Gauge({
            name: metricCounterName,
            help: 'Relay cache gauge',
            labelNames: ['key', 'type', 'method'],
            registers: [register],
            async collect() {
                cacheSizeCollect();
            },
        });
    }

    public get(key: string, callingMethod: string, requestIdPrefix?: string): any {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cacheKeyGauge.labels(key, ClientCache.getCacheLabel, callingMethod || '').inc(1);
            this.logger.trace(`${requestIdPrefix} returning cached value ${key}:${JSON.stringify(value)} on ${callingMethod} call`);
            return value;
        }

        return null;
    }

    public set(key: string, value: any, callingMethod: string, ttl?: number, requestIdPrefix?: string): void {
        const resolvedTtl = ttl ?? this.options.ttl;    
        this.logger.trace(`${requestIdPrefix} caching ${key}:${JSON.stringify(value)} for ${resolvedTtl} ms`);
        this.cache.set(key, value, { ttl: resolvedTtl });
        this.cacheKeyGauge.labels(key, ClientCache.setCacheLabel, callingMethod || '').inc(1);
    }

    public purgeStale(): void {
        this.cache.purgeStale();
    }

    public clear(): void {
        this.cache.clear();
    }
}
