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

export declare class CustomFees {
    created_timestamp: string;
    fixed_fees: FixedFees;
    fractional_fees: FractionalFees;
}

interface FixedFees {
    amount: number;
    collector_account_id: string;
    denominating_token_id: string;
}

interface FractionalFees {
    amount: Amount;
    collector_account_id: string;
    denominating_token_id: string;
    maximum: number;
    minimum: number;
    net_of_transfers: boolean;
}

interface Amount {
    numerator: number;
    denominator: number;
}
