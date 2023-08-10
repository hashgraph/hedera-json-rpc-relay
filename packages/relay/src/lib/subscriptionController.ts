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

import { Logger } from 'pino';
import LRU from "lru-cache";
import crypto from "crypto";
import constants from "./constants";
import { Poller } from './poller';
import {generateRandomHex} from '../formatters';
import {Registry, Histogram, Counter} from "prom-client";

export interface Subscriber {
    connection: any,
    subscriptionId: string,
    endTimer: () => void
}

const CACHE_TTL = Number(process.env.WS_CACHE_TTL) || 20000;

export class SubscriptionController {
    private poller: Poller;
    private logger: Logger;
    private subscriptions: {[key: string]: Subscriber[]};
    private cache;
    private activeSubscriptionHistogram: Histogram;
    private resultsSentToSubscribersCounter: Counter;

    constructor(poller: Poller, logger: Logger, register: Registry) {
        this.poller = poller;
        this.logger = logger;
        this.subscriptions = {};

        this.cache = new LRU({ max: constants.CACHE_MAX, ttl: CACHE_TTL });

        const activeSubscriptionHistogramName = 'rpc_websocket_subscription_times';
        register.removeSingleMetric(activeSubscriptionHistogramName);
        this.activeSubscriptionHistogram = new Histogram({
            name: activeSubscriptionHistogramName,
            help: 'Relay websocket active subscription timer',
            registers: [register],
            buckets: [
                0.05,    // fraction of a second
                1,       // one second
                10,      // 10 seconds
                60,      // 1 minute
                120,     // 2 minute
                300,     // 5 minutes
                1200,    // 20 minutes
                3600,    // 1 hour
                86400    // 24 hours
            ]
        })

        const resultsSentToSubscribersCounterName = 'rpc_websocket_poll_received_results';
        register.removeSingleMetric(resultsSentToSubscribersCounterName);
        this.resultsSentToSubscribersCounter = new Counter({
            name: 'rpc_websocket_poll_received_results',
            help: 'Relay websocket counter for the unique results sent to subscribers',
            registers: [register],
            labelNames: ['subId', 'tag']
        })
    }

    createHash(data) {
        return crypto.createHash('sha256').update(data.toString()).digest('hex');
    }

    // Generates a random 16 byte hex string
    generateId() {
        return generateRandomHex();
    }

    subscribe(connection, event: string, filters?: {}) {

        let tag: any = {event};
        if (filters && Object.keys(filters).length) {
            tag.filters = filters;
        }

        tag = JSON.stringify(tag);

        if (!this.subscriptions[tag]) {
            this.subscriptions[tag] = [];
        }

        // Check if the connection is already subscribed to this event
        const existingSub = this.subscriptions[tag].find(sub => sub.connection.id === connection.id);
        if (existingSub) {
            this.logger.debug(`Connection ${connection.id}: Attempting to subscribe to ${tag}; already subscribed`);
            return existingSub.subscriptionId;
        }

        const subId = this.generateId();

        this.logger.info(`Connection ${connection.id}: created subscription ${subId}, listening for ${tag}`);

        this.subscriptions[tag].push({
            subscriptionId: subId,
            connection,
            endTimer: this.activeSubscriptionHistogram.startTimer() // observes the time in seconds
        });

        this.poller.add(tag, this.notifySubscribers.bind(this, tag));

        return subId;
    }

    unsubscribe(connection, subId?: string) {
        const {id} = connection;

        if (subId) {
            this.logger.info(`Connection ${id}: Unsubscribing from ${subId}`);
        }
        else {
            this.logger.info(`Connection ${id}: Unsubscribing from all subscriptions`);
        }

        let subCount = 0;
        for (const [tag, subs] of Object.entries(this.subscriptions)) {
            this.subscriptions[tag] = subs.filter(sub => {
                const match = sub.connection.id === id && (!subId || subId === sub.subscriptionId);
                if (match) {
                    this.logger.debug(`Connection ${sub.connection.id}. Unsubscribing subId: ${sub.subscriptionId}; tag: ${tag}`);
                    sub.endTimer();
                    subCount++;
                }

                return !match;
            });

            if (!this.subscriptions[tag].length) {
                this.logger.debug(`No subscribers for ${tag}. Removing from list.`);
                delete this.subscriptions[tag];
                this.poller.remove(tag);
            }
        }

        return subCount;
    }

    notifySubscribers(tag, data) {
        if (this.subscriptions[tag] && this.subscriptions[tag].length) {
            this.subscriptions[tag].forEach(sub => {
                const subscriptionData = {
                    result: data,
                    subscription: sub.subscriptionId
                };
                const hash = this.createHash(JSON.stringify(subscriptionData));

                // If the hash exists in the cache then the data has recently been sent to the subscriber
                if (!this.cache.get(hash)) {
                    this.cache.set(hash, true);
                    this.logger.debug(`Sending data from tag: ${tag} to subscriptionId: ${sub.subscriptionId}, connectionId: ${sub.connection.id}, data: ${subscriptionData}`);
                    this.resultsSentToSubscribersCounter.labels('sub.subscriptionId', tag).inc();
                    sub.connection.send(JSON.stringify({
                        method: 'eth_subscription',
                        params: subscriptionData
                    }));
                }
            });
        }
    }
}
