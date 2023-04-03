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

import { CustomFees } from "./customFees";
import { Key } from "./key"

export interface TokenInfo {
    admin_key: Key;
    auto_renew_account: string;
    auto_renew_period: number | null;
    created_timestamp: string;
    deleted: boolean;
    decimals: number;
    expiry_timestamp: string | null;
    freeze_default: boolean;
    freeze_key: Key;
    initial_supply: number;
    kyc_key: Key;
    max_supply: number;
    memo: string;
    modified_timestamp: string;
    name: string;
    pause_key: Key;
    pause_status: string;
    supply_key: Key;
    supply_type: string;
    symbol: string;
    token_id: string;
    total_supply: number;
    treasury_account_id: string;
    type: string;
    wipe_key: Key;
    custom_fees: CustomFees;
}
