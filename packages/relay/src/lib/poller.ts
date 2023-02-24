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

import { Eth } from '../index';
import { Logger } from 'pino';

export interface Poll {
    tag: string,
    callback: Function,
    lastPolled?: string
}

const LOGGER_PREFIX = 'Poller:';

export class Poller {
    private eth: Eth;
    private logger: Logger;
    private polls: Poll[];
    private interval?: NodeJS.Timer;
    private latestBlock?: string;

    constructor(eth: Eth, logger: Logger) {
        this.eth = eth;
        this.logger = logger;
        this.polls = [];
    }

    public poll() {
        this.polls.forEach(async (poll, pollIndex) => {
            try {
                this.logger.info(`${LOGGER_PREFIX} Fetching data for ${poll.tag}`);

                const {event, filters} = JSON.parse(poll.tag);
                let data;

                if (event === 'logs') {
                    data = await this.eth.getLogs(
                        null,
                        poll.lastPolled || this.latestBlock || 'latest',
                        'latest',
                        filters.address || null,
                        filters.topics || null
                    );

                    poll.lastPolled = this.latestBlock;
                }
                else if (event === 'newHeads') {
                    // not supported
                }
                else if (event === 'newPendingTransacitons') {
                    // not supported
                }
                else {
                    // invalid event
                }

                if (Array.isArray(data)) {
                    data.forEach(d => poll.callback(d));
                }
                else {
                    poll.callback(data);
                }
            }
            catch(error) {
                console.error(error);
            }
        });
    }

    start() {
        this.logger.info(`${LOGGER_PREFIX} Starting polling`);
        this.interval = setInterval(async () => {
            this.latestBlock = await this.eth.blockNumber();
            this.poll();
        }, 500);
    }

    stop() {
        this.logger.info(`${LOGGER_PREFIX} Stopping polling`);
        clearInterval(this.interval);
        delete this.interval;
    }

    async add(tag: string, callback: Function) {
        if (!this.hasPoll(tag)) {
            this.logger.info(`${LOGGER_PREFIX} Polling for ${tag}`);
            this.polls.push({
                tag,
                callback
            })
        }

        if (!this.isPolling()) {
            this.start();
        }
    }

    remove(tag: string) {
        this.logger.info(`${LOGGER_PREFIX} No longer polling for ${tag}`);
        this.polls = this.polls.filter(p => p.tag !== tag);

        if (!this.polls.length) {
            this.logger.info(`${LOGGER_PREFIX} No active polls.`);
            this.stop();
        }
    }

    hasPoll(tag): boolean {
        return !!this.polls.filter(p => p.tag !== tag).length;
    }

    isPolling() {
        return !!this.interval;
    }
}
