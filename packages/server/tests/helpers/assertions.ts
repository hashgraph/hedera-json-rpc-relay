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
import { expect } from 'chai';
import { ethers } from 'ethers';
import { Utils } from './utils';

export default class Assertions {
    static emptyHex = '0x';
    static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
    static zeroHex8Byte = '0x0000000000000000';
    static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
    static emptyBloom = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
    static defaultGasPrice = 720_000_000_000;
    static defaultGasUsed = 0.5;

    static assertId = (id) => {
        const [shard, realm, num] = id.split('.');
        expect(shard).to.not.be.null;
        expect(realm).to.not.be.null;
        expect(num).to.not.be.null;
    };

    static unsupportedResponse = (resp: any) => {
        expect(resp.error.code).to.eq(-32601);
        expect(resp.error.message).to.eq('Unsupported JSON-RPC method');
    };

    static expectedError = () => {
        expect(true).to.eq(false);
    };

    /**
     *
     * @param relayResponse
     * @param mirrorNodeResponse
     * @param mirrorTransactions
     * @param hydratedTransactions - aka showDetails flag
     */
    public static block(relayResponse, mirrorNodeResponse, mirrorTransactions, hydratedTransactions = false) {
        // Assert static values
        expect(relayResponse.baseFeePerGas).to.be.equal(ethers.utils.hexValue(this.defaultGasPrice));
        expect(relayResponse.difficulty).to.be.equal(ethers.utils.hexValue(0));
        expect(relayResponse.extraData).to.be.equal(Assertions.emptyHex);
        expect(relayResponse.miner).to.be.equal(ethers.constants.AddressZero);
        expect(relayResponse.mixHash).to.be.equal(Assertions.zeroHex32Byte);
        expect(relayResponse.nonce).to.be.equal(Assertions.zeroHex8Byte);
        expect(relayResponse.receiptsRoot).to.be.equal(Assertions.zeroHex32Byte);
        expect(relayResponse.sha3Uncles).to.be.equal(Assertions.emptyArrayHex);
        expect(relayResponse.stateRoot).to.be.equal(Assertions.zeroHex32Byte);
        expect(relayResponse.totalDifficulty).to.be.equal(ethers.utils.hexValue(0));
        expect(relayResponse.uncles).to.be.exist;
        expect(relayResponse.uncles.length).to.eq(0);
        expect(relayResponse.logsBloom).to.eq(Assertions.emptyBloom);

        // Assert dynamic values
        expect(relayResponse.hash).to.be.equal(mirrorNodeResponse.hash.slice(0, 66));
        expect(relayResponse.number).to.be.equal(ethers.utils.hexValue(mirrorNodeResponse.number));
        expect(relayResponse.transactions.length).to.equal(mirrorTransactions.length);
        expect(relayResponse.parentHash).to.equal(mirrorNodeResponse.previous_hash.slice(0, 66));
        expect(relayResponse.size).to.equal(ethers.utils.hexValue(mirrorNodeResponse.size | 0));

        let maxGasLimit = 0;
        let gasUsed = 0;
        let timestamp = 0;

        for (const result of mirrorTransactions) {
            maxGasLimit = result.gas_limit > maxGasLimit ? result.gas_limit : maxGasLimit;
            gasUsed += result.gas_used;
            if (timestamp === 0) {
                timestamp = result.timestamp.substring(0, result.timestamp.indexOf('.'));
            }
        }

        expect(relayResponse.gasLimit).to.equal(ethers.utils.hexValue(maxGasLimit));
        expect(relayResponse.gasUsed).to.equal(ethers.utils.hexValue(gasUsed));
        expect(relayResponse.timestamp).to.equal(ethers.utils.hexValue(Number(timestamp)));

        if (relayResponse.transactions.length) {
            expect(relayResponse.transactionsRoot).to.equal(mirrorNodeResponse.hash.slice(0, 66));
        }
        else {
            expect(relayResponse.transactionsRoot).to.equal(Assertions.ethEmptyTrie);
        }

        // Assert transactions
        for (const i in relayResponse.transactions) {
            const tx = relayResponse.transactions[i];
            const mirrorTx = mirrorTransactions[i];
            if ( hydratedTransactions ) {
                Assertions.transaction(tx, mirrorTx);
            }
            else {
                expect(tx).to.eq(mirrorTx.hash.slice(0, 66));
            }
        }
    }

