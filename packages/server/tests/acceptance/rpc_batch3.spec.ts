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
import { Utils } from '../helpers/utils';

// local resources
import reverterContractJson from '../contracts/Reverter.json';
import { EthImpl } from '../../../../packages/relay/src/lib/eth';
import { predefined } from '../../../../packages/relay';
import basicContractJson from '../contracts/Basic.json';
import callerContractJson from '../contracts/Caller.json';
import HederaTokenServiceImplJson from '../contracts/HederaTokenServiceImpl.json';
//Constants are imported with different definitions for better readability in the code.
import Constants from '../../../../packages/relay/src/lib/constants';
import RelayCall from '../../tests/helpers/constants';
import Helper from '../../tests/helpers/constants';
import Address from '../../tests/helpers/constants';

describe('@api-batch-3 RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const accounts: AliasAccount[] = [];

    // @ts-ignore
    const { servicesNode, mirrorNode, relay, logger } = global;


    const CHAIN_ID = process.env.CHAIN_ID || 0;
    const ONE_TINYBAR = ethers.utils.parseUnits('1', 10).toHexString();


    let reverterContract, reverterEvmAddress, requestId;
    const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
    const BASIC_CONTRACT_PING_RESULT = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const RESULT_TRUE = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const PURE_METHOD_CALL_DATA = '0xb2e0100c';
    const VIEW_METHOD_CALL_DATA = '0x90e9b875';
    const PAYABLE_METHOD_CALL_DATA = '0xd0efd7ef';
    const PURE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5075726500000000000000000000000000000000';
    const VIEW_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5669657700000000000000000000000000000000';
    const PAYABLE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013526576657274526561736f6e50617961626c6500000000000000000000000000';
    const PURE_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonPure';
    const VIEW_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonView';
    const errorMessagePrefixedStr = 'Expected 0x prefixed string representing the hash (32 bytes) in object, 0x prefixed hexadecimal block number, or the string "latest", "earliest" or "pending"';

    beforeEach(async () => {
        requestId = Utils.generateRequestId();
    });

    before(async () => {

        requestId = Utils.generateRequestId();

        accounts[0] = await servicesNode.createAliasAccount(80, null, requestId);
        accounts[1] = await servicesNode.createAliasAccount(80, relay.provider, requestId);

        reverterContract = await servicesNode.deployContract(reverterContractJson);
        // Wait for creation to propagate
        await mirrorNode.get(`/contracts/${reverterContract.contractId}`, requestId);
        reverterEvmAddress = `0x${reverterContract.contractId.toSolidityAddress()}`;
    });


    describe('eth_call', () => {
        let basicContract, evmAddress;

        before(async () => {
            basicContract = await servicesNode.deployContract(basicContractJson);
            // Wait for creation to propagate
            await mirrorNode.get(`/contracts/${basicContract.contractId}`, requestId);

            evmAddress = `0x${basicContract.contractId.toSolidityAddress()}`;
        });

        it('@release should execute "eth_call" request to Basic contract', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                gas: EthImpl.numberTo0x(30000),
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });

        it('should fail "eth_call" request without data field', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                gas: EthImpl.numberTo0x(30000)
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x'); // confirm no error
        });

        it('"eth_call" for non-existing contract address returns 0x', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: Address.NON_EXISTING_ADDRESS,
                gas: EthImpl.numberTo0x(30000),
                data: BASIC_CONTRACT_PING_CALL_DATA
            };
            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq('0x'); // confirm no error
        });

        it('should execute "eth_call" without from field', async function () {
            const callData = {
                to: evmAddress,
                gas: EthImpl.numberTo0x(30000),
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });

        it('should execute "eth_call" without gas field', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });


        it('should execute "eth_call" with correct block number', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, '0x10'], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });

        it('should execute "eth_call" with correct block hash object', async function () {
            const blockHash = '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3';
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { 'blockHash': blockHash }], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });

        it('should execute "eth_call" with correct block number object', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };

            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { 'blockNumber': '0x1' }], requestId);
            expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
        });

        it('should fail to execute "eth_call" with wrong block tag', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };
            const errorType = predefined.INVALID_PARAMETER(1, `${errorMessagePrefixedStr}, value: newest`);

            await expect(relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'newest'], requestId)).to.be.rejectedWith(errorType);
        });

        it('should fail to execute "eth_call" with wrong block number', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };
            const errorType = predefined.INVALID_PARAMETER(1, `${errorMessagePrefixedStr}, value: 123`);

            await expect(relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, '123'], requestId)).to.be.rejectedWith(errorType);
        });

        it('should fail to execute "eth_call" with wrong block hash object', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };
            const errorType = predefined.INVALID_PARAMETER(`'blockHash' for BlockHashObject`, 'Expected 0x prefixed string representing the hash (32 bytes) of a block, value: 0x123');

            await expect(relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { 'blockHash': '0x123' }], requestId)).to.be.rejectedWith(errorType);
        });

        it('should fail to execute "eth_call" with wrong block number object', async function () {
            const callData = {
                from: '0x' + accounts[0].address,
                to: evmAddress,
                data: BASIC_CONTRACT_PING_CALL_DATA
            };
            const errorType = predefined.INVALID_PARAMETER(`'blockNumber' for BlockNumberObject`, `${errorMessagePrefixedStr}, value: 123`);

            await expect(relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, { 'blockHash': '0x123' }], requestId)).to.be.rejectedWith(errorType);
        });

        describe('Caller contract', () => {
            let callerContract, callerAddress, defaultCallData, activeAccount;

            const describes = [
                {
                    title: 'With long-zero address',
                    beforeFunc: async function () {
                        activeAccount = accounts[0];
                        callerContract = await servicesNode.deployContract(callerContractJson);
                        // Wait for creation to propagate
                        const callerMirror = await mirrorNode.get(`/contracts/${callerContract.contractId}`, requestId);
                        callerAddress = `0x${callerContract.contractId.toSolidityAddress()}`;
                        defaultCallData = {
                            from: `0x${activeAccount.address}`,
                            to: callerAddress,
                            gas: `0x7530`,
                        };
                    }
                },
                {
                    title: 'With evm address',
                    beforeFunc: async function () {
                        activeAccount = accounts[1];
                        callerContract = await Utils.deployContractWithEthers([], callerContractJson, activeAccount.wallet, relay);
                        // Wait for creation to propagate
                        const callerMirror = await mirrorNode.get(`/contracts/${callerContract.address}`, requestId);
                        callerAddress = callerMirror.evm_address;
                        defaultCallData = {
                            from: `0x${activeAccount.address}`,
                            to: callerAddress,
                            gas: `0x7530`,
                        };
                    }
                }
            ];

            for (const desc of describes) {
                describe(desc.title, () => {
                    before(desc.beforeFunc);

                    it('001 Should call pureMultiply', async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0x0ec1551d'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
                    });

                    it("002 Should call msgSender", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0xd737d0c7'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq(`0x${activeAccount.address.padStart(64, '0')}`);
                    });

                    it("003 Should call txOrigin", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0xf96757d1'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq(`0x${activeAccount.address.padStart(64, '0')}`);
                    });

                    it("004 Should call msgSig", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0xec3e88cf'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq('0xec3e88cf00000000000000000000000000000000000000000000000000000000');
                    });

                    it("005 Should call addressBalance", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0x0ec1551d'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
                    });

                    it("006 'data' from request body with wrong method signature", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0x3ec4de3800000000000000000000000067d8d32e9bf1a9968a5ff53b87d777aa8ebbee69'
                        };

                        await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], predefined.CONTRACT_REVERT(), requestId);
                    });

                    it("007 'data' from request body with wrong encoded parameter", async function () {
                        const callData = {
                            ...defaultCallData,
                            data: '0x3ec4de350000000000000000000000000000000000000000000000000000000000000000'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
                    });

                    it("008 should work for missing 'from' field", async function () {
                        const callData = {
                            to: callerAddress,
                            data: '0x0ec1551d'
                        };

                        const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                        expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
                    });

                    it("009 should fail for missing 'to' field", async function () {
                        const callData = {
                            from: `0x${accounts[0].address}`,
                            data: '0x0ec1551d'
                        };

                        await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], predefined.INVALID_CONTRACT_ADDRESS(undefined), requestId);
                    });

                    // value is processed only when eth_call goes through the mirror node
                    if (process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE && process.env.ETH_CALL_DEFAULT_TO_CONSENSUS_NODE === 'false') {
                        it("010 Should call msgValue", async function () {
                            const callData = {
                                ...defaultCallData,
                                data: '0xddf363d7',
                                value: '0x3e8'
                            };

                            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                            expect(res).to.eq('0x00000000000000000000000000000000000000000000000000000000000003e8');
                        });

                        // test is pending until fallback workflow to consensus node is removed, because this flow works when calling to consensus
                        xit("011 Should fail when calling msgValue with more value than available balance", async function () {
                            const callData = {
                                ...defaultCallData,
                                data: '0xddf363d7',
                                value: '0x3e80000000'
                            };
                            const errorType = predefined.CONTRACT_REVERT();

                            await expect(relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId)).to.be.rejectedWith(errorType);
                        });

                        it("012 should work for wrong 'from' field", async function () {
                            const callData = {
                                from: "0x0000000000000000000000000000000000000000",
                                to: callerAddress,
                                data: '0x0ec1551d'
                            };

                            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);
                            expect(res).to.eq('0x0000000000000000000000000000000000000000000000000000000000000004');
                        });
                    }
                });
            }
        });
    });

    describe('Contract call reverts', async () => {
        it('Returns revert message for pure methods', async () => {
            const callData = {
                from: '0x' + accounts[0].address,
                to: reverterEvmAddress,
                gas: EthImpl.numberTo0x(30000),
                data: PURE_METHOD_CALL_DATA
            };

            await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], {
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

            await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], {
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
            const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

            // Wait until receipt is available in mirror node
            await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

            const receipt = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [transactionHash], requestId);
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
                    const hash = await relay.sendRawTransaction(signedTx, requestId);
                    hashes.push(hash);

                    // Wait until receipt is available in mirror node
                    await mirrorNode.get(`/contracts/results/${hash}`, requestId);
                }
            });

            for (let i = 0; i < payableMethodsData.length; i++) {
                it(`Payable method ${payableMethodsData[i].method} returns tx object`, async function () {
                    const tx = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [hashes[i]], requestId);
                    expect(tx).to.exist;
                    expect(tx.hash).to.exist;
                    expect(tx.hash).to.eq(hashes[i]);
                });
            }

            // skip this test if using a remote relay since updating the env vars would not affect it
            if (global.relayIsLocal) {
                describe('DEV_MODE = true', async function () {
                    before(async () => {
                        process.env.DEV_MODE = 'true';
                    });

                    after(async () => {
                        process.env.DEV_MODE = 'false';
                    });

                    for (let i = 0; i < payableMethodsData.length; i++) {
                        it(`Payable method ${payableMethodsData[i].method} throws an error`, async function () {
                            await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH, [hashes[i]], {
                                code: -32008,
                                message: payableMethodsData[i].message,
                                data: payableMethodsData[i].errorData
                            }, requestId);
                        });
                    }
                });
            }
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

                    await relay.callFailing(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], {
                        code: -32008,
                        message: pureMethodsData[i].message,
                        data: pureMethodsData[i].errorData
                    }, requestId);
                });
            }
        });
    });

    describe('eth_call with contract that calls precompiles', async () => {
        const TOKEN_NAME = Utils.randomString(10);
        const TOKEN_SYMBOL = Utils.randomString(5);
        const INITIAL_SUPPLY = 100000;
        const IS_TOKEN_ADDRESS_SIGNATURE = '0xbff9834f000000000000000000000000';

        let htsImpl, tokenAddress;

        before(async () => {
            const htsResult = await servicesNode.createHTS({
                tokenName: TOKEN_NAME,
                symbol: TOKEN_SYMBOL,
                treasuryAccountId: accounts[1].accountId.toString(),
                initialSupply: INITIAL_SUPPLY,
                adminPrivateKey: accounts[1].privateKey
            });

            tokenAddress = Utils.idToEvmAddress(htsResult.receipt.tokenId.toString());

            // Deploy a contract implementing HederaTokenService
            const HederaTokenServiceImplFactory = new ethers.ContractFactory(HederaTokenServiceImplJson.abi, HederaTokenServiceImplJson.bytecode, accounts[1].wallet);
            htsImpl = await HederaTokenServiceImplFactory.deploy(Helper.GAS.LIMIT_15_000_000);
        });

        it("Function calling HederaTokenService.isToken(token)", async () => {
            const callData = {
                from: '0x' + accounts[1].address,
                to: htsImpl.address,
                gas: EthImpl.numberTo0x(30000),
                data: IS_TOKEN_ADDRESS_SIGNATURE + tokenAddress.replace('0x', '')
            };

            relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest']);
            const res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, 'latest'], requestId);

            expect(res).to.eq(RESULT_TRUE);
        });
    });
});
