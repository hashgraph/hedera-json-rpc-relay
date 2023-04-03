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

import { AccessListEntry } from "./accessListEntry";
import { StakingRewardTransfers } from "./stakingRewardTransfer";
import { TokenTransfer } from "./tokenTransfer";
import { Transfer } from "./transfer";

export class Transaction {
    public readonly accessList!: AccessListEntry[] | null;
    public readonly blockHash!: string | null;
    public readonly blockNumber!: string | null;
    public readonly chainId!: string;
    public readonly from!: string;
    public readonly gas!: string;
    public readonly gasPrice!: string;
    public readonly hash!: string;
    public readonly input!: string;
    public readonly maxPriorityFeePerGas!: string;
    public readonly maxFeePerGas!: string;
    public readonly nonce!: string;
    public readonly r!: string;
    public readonly s!: string;
    public readonly to!: string | null;
    public readonly transactionIndex!: string | null;
    public readonly type!: string;
    public readonly v!: string;
    public readonly value!: string;

    constructor(args: any) {
        this.accessList = args.accessList;
        this.blockHash = args.blockHash;
        this.blockNumber = args.blockNumber;
        this.chainId = args.chainId;
        this.from = args.from;
        this.gas = args.gas;
        this.gasPrice = args.gasPrice;
        this.hash = args.hash;
        this.input = args.input;
        this.maxPriorityFeePerGas = args.maxPriorityFeePerGas;
        this.maxFeePerGas = args.maxFeePerGas;
        this.nonce = args.nonce;
        this.r = args.r;
        this.s = args.s;
        this.to = args.to;
        this.transactionIndex = args.transactionIndex;
        this.type = args.type;
        this.v = args.v;
        this.value = args.value;
    }
}

export interface ITransaction {
    bytes: string | null;
    charged_tx_fee: number;
    consensus_timestamp: string;
    entity_id: string;
    max_fee: number;
    memo_base64: string | null;
    name: string;
    node: string;
    nonce: number;
    parent_consensus_timestamp: string;
    result: string;
    scheduled: boolean;
    staking_reward_transfers: StakingRewardTransfers[];
    transaction_hash: string;
    transaction_id: string;
    token_transfers: TokenTransfer[];
    transfers: Transfer[];
    valid_duration_seconds: number;
    valid_start_timestamp: string;
}
