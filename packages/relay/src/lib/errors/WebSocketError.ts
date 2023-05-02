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

export class WebSocketError {
    public code: number;
    public message: string;

    constructor(args: { code: number, message: string }) {
        this.code = args.code;
        this.message = args.message;
    }
}

export default {
    'CONNECTION_IP_LIMIT_EXCEEDED': new WebSocketError({
        code: 4001,
        message: `Exceeded maximum connections from a single IP address`
    }),
    'TTL_EXPIRED': new WebSocketError({
        code: 4002,
        message: `Connection timeout expired`
    }),
    'CONNECTION_LIMIT_EXCEEDED': new WebSocketError({
        code: 4003,
        message: `Connection limit exceeded`
    }),
};
