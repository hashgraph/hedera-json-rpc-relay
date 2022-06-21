/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import Axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { Logger } from 'pino';

export default class MirrorClient {

    private readonly logger: Logger;
    private readonly client: AxiosInstance;

    constructor(mirrorNodeUrl: string, logger: Logger) {
        this.logger = logger;

        const mirrorNodeClient = Axios.create({
            baseURL: `${mirrorNodeUrl}/api/v1`,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            timeout: 5 * 1000
        });

        // allow retries given mirror node waits for consensus, record stream serialization, export and import before parsing and exposing
        axiosRetry(mirrorNodeClient, {
            retries: 5,
            retryDelay: (retryCount) => {
                this.logger.info(`Retry delay ${retryCount * 1000} s`);
                return retryCount * 1000;
            },
            retryCondition: (error) => {
                this.logger.error(error, `Request failed`);

                // if retry condition is not specified, by default idempotent requests are retried
                return error?.response?.status === 400 || error?.response?.status === 404;
            },
            shouldResetTimeout: true,
        });

        this.client = mirrorNodeClient;
    }

    async get(path: string) {
        this.logger.debug(`[GET] MirrorNode ${path} endpoint`);
        return (await this.client.get(path)).data;
    };

}
