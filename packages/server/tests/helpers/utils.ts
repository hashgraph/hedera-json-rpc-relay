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

import { BigNumber, ethers } from 'ethers';
import type { TransactionRequest } from '@ethersproject/abstract-provider';
import Assertions from './assertions';
import { JsonRpcProvider } from '@ethersproject/providers';

export default class TestUtils {
    public readonly provider: JsonRpcProvider;

    constructor(args: {
        // Uses the JsonRpcProvided if it is provided, otherwise initializes a new one with serverUrl
        provider?: JsonRpcProvider
        serverUrl?: string,

        // Services options
        services: {
            network: string,
            key: string,
            accountId: string
        },
    }) {
        if (!args.provider) {
            this.provider = new ethers.providers.JsonRpcProvider(args.serverUrl);
        } else {
            this.provider = args.provider;
        }

    }

    prune0x = (input: string): string => {
        return input.startsWith('0x') ? input.substring(2) : input;
    };

    toHex = (num) => {
        return parseInt(num).toString(16);
    };

    idToEvmAddress = (id): string => {
        Assertions.assertId(id);
        const [shard, realm, num] = id.split('.');

        return [
            '0x',
            this.toHex(shard).padStart(8, '0'),
            this.toHex(realm).padStart(16, '0'),
            this.toHex(num).padStart(16, '0')
        ].join('');
    };

    // callFailingRelayMethod = async (methodName: string, params: any[]) => {
    //     try {
    //         const res = await this.callRelay(methodName, params);
    //         this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
    //         Assertions.expectedError();
    //     } catch (err) {
    //         Assertions.failedResponce(err);
    //         return err;
    //     }
    // };

    // callUnsupportedRelayMethod = async (methodName: string, params: any[]) => {
    //     try {
    //         const res = await this.callRelay(methodName, params);
    //         this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
    //         Assertions.expectedError();
    //     } catch (err) {
    //         Assertions.unsupportedResponse(err);
    //         return err;
    //     }
    // };

    signRawTransaction = async (tx: TransactionRequest, privateKey) => {
        const wallet = new ethers.Wallet(privateKey.toStringRaw(), this.provider);
        return await wallet.signTransaction(tx);
    };

    subtractBigNumberHexes = (hex1, hex2) => {
        return BigNumber.from(hex1).sub(BigNumber.from(hex2));
    };
}
