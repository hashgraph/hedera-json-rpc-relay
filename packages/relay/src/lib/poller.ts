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

import { MirrorNodeClient } from './clients';
import { Logger } from 'pino';

export interface Poll {
    uri: string,
    callback: Function,
    lastPolled?: number
}

const LOGGER_PREFIX = 'Poller:';

export class Poller {
    private mirrorNodeClient: MirrorNodeClient;
    private logger: Logger;
    private polls: Poll[];
    private interval?: NodeJS.Timer;

    constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger) {
        this.mirrorNodeClient = mirrorNodeClient;
        this.logger = logger;
        this.polls = [];
    }

    poll() {
        this.polls.forEach(async poll => {
            try {
                this.logger.info(`${LOGGER_PREFIX} Fetching data for ${poll.uri}`);
                // const data = await this.mirrorNodeClient.get(poll.uri, 'contracts/results/logs');

                const data = [{
                    "address": "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
                    "topics": [
                        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
                        "0x000000000000000000000000700551055c4efd25a7ce9d9e6ce0b3ec126d3909",
                        "0x0000000000000000000000007728ebf957c39e0ef55fb65bac49ef40c82422a3"
                    ],
                    "data": "0x00000000000000000000000000000000000000000000000000000000000f4240",
                    "blockNumber": "0x807fdc",
                    "transactionHash": "0xc79166c9d56f04e26562a0c479e9c0e46a0a7973993bcd22b94e6382b4c5b07f",
                    "transactionIndex": "0x17",
                    "blockHash": "0xac9655fba9d7288b9a3d42f772430c37b312418a4890cd6f6a88c8dc4d335feb",
                    "logIndex": "0x2b",
                    "removed": false
                }];

                if (Array.isArray(data)) {
                    data.forEach(d => poll.callback(d));
                }
                else {
                    poll.callback(data);
                }

                poll.lastPolled = Date.now();
            }
            catch(error) {
                console.error(error);
            }
        });
    }

    start() {
        this.logger.info(`${LOGGER_PREFIX} Starting polling`);
        this.interval = setInterval(this.poll.bind(this), 3000);
    }

    stop() {
        this.logger.info(`${LOGGER_PREFIX} Stopping polling`);
        clearInterval(this.interval);
        delete this.interval;
    }

    add(uri: string, callback: Function) {
        if (!this.hasPoll(uri)) {
            this.logger.info(`${LOGGER_PREFIX} Polling for ${uri}`);
            this.polls.push({
                uri,
                callback,
                lastPolled: 0
            })
        }

        if (!this.isPolling()) {
            this.start();
        }
    }

    remove(uri: string) {
        this.logger.info(`${LOGGER_PREFIX} No longer polling for ${uri}`);
        this.polls = this.polls.filter(p => p.uri !== uri);

        if (!this.polls.length) {
            this.logger.info(`${LOGGER_PREFIX} No active polls.`);
            this.stop();
        }
    }

    hasPoll(uri): boolean {
        return !!this.polls.filter(p => p.uri !== uri).length;
    }

    isPolling() {
        return !!this.interval;
    }
}
