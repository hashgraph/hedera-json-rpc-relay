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

import { Timestamp } from "./timestamp";
import { Transaction } from "./transaction";

export class Block{
    public readonly timestamp:string = '0x' + new Date().valueOf().toString(16);
    public number!: string;
    public hash!: string;

    public readonly difficulty:string = '0x1';
    public readonly extraData:string = '';
    public readonly gasLimit:string = '0xe4e1c0';
    public readonly baseFeePerGas:string = '0xa54f4c3c00';
    public readonly gasUsed:string = '0x0';
    public readonly logsBloom:string = '0x0';
    public readonly miner:string = '';
    public readonly mixHash:string =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
    public readonly nonce:string = '0x0000000000000000';
    public parentHash!: string;
    public readonly receiptsRoot:string = '0x0';
    public readonly sha3Uncles:string = '0x0';
    public readonly size:string = '0x0';
    public readonly stateRoot:string = '0x0';
    public readonly totalDifficulty:string = '0x1';
    public readonly transactions:string[] | Transaction[] = [];
    public readonly transactionsRoot:string = '0x0';
    public readonly uncles:string[] = [];

    constructor(args?:any) {
        if (args) {
            this.timestamp = args.timestamp;
            this.number = args.number;
            this.hash = args.hash;
            this.difficulty = args.difficulty;
            this.extraData = args.extraData;
            this.gasLimit = args.gasLimit;
            this.baseFeePerGas = args.baseFeePerGas;
            this.gasUsed = args.gasUsed;
            this.logsBloom = args.logsBloom;
            this.miner = args.miner;
            this.mixHash = args.mixHash;
            this.nonce = args.nonce;
            this.parentHash = args.parentHash;
            this.receiptsRoot = args.receiptsRoot;
            this.sha3Uncles = args.sha3Uncles;
            this.size = args.size;
            this.stateRoot = args.stateRoot;
            this.totalDifficulty = args.totalDifficulty;
            this.transactions = args.transactions;
            this.transactionsRoot = args.transactionsRoot;
            this.uncles = [];
        }
    }

    /**
     * Converts the "number" field into an actual number type
     */
    public getNum():number {
        return Number(this.number.substring(2));
    }
}

export interface IBlock {
    count: number;
    gas_used: number;
    hapi_version: string;
    hash: string;
    logs_bloom: string;
    name: string;
    number: number;
    previous_hash: string;
    size: number;
    timestamp: Timestamp;
}

export interface IBlocks {
    blocks: IBlock[];
}
