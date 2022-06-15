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

import {AccountId, Client, PrivateKey} from "@hashgraph/sdk";

const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];
export default class ServicesClient {
    public readonly client: Client;

    constructor(network: string, key: string, accountId: string) {
        if (!network) network = '{}';

        const opPrivateKey = PrivateKey.fromString(key);

        if (network.toLowerCase() in supportedEnvs) {
            this.client = Client.forName(network);
        } else {
            this.client = Client.forNetwork(JSON.parse(network));
        }

        this.client.setOperator(AccountId.fromString(accountId), opPrivateKey);
    }
}