    public static transaction(relayResponse, mirrorNodeResponse) {
        expect(relayResponse.blockHash).to.eq(mirrorNodeResponse.block_hash.slice(0, 66));
        expect(relayResponse.blockNumber).to.eq(ethers.utils.hexValue(mirrorNodeResponse.block_number));
        // expect(relayResponse.chainId).to.eq(mirrorNodeResponse.chain_id); // FIXME must not be null!
        expect(relayResponse.from).to.eq(mirrorNodeResponse.from);
        expect(relayResponse.gas).to.eq(mirrorNodeResponse.gas_used);
        // expect(relayResponse.gasPrice).to.eq(mirrorNodeResponse.gas_price); // FIXME must not be null!
        expect(relayResponse.hash).to.eq(mirrorNodeResponse.hash.slice(0, 66));
        expect(relayResponse.input).to.eq(mirrorNodeResponse.function_parameters);
        expect(relayResponse.to).to.eq(mirrorNodeResponse.to);
        expect(relayResponse.transactionIndex).to.eq(mirrorNodeResponse.transaction_index);
        expect(relayResponse.value).to.eq(mirrorNodeResponse.amount);
    }

    static transactionReceipt = (transactionReceipt, mirrorResult) => {
        expect(transactionReceipt.blockHash).to.exist;
        expect(transactionReceipt.blockHash).to.not.eq('0x0');
        expect(transactionReceipt.blockHash).to.eq(mirrorResult.block_hash.slice(0, 66));

        expect(transactionReceipt.blockNumber).to.exist;
        expect(Number(transactionReceipt.blockNumber)).to.gt(0);
        expect(transactionReceipt.blockNumber).to.eq(ethers.utils.hexValue(mirrorResult.block_number));

        expect(transactionReceipt.cumulativeGasUsed).to.exist;
        expect(Number(transactionReceipt.cumulativeGasUsed)).to.gt(0);
        expect(Number(transactionReceipt.cumulativeGasUsed)).to.eq(mirrorResult.block_gas_used);

        expect(transactionReceipt.gasUsed).to.exist;
        expect(Number(transactionReceipt.gasUsed)).to.gt(0);
        expect(Number(transactionReceipt.gasUsed)).to.eq(mirrorResult.gas_used);

        expect(transactionReceipt.logsBloom).to.exist;
        expect(transactionReceipt.logsBloom).to.not.eq('0x0');
        expect(transactionReceipt.logsBloom).to.eq(mirrorResult.bloom);

        expect(transactionReceipt.transactionHash).to.exist;
        expect(transactionReceipt.transactionHash).to.not.eq('0x0');
        expect(transactionReceipt.transactionHash).to.eq(mirrorResult.hash);

        expect(transactionReceipt.transactionIndex).to.exist;
        expect(Number(transactionReceipt.transactionIndex)).to.eq(mirrorResult.transaction_index);

        expect(transactionReceipt.effectiveGasPrice).to.exist;
        expect(Number(transactionReceipt.effectiveGasPrice)).to.gt(0);
        const effectiveGas = mirrorResult.max_fee_per_gas === undefined || mirrorResult.max_fee_per_gas == '0x'
            ? mirrorResult.gas_price
            : mirrorResult.max_fee_per_gas;
        const mirrorEffectiveGasPrice = Utils.tinyBarsToWeibars(effectiveGas);
        expect(transactionReceipt.effectiveGasPrice).to.eq(mirrorEffectiveGasPrice);

        expect(transactionReceipt.status).to.exist;
        expect(transactionReceipt.status).to.eq(mirrorResult.status);

        expect(transactionReceipt.logs).to.exist;
        expect(transactionReceipt.logs.length).to.eq(mirrorResult.logs.length);
        expect(transactionReceipt.logs).to.deep.eq(mirrorResult.logs);

        expect(transactionReceipt.from).to.eq(mirrorResult.from);

        expect(transactionReceipt.to).to.eq(mirrorResult.to);
    };

    static unknownResponse(err) {
        const parsedError = JSON.parse(err.body);
        expect(parsedError.error.message).to.be.equal('Unknown error invoking RPC');
        expect(parsedError.error.code).to.be.equal(-32603);
    }
}
