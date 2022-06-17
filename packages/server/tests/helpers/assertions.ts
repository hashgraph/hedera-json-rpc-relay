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

    public static block(relayResponse, mirrorNodeResponse) {
        expect(relayResponse.hash).to.be.equal(mirrorNodeResponse.hash.slice(0, 66));
        expect(relayResponse.number).to.be.equal(ethers.utils.hexValue(mirrorNodeResponse.number));
        // expect(relayResponse.transactions.length).to.equal(mirrorNodeResponse.count); // FIXME this assertion fails
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
        expect(transactionReceipt.blockNumber).to.eq(Utils.numberTo0x(mirrorResult.block_number));

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
