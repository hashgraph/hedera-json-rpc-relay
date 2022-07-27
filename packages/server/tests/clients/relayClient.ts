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

import { ethers, providers } from 'ethers';
import { Logger } from 'pino';
import Assertions from '../helpers/assertions';
import { predefined } from '../../../relay/src/lib/errors/JsonRpcError';

export default class RelayClient {

    private readonly provider: providers.JsonRpcProvider;
    private readonly logger: Logger;

    constructor(relayUrl: string, logger: Logger) {
        this.logger = logger;
        this.provider = new ethers.providers.JsonRpcProvider(relayUrl);
    }

    /**
     * Calls the specified methodName with the provided params
     * @param methodName
     * @param params
     */
    async call(methodName: string, params: any[]) {
        const result = await this.provider.send(methodName, params);
        this.logger.trace(`[POST] to relay '${methodName}' with params [${JSON.stringify(params)}] returned ${JSON.stringify(result)}`);
        return result;
    };

    /**
     * Calls the specified methodName with the provided params and asserts that it fails
     * @param methodName
     * @param params
     */
    async callFailing(methodName: string, params: any[], expectedRpcError = predefined.INTERNAL_ERROR) {
        try {
            const res = await this.call(methodName, params);
            this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
            Assertions.expectedError();
        } catch (err) {
            Assertions.jsonRpcError(err, expectedRpcError);
        }
    }

    /**
     * Calls the specified methodName and asserts that it is not supported
     * @param methodName
     * @param params
     */
    async callUnsupported(methodName: string, params: any[]) {
        try {
            const res = await this.call(methodName, params);
            this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(res)}`);
            Assertions.expectedError();
        } catch (err) {
            Assertions.unsupportedResponse(err);
            return err;
        }
    };

    /**
     * Gets the account balance by executing `eth_getBalance`
     * @param address
     * @param block
     */
    async getBalance(address, block = 'latest') {
        this.logger.debug(`[POST] to relay eth_getBalance for address ${address}]`);
        return this.provider.getBalance(address, block);
    };

    /**
     * @param evmAddress
     *
     * Returns: The nonce of the account with the provided `evmAddress`
     */
    async getAccountNonce(evmAddress): Promise<number> {
        this.logger.debug(`[POST] to relay for eth_getTransactionCount for address ${evmAddress}`);
        const nonce = await this.provider.send('eth_getTransactionCount', [evmAddress, 'latest']);
        return Number(nonce);
    };

    /**
     * This invokes the relay logic from eth.ts/sendRawTransaction.
     *
     * Returns: Transaction hash
     * @param signedTx
     */
    async sendRawTransaction(signedTx): Promise<string> {
        this.logger.debug(`[POST] to relay for eth_sendRawTransaction`);
        return this.provider.send('eth_sendRawTransaction', [signedTx]);
    };

    /**
     * Returns the result of eth_gasPrice as a Number.
     */
    async gasPrice(): Promise<number> {
        return Number(await this.call('eth_gasPrice', []));
    }
}
