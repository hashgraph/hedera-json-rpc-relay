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

// Used for fake implementation of block history
import {Status, TransactionRecord} from "@hashgraph/sdk";
import { Block } from "./block";
import { Log } from "./log";

export class Receipt {
    public readonly transactionHash:string;
    public readonly transactionIndex:string;
    public readonly blockHash:string;
    public readonly blockNumber:string;
    public readonly from:string;
    public readonly to:(undefined|string);
    public readonly cumulativeGasUsed:string;
    public readonly gasUsed:string;
    public readonly contractAddress:(undefined|string);
    public readonly logs:Log[];
    public readonly logsBloom:string;
    public readonly root:(undefined|string);
    public readonly status:(undefined|string);
    public readonly effectiveGasPrice:(undefined|string);

    constructor(txHash:string, record:TransactionRecord, block:Block) {
        const gasUsed = record.contractFunctionResult == null ? 0 : record.contractFunctionResult.gasUsed;
        const contractAddress = record.contractFunctionResult == undefined ? undefined : "0x" + record.contractFunctionResult.contractId?.toSolidityAddress();

        this.transactionHash = txHash;
        this.transactionIndex = '0x0';
        this.blockNumber = block.number;
        this.blockHash = block.hash;
        this.from = '0x';
        // TODO this.to = record.contractFunctionResult?.contractId;
        this.cumulativeGasUsed = Number(gasUsed).toString(16);
        this.gasUsed = Number(gasUsed).toString(16);
        this.contractAddress = contractAddress;
        this.logs = [];
        this.logsBloom = '';
        this.status = record.receipt.status == Status.Success ? "0x1" : "0x0";
    }
}
