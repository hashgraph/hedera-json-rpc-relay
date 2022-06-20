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

// external resources
import { AliasAccount } from '../clients/servicesClient';

describe('ERC20 Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    // @ts-ignore
    const {servicesNode, mirrorNode, relay, logger} = global;

    // cached entities
    const accounts: AliasAccount[] = [];
    let contractId;

    before(async () => {
        accounts[0] = await servicesNode.createAliasAccount(20);
    });

});
