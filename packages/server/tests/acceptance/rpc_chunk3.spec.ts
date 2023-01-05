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
import {expect} from 'chai';
import {ethers} from 'ethers';
import {AliasAccount} from '../clients/servicesClient';
import {Utils} from '../helpers/utils';

// local resources
import reverterContractJson from '../contracts/Reverter.json';
import {EthImpl} from '@hashgraph/json-rpc-relay/src/lib/eth';

describe('@api-chunk-3 RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const accounts: AliasAccount[] = [];

    // @ts-ignore
    const {servicesNode, mirrorNode, relay, logger} = global;


    const CHAIN_ID = process.env.CHAIN_ID || 0;
    const ONE_TINYBAR = ethers.utils.parseUnits('1', 10).toHexString();


    let reverterContract, reverterEvmAddress, requestId;
    const PURE_METHOD_CALL_DATA = '0xb2e0100c';
    const VIEW_METHOD_CALL_DATA = '0x90e9b875';
    const PAYABLE_METHOD_CALL_DATA = '0xd0efd7ef';
    const PURE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5075726500000000000000000000000000000000';
    const VIEW_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5669657700000000000000000000000000000000';
    const PAYABLE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013526576657274526561736f6e50617961626c6500000000000000000000000000';
    const PURE_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonPure';
    const VIEW_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonView';

    beforeEach(async () => {
        requestId = Utils.generateRequestId();
    });

    before(async () => {

        requestId = Utils.generateRequestId();

        accounts[0] = await servicesNode.createAliasAccount(30, null, requestId);

        reverterContract = await servicesNode.deployContract(reverterContractJson);
        // Wait for creation to propagate
        await mirrorNode.get(`/contracts/${reverterContract.contractId}`, requestId);
        reverterEvmAddress = `0x${reverterContract.contractId.toSolidityAddress()}`;
    });

    describe('Contract call reverts', async () => {
        it('Returns revert message for pure methods', async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: reverterEvmAddress,
                gas: EthImpl.numberTo0x(30000),
                data: PURE_METHOD_CALL_DATA
            };

            await relay.callFailing('eth_call', [callData, 'latest'], {
                code: -32008,
                message: PURE_METHOD_ERROR_MESSAGE,
                data: PURE_METHOD_ERROR_DATA
            }, requestId);
        });

        it('Returns revert message for view methods', async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: reverterEvmAddress,
                gas: EthImpl.numberTo0x(30000),
                data: VIEW_METHOD_CALL_DATA
            };

            await relay.callFailing('eth_call', [callData, 'latest'], {
                code: -32008,
                message: VIEW_METHOD_ERROR_MESSAGE,
                data: VIEW_METHOD_ERROR_DATA
            }, requestId);
        });

        it('Returns revert reason in receipt for payable methods', async () => {
            const transaction = {
                value: ONE_TINYBAR,
                gasLimit: EthImpl.numberTo0x(30000),
                chainId: Number(CHAIN_ID),
                to: reverterEvmAddress,
                nonce: await relay.getAccountNonce('0x' + accounts[0].address, requestId),
                gasPrice: await relay.gasPrice(requestId),
                data: PAYABLE_METHOD_CALL_DATA
            };
            const signedTx = await accounts[0].wallet.signTransaction(transaction);
            const transactionHash = await relay.call('eth_sendRawTransaction', [signedTx], requestId);

            // Wait until receipt is available in mirror node
            await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

            const receipt = await relay.call('eth_getTransactionReceipt', [transactionHash], requestId);
            expect(receipt?.revertReason).to.exist;
            expect(receipt.revertReason).to.eq(PAYABLE_METHOD_ERROR_DATA);
        });

        describe('eth_getTransactionByHash for reverted payable contract calls', async function () {
            const payableMethodsData = [
                {
                    data: '0xfe0a3dd7',
                    method: 'revertWithNothing',
                    message: '',
                    errorData: '0x'
                },
                {
                    data: '0x0323d234',
                    method: 'revertWithString',
                    message: 'Some revert message',
                    errorData: '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000'
                },
                {
                    data: '0x46fc4bb1',
                    method: 'revertWithCustomError',
                    message: '',
                    errorData: '0x0bd3d39c'
                },
                {
                    data: '0x33fe3fbd',
                    method: 'revertWithPanic',
                    message: '',
                    errorData: '0x4e487b710000000000000000000000000000000000000000000000000000000000000012'
                }
            ];
            const hashes: any = [];

            beforeEach(async () => {
                requestId = Utils.generateRequestId();
            });

            before(async function () {
                for (let i = 0; i < payableMethodsData.length; i++) {
                    const transaction = {
                        // value: ONE_TINYBAR,
                        gasLimit: EthImpl.numberTo0x(30000),
                        chainId: Number(CHAIN_ID),
                        to: reverterEvmAddress,
                        nonce: await relay.getAccountNonce('0x' + accounts[0].address, requestId),
                        gasPrice: await relay.gasPrice(requestId),
                        data: payableMethodsData[i].data
                    };
                    const signedTx = await accounts[0].wallet.signTransaction(transaction);
                    const hash = await relay.call('eth_sendRawTransaction', [signedTx], requestId);
                    hashes.push(hash);

                    // Wait until receipt is available in mirror node
                    await mirrorNode.get(`/contracts/results/${hash}`, requestId);
                }
            });

            for (let i = 0; i < payableMethodsData.length; i++) {
                it(`Payable method ${payableMethodsData[i].method} returns tx object`, async function () {
                    const tx = await relay.call('eth_getTransactionByHash', [hashes[i]], requestId);
                    expect(tx).to.exist;
                    expect(tx.hash).to.exist;
                    expect(tx.hash).to.eq(hashes[i]);
                });
            }

            describe('DEV_MODE = true', async function () {
                before(async () => {
                    process.env.DEV_MODE = 'true';
                });

                after(async () => {
                    process.env.DEV_MODE = 'false';
                });

                for (let i = 0; i < payableMethodsData.length; i++) {
                    it(`Payable method ${payableMethodsData[i].method} throws an error`, async function () {
                        await relay.callFailing('eth_getTransactionByHash', [hashes[i]], {
                            code: -32008,
                            message: payableMethodsData[i].message,
                            data: payableMethodsData[i].errorData
                        }, requestId);
                    });
                }
            });
        });

        describe('eth_call for reverted pure contract calls', async function () {
            beforeEach(async () => {
                requestId = Utils.generateRequestId();
            });

            const pureMethodsData = [
                {
                    data: '0x2dac842f',
                    method: 'revertWithNothingPure',
                    message: '',
                    errorData: '0x'
                },
                {
                    data: '0x8b153371',
                    method: 'revertWithStringPure',
                    message: 'Some revert message',
                    errorData: '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013536f6d6520726576657274206d65737361676500000000000000000000000000'
                },
                {
                    data: '0x35314694',
                    method: 'revertWithCustomErrorPure',
                    message: '',
                    errorData: '0x0bd3d39c'
                },
                {
                    data: '0x83889056',
                    method: 'revertWithPanicPure',
                    message: '',
                    errorData: '0x4e487b710000000000000000000000000000000000000000000000000000000000000012'
                }
            ];

            for (let i = 0; i < pureMethodsData.length; i++) {
                it(`Pure method ${pureMethodsData[i].method} returns tx receipt`, async function () {
                    const callData = {
                        from: '0x' + accounts[0].address,
                        to: reverterEvmAddress,
                        gas: EthImpl.numberTo0x(30000),
                        data: pureMethodsData[i].data
                    };

                    await relay.callFailing('eth_call', [callData, 'latest'], {
                        code: -32008,
                        message: pureMethodsData[i].message,
                        data: pureMethodsData[i].errorData
                    }, requestId);
                });
            }
        });
    });
});
