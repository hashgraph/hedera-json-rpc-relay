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

export class Log {
    public readonly address: string;
    public readonly blockHash: string;
    public readonly blockNumber: string;
    public readonly data: string;
    public readonly logIndex: string;
    public readonly removed: boolean;
    public readonly topics: string[];
    public readonly transactionHash: string;
    public readonly transactionIndex: string;

    constructor(args: any) {
        this.address = args.address;
        this.blockHash = args.blockHash;
        this.blockNumber = args.blockNumber;
        this.data = args.data;
        this.logIndex = args.logIndex;
        this.removed = args.removed;
        this.topics = args.topics;
        this.transactionHash = args.transactionHash;
        this.transactionIndex = args.transactionIndex;
    }
}

export interface ILog {
    address: string;
    block_hash: string;
    block_number: number;
    bloom: string;
    contract_id: string;
    data: string;
    index: number;
    logIndex: number;
    removed: boolean;
    topics: string[];
    root_contract_id: string;
    transaction_hash: string;
    transaction_index: number;
}
