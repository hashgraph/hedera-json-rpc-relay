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

// Used for fake implementation of block history
import {Status, TransactionRecord} from "@hashgraph/sdk";

export class Block {
    public readonly timestamp:string = '0x' + new Date().valueOf().toString(16);
    public readonly number:string;
    public readonly hash:string;

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
    public readonly parentHash:string;
    public readonly receiptsRoot:string = '0x0';
    public readonly sha3Uncles:string = '0x0';
    public readonly size:string = '0x0';
    public readonly stateRoot:string = '0x0';
    public readonly totalDifficulty:string = '0x1';
    public readonly transactions:string[] = [];
    public readonly transactionsRoot:string = '0x0';
    public readonly uncles:any[] = [];

    constructor(parentBlock:(null | Block), transaction:(string|null), args?:any) {
        const num = parentBlock == null ? 0 : parentBlock.getNum() + 1;
        this.number = '0x' + Number(num).toString(16);
        this.parentHash = parentBlock == null ? '0x0' : parentBlock.hash;
        if (transaction) {
            this.transactions.push(transaction);
        }

        const numberAsString = num.toString();
        const baseHash = "0xc6ef2fc5426d6ad6fd9e2a26abeab0aa2411b7ab17f30a99d3cb96aed1d1055b";
        this.hash = baseHash.slice(0, baseHash.length - numberAsString.length) + numberAsString;

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
            if (args.transactions === undefined) {
                this.transactions = [];
            } else {
                this.transactions.splice(0, this.transactions.length, ...args.transactions);
            }
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

export class Receipt {
    public readonly transactionHash:string;
    public readonly transactionIndex:string;
    public readonly blockNumber:string;
    public readonly blockHash:string;
    public readonly cumulativeGasUsed:string;
    public readonly gasUsed:string;
    public readonly contractAddress:(null|string);
    public readonly logs:string[];
    public readonly logsBloom:string;
    public readonly status:string;

    constructor(txHash:string, record:TransactionRecord, block:Block) {
        const gasUsed = record.contractFunctionResult == null ? 0 : record.contractFunctionResult.gasUsed;
        const contractAddress = record.contractFunctionResult == null ? null : "0x" + record.contractFunctionResult.contractId?.toSolidityAddress();

        this.transactionHash = txHash;
        this.transactionIndex = '0x0';
        this.blockNumber = block.number;
        this.blockHash = block.hash;
        this.cumulativeGasUsed = Number(gasUsed).toString(16);
        this.gasUsed = Number(gasUsed).toString(16);
        this.contractAddress = contractAddress;
        this.logs = [];
        this.logsBloom = '';
        this.status = record.receipt.status == Status.Success ? "0x1" : "0x0";
    }
}

export class Transaction {
    public readonly accessList!: string | null;
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