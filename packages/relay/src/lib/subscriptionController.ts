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

import { Poller } from './poller';
import { Logger } from 'pino';

export interface Subscriber {
    connection: any,
    subscriptionId: string
}

const LOGGER_PREFIX = 'Subscriptions:';

export class SubscriptionController {
    private poller: Poller;
    private logger: Logger;
    private subscriptions: {[key: string]: Subscriber[]};

    constructor(poller: Poller, logger: Logger) {
        this.poller = poller;
        this.logger = logger;
        this.subscriptions = {};
    }

    // Generates a random 16 byte hex string
    generateId() {
        let id = '0x';
        for (let i = 0; i < 3; i++) {
            id += Math.floor(Math.random() * 10000000000).toString(16).padStart(8, '0').slice(-8);
        }
        id += Date.now().toString(16).slice(-8);
        return id;
    }

    subscribe(connection, uri: string) {
        if (!this.subscriptions[uri]) {
            this.subscriptions[uri] = [];
        }

        const subId = this.generateId();

        this.logger.info(`${LOGGER_PREFIX} New subscription ${subId}, listening for ${uri}`);

        this.subscriptions[uri].push({
            subscriptionId: subId,
            connection
        });

        this.poller.add(uri, this.notifySubscribers.bind(this, uri));
        return subId;
    }

    unsubscribe(connection, subId?: string) {
        const {id} = connection;

        if (subId) {
            this.logger.info(`${LOGGER_PREFIX} Unsubscribing connection ${id} from subscription ${subId}`);
        }
        else {
            this.logger.info(`${LOGGER_PREFIX} Unsubscribing all instances of connection ${id}`);
        }

        for (const [uri, subs] of Object.entries(this.subscriptions)) {
            this.subscriptions[uri] = subs.filter(sub => {
                const match = sub.connection.id === id && (!subId || subId === sub.subscriptionId);
                if (match) {
                    this.logger.info(`${LOGGER_PREFIX} Unsubscribing ${sub.subscriptionId}, from ${uri}`);
                }

                return !match;
            });

            if (!this.subscriptions[uri].length) {
                this.logger.info(`${LOGGER_PREFIX} No subscribers for ${uri}`);
                delete this.subscriptions[uri];
                this.poller.remove(uri);
            }
        }

        return true;
    }

    notifySubscribers(uri, data) {
        if (this.subscriptions[uri] && this.subscriptions[uri].length) {
            this.subscriptions[uri].forEach(sub => {
                this.logger.info(`${LOGGER_PREFIX} Sending new data from ${uri} to subscriptionId ${sub.subscriptionId}, connectionId ${sub.connection.id}`);
                sub.connection.send(JSON.stringify({
                    method: 'eth_subscription',
                    params: {
                        result: data,
                        subscription: sub.subscriptionId
                    }
                }));
            })
        }
    }
}
