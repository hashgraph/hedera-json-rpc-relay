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
import { ethers, BigNumber } from 'ethers';
import { JsonRpcError, predefined } from '../../../relay/src/lib/errors/JsonRpcError';
import { Utils } from './utils';

export default class Assertions {
    static emptyHex = '0x';
    static zeroHex32Byte = '0x0000000000000000000000000000000000000000000000000000000000000000';
    static zeroHex8Byte = '0x0000000000000000';
    static emptyArrayHex = '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347';
    static emptyBloom = "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    static ethEmptyTrie = '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421';
    static defaultGasPrice = 720_000_000_000;
    static datedGasPrice = 570_000_000_000;
    static updatedGasPrice = 640_000_000_000;
    static maxBlockGasLimit = 15_000_000;
    static defaultGasUsed = 0.5;

    static assertId = (id) => {
        const [shard, realm, num] = id.split('.');
        expect(shard).to.not.be.null;
        expect(realm).to.not.be.null;
        expect(num).to.not.be.null;
    };

    static unsupportedResponse = (resp: any) => {
        expect(resp.error.code).to.eq(-32601);
        expect(resp.error.message.endsWith('Unsupported JSON-RPC method')).to.be.true;
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
        expect(relayResponse.baseFeePerGas).to.exist;

        if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
            expect(relayResponse.baseFeePerGas).to.be.equal(ethers.utils.hexValue(this.defaultGasPrice));
        }
        else {
            expect(Number(relayResponse.baseFeePerGas)).to.be.gt(0);
        }

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
        expect(relayResponse.gasLimit).to.equal(ethers.utils.hexValue(Assertions.maxBlockGasLimit));

        // Assert dynamic values
        expect(relayResponse.hash).to.be.equal(mirrorNodeResponse.hash.slice(0, 66));
        expect(relayResponse.number).to.be.equal(ethers.utils.hexValue(mirrorNodeResponse.number));
        expect(relayResponse.transactions.length).to.equal(mirrorTransactions.length);
        expect(relayResponse.parentHash).to.equal(mirrorNodeResponse.previous_hash.slice(0, 66));
        expect(relayResponse.size).to.equal(ethers.utils.hexValue(mirrorNodeResponse.size | 0));
        expect(relayResponse.gasUsed).to.equal(ethers.utils.hexValue(mirrorNodeResponse.gas_used));
        expect(relayResponse.timestamp).to.equal(ethers.utils.hexValue(Number(mirrorNodeResponse.timestamp.from.split('.')[0])));
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
        expect(relayResponse.gas).to.eq(ethers.utils.hexValue(mirrorNodeResponse.gas_used));
        // expect(relayResponse.gasPrice).to.eq(mirrorNodeResponse.gas_price); // FIXME must not be null!
        expect(relayResponse.hash).to.eq(mirrorNodeResponse.hash.slice(0, 66));
        expect(relayResponse.input).to.eq(mirrorNodeResponse.function_parameters);
        if (relayResponse.to || mirrorNodeResponse.to) {
            expect(relayResponse.to).to.eq(mirrorNodeResponse.to);
        }
        expect(relayResponse.transactionIndex).to.eq(ethers.utils.hexValue(mirrorNodeResponse.transaction_index));
        expect(relayResponse.value).to.eq(ethers.utils.hexValue(mirrorNodeResponse.amount));
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
        expect(BigNumber.from(transactionReceipt.effectiveGasPrice).toString()).to.eq(mirrorEffectiveGasPrice.toString());

        expect(transactionReceipt.status).to.exist;
        expect(transactionReceipt.status).to.eq(mirrorResult.status);

        expect(transactionReceipt.logs).to.exist;
        expect(transactionReceipt.logs.length).to.eq(mirrorResult.logs.length);
        expect(transactionReceipt.logs).to.deep.eq(mirrorResult.logs);

        expect(transactionReceipt.from).to.eq(mirrorResult.from);

        expect(transactionReceipt.to).to.eq(mirrorResult.to);
    };

    public static feeHistory(res: any, expected: any) {
        expect(res.baseFeePerGas).to.exist.to.be.an('Array');
        expect(res.gasUsedRatio).to.exist.to.be.an('Array');
        expect(res.oldestBlock).to.exist;
        expect(res.baseFeePerGas.length).to.equal(expected.resultCount + 1);
        expect(res.gasUsedRatio.length).to.equal(expected.resultCount);

        expect(res.oldestBlock).to.equal(expected.oldestBlock);

        res.gasUsedRatio.map((gasRatio: string) => expect(gasRatio).to.equal(`0x${Assertions.defaultGasUsed.toString(16)}`))

        if (expected.checkReward) {
            expect(res.reward).to.exist.to.be.an('Array');
            expect(res.reward.length).to.equal(expected.resultCount);
        }
    }

    static unknownResponse(err) {
        Assertions.jsonRpcError(err, predefined.INTERNAL_ERROR());
    }

    static jsonRpcError(err: any, expectedError: JsonRpcError) {
        expect(err).to.exist;
        expect(err).to.have.property('body');

        const parsedError = JSON.parse(err.body);
        expect(parsedError.error.message.endsWith(expectedError.message)).to.be.true;
        expect(parsedError.error.code).to.be.equal(expectedError.code);
        if (expectedError.data) {
            expect(parsedError.error.data).to.be.equal(expectedError.data);
        }
    }

    static expectRevert = async (promise, code) => {
        const tx = await promise;
        try {
            await tx.wait();
            Assertions.expectedError();
        }
        catch(e:any) {
            expect(e).to.exist;
            expect(e.code).to.eq(code);
        }
    };

}
