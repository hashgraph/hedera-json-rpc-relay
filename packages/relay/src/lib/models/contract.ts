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

import { Key } from "./key"
import { Timestamp } from "./timestamp";

export interface Contract {
    admin_key: Key | null;
    auto_renew_account: string | null;
    auto_renew_period: number;
    contract_id: string;
    created_timestamp: string;
    deleted: boolean;
    evm_address: string;
    expiration_timestamp: string;
    file_id: string;
    max_automatic_token_associations: number;
    memo: string;
    obtainer_id: string | null;
    permanent_removal: boolean | null;
    proxy_account_id: string | null;
    timestamp: Timestamp;
    bytecode: string;
    runtime_bytecode: string;
}
