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

// external resources
import { expect } from 'chai';
import { ethers } from 'ethers';
import { AliasAccount } from '../clients/servicesClient';
import Assertions from '../helpers/assertions';
import { ContractFunctionParameters } from '@hashgraph/sdk';

// local resources
import parentContractJson from '../contracts/Parent.json';
import { predefined } from '@hashgraph/json-rpc-relay/src/lib/errors/JsonRpcError';

describe('@ratelimiter Rate Limiters Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds
    
    const accounts: AliasAccount[] = [];

    // @ts-ignore
    const { servicesNode, mirrorNode, relay, logger } = global;

    // cached entities
    let contractId;
    let contractExecuteTimestamp;
    let mirrorContract;

    const CHAIN_ID = process.env.CHAIN_ID || 0;
    const ONE_TINYBAR = ethers.utils.parseUnits('1', 10);

    describe('RPC Rate Limiter Acceptance Tests', () => {
        it('should throw rate limit exceeded error', async function() {
            let rateLimited = false;
            try{
                //Currently chaindId is TIER 2 request per LIMIT_DURATION from env. We are trying to get an error for rate limit by exceeding this threshold
                for (let index = 0; index < parseInt(process.env.TIER_2_RATE_LIMIT!) * 2; index++) {
                    await relay.call('eth_chainId', [null]);
                    // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
                    await new Promise(r => setTimeout(r, 1));
                }
            }catch(error) {
                rateLimited = true;
                Assertions.jsonRpcError(error, predefined.IP_RATE_LIMIT_EXCEEDED('eth_chainId'));
            }

            expect(rateLimited).to.be.true;

            // wait until rate limit is reset
            await new Promise(r => setTimeout(r, parseInt(process.env.LIMIT_DURATION!)));
        });

        it('should not throw rate limit exceeded error', async function () {
            for (let index = 0; index < parseInt(process.env.TIER_2_RATE_LIMIT!); index++) {
                await relay.call('eth_chainId', [null]);
                // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
                await new Promise(r => setTimeout(r, 1));
            }

            // wait until rate limit is reset
            await new Promise(r => setTimeout(r, parseInt(process.env.LIMIT_DURATION!)));

            for (let index = 0; index < parseInt(process.env.TIER_2_RATE_LIMIT!); index++) {
                await relay.call('eth_chainId', [null]);
                // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
                await new Promise(r => setTimeout(r, 1));
            }
        });
    });

    describe('HBAR Limiter Acceptance Tests', function () {
        this.timeout(240 * 1000); // 240 seconds

        this.beforeAll(async () => {
            logger.info('Creating accounts');
            accounts[0] = await servicesNode.createAliasAccount(15);
            accounts[1] = await servicesNode.createAliasAccount(100);
            contractId = await accounts[0].client.createParentContract(parentContractJson);

            const params = new ContractFunctionParameters().addUint256(1);
            contractExecuteTimestamp = (await accounts[0].client
                .executeContractCall(contractId, 'createChild', params)).contractExecuteTimestamp;

            // alow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
            await new Promise(r => setTimeout(r, 5000));

            // get contract details
            mirrorContract = await mirrorNode.get(`/contracts/${contractId}`);
        });

        describe('HBAR Rate Limit Tests', () => {
            const defaultGasPrice = Assertions.defaultGasPrice;
            const defaultGasLimit = 3_000_000;

            const defaultLondonTransactionData = {
                value: ONE_TINYBAR,
                chainId: Number(CHAIN_ID),
                maxPriorityFeePerGas: defaultGasPrice,
                maxFeePerGas: defaultGasPrice,
                gasLimit: defaultGasLimit,
                type: 2
            };

            it('should fail to execute "eth_sendRawTransaction" due to HBAR rate limit exceeded ', async function () {
                await new Promise(r => setTimeout(r, parseInt(process.env.HBAR_RATE_LIMIT_DURATION!)));
                let rateLimit = false;
                try {
                    for (let index = 0; index < parseInt(process.env.TIER_1_RATE_LIMIT!); index++) {
                        const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
                        const gasPrice = await relay.gasPrice();

                        const transaction = {
                            ...defaultLondonTransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[1].address),
                            maxPriorityFeePerGas: gasPrice,
                            maxFeePerGas: gasPrice,
                        };
                        const signedTx = await accounts[1].wallet.signTransaction(transaction);
                        await relay.call('eth_sendRawTransaction', [signedTx]);
                        await new Promise(r => setTimeout(r, 1));
                    }
                } catch (error) {
                    Assertions.jsonRpcError(error, predefined.HBAR_RATE_LIMIT_EXCEEDED);
                    rateLimit = true;
                }

                expect(rateLimit).to.equal(true);
                await new Promise(r => setTimeout(r, parseInt(process.env.HBAR_RATE_LIMIT_DURATION!)));
            });

            it('should execute "eth_sendRawTransaction" without triggering HBAR rate limit exceeded ', async function () {
                let rateLimit = false;
                try {
                    const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
                    const gasPrice = await relay.gasPrice();

                    const transaction = {
                        ...defaultLondonTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[1].address),
                        maxPriorityFeePerGas: gasPrice,
                        maxFeePerGas: gasPrice,
                    };
                    const signedTx = await accounts[1].wallet.signTransaction(transaction);
                    await relay.call('eth_sendRawTransaction', [signedTx]);
                } catch (error) {
                    rateLimit = true;
                }

                expect(rateLimit).to.equal(false);
            });
        });
    });
});
