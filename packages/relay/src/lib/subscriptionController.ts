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

export class SubscriptionController {
    private poller: Poller;
    private logger: Logger;
    private subscriptions: {};

    constructor(poller: Poller, logger: Logger) {
        this.poller = poller;
        this.logger = logger;
        this.subscriptions = {};
    }

    generateSubId() {
        return '0x9ce59a13059e417087c02d3236a0b1cc';
    }

    subscribe(connection, uri) {
        if (!this.subscriptions[uri]) {
            this.subscriptions[uri] = [];
        }

        const subscriptionId = this.generateSubId();

        this.subscriptions[uri].push({
            subscriptionId: subscriptionId,
            connection
        });

        this.poller.add(uri, this.notifySubscribers.bind(uri));
        return subscriptionId;
    }

    notifySubscribers(uri, data) {
        if (this.subscriptions[uri] && this.subscriptions[uri].length) {
            this.subscriptions[uri].forEach(sub => {
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
