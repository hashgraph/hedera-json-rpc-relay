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
import { Registry } from 'prom-client';
import { Hbar, HbarUnit } from '@hashgraph/sdk';
const registry = new Registry();

import sinon from 'sinon';
import pino from 'pino';
import { Precheck } from "../../src/lib/precheck";
import { expectedError, mockData, signTransaction } from "../helpers";
import { MirrorNodeClient, SDKClient } from "../../src/lib/clients";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { ethers } from "ethers";
import constants from '../../src/lib/constants';
import { predefined } from '../../src';
import HAPIService from '../../src/lib/services/hapiService/hapiService';
import HbarLimit from '../../src/lib/hbarlimiter';
const logger = pino();

describe('Precheck', async function() {

    const txWithMatchingChainId = '0x02f87482012a0485a7a358200085a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be40080c001a006f4cd8e6f84b76a05a5c1542a08682c928108ef7163d9c1bf1f3b636b1cd1fba032097cbf2dda17a2dcc40f62c97964d9d930cdce2e8a9df9a8ba023cda28e4ad';
    const parsedTxWithMatchingChainId = ethers.utils.parseTransaction(txWithMatchingChainId);
    const parsedTxGasPrice = 1440000000000;
    const txWithNonMatchingChainId = '0xf86a0385a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be400801ca06750e92db52fa708e27f94f27e0cfb7f5800f9b657180bb2e94c1520cfb1fb6da01bec6045068b6db38b55017bb8b50166699384bc1791fd8331febab0cf629a2a';
    const parsedTxWithNonMatchingChainId = ethers.utils.parseTransaction(txWithNonMatchingChainId);
    const txWithValueMoreThanOneTinyBar = '0xf8628080809449858d4445908c12fcf70251d3f4682e8c9c381085174876e800801ba015ec73d3e329c7f5c0228be39bf30758f974d69468847dd507082c89ec453fe2a04124cc1dd6ac07417e7cdbe04cb99d698bddc6ce4d04054dd8978dec3493f3d2';
    const parsedTxWithValueMoreThanOneTinyBar = ethers.utils.parseTransaction(txWithValueMoreThanOneTinyBar);
    const txWithValueLessThanOneTinybar = '0xf8618080809449858d4445908c12fcf70251d3f4682e8c9c38108405f5e100801ba08249a7664c9290e6896711059d2ab75b10675b8b2ef7da41f4dd94c99f16f587a00110bc057ae0837da17a6f31f5123977f820921e333cb75fbe342583d278327d';
    const parsedTxWithValueLessThanOneTinybar = ethers.utils.parseTransaction(txWithValueLessThanOneTinybar);
    const txWithValueLessThanOneTinybarAndNotEmptyData = '0xf8638080809449858d4445908c12fcf70251d3f4682e8c9c3810830186a0831231231ba0d8d47f572b49be8da9866e1979ea8fb8060f885119aff9d457a77be088f03545a00c9c1266548930924f5f8c11854bcc369bda1449d203c86a15840759b61cdffe';
    const parsedTxWithValueLessThanOneTinybarAndNotEmptyData = ethers.utils.parseTransaction(txWithValueLessThanOneTinybarAndNotEmptyData);
    const oneTinyBar = ethers.utils.parseUnits('1', 10);
    const defaultGasPrice = 720_000_000_000;
    const defaultChainId = Number('0x12a');
    let sdkInstance;
    let hapiServiceInstance: HAPIService;
    let precheck: Precheck;
    let mock: MockAdapter;

    this.beforeAll(() => {
        // mock axios
        const instance = axios.create({
            baseURL: 'https://localhost:5551/api/v1',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10 * 1000
        });

        // @ts-ignore
        mock = new MockAdapter(instance, { onNoMatch: "throwException" });

        // @ts-ignore
        const mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, instance);

        const duration = constants.HBAR_RATE_LIMIT_DURATION;
        const total = constants.HBAR_RATE_LIMIT_TINYBAR;
        const hbarLimiter = new HbarLimit(logger.child({ name: 'hbar-rate-limit' }), Date.now(), total, duration, registry);
        hapiServiceInstance = new HAPIService(logger, registry, hbarLimiter);
        sdkInstance = sinon.createStubInstance(SDKClient);
        sinon.stub(hapiServiceInstance, "getSDKClient").returns(sdkInstance);
        precheck = new Precheck(mirrorNodeInstance, hapiServiceInstance, logger, '0x12a');
    });

    this.beforeEach(() => {
        // reset mock
        mock.reset();
    });

    describe('value', async function() {
        it('should throw an exception if value is less than 1 tinybar', async function() {
            let hasError = false;
            try {
                precheck.value(parsedTxWithValueLessThanOneTinybar);
            } catch (e) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32602);
                expect(e.message).to.eq('Value below 10_000_000_000 wei which is 1 tinybar');
                hasError = true;
            }

            expect(hasError).to.be.true;
        });

        it('should pass if value is more than 1 tinybar', async function() {
            try {
                precheck.value(parsedTxWithValueMoreThanOneTinyBar);
            } catch (e) {
                expect(e).to.not.exist;
            }
        });

        it('should pass if value is less than 1 tinybar and data is not empty', async function() {
            try {
                precheck.value(parsedTxWithValueLessThanOneTinybarAndNotEmptyData);
            } catch (e: any) {
                expect(e).to.not.exist;
            }
        });
    });

    describe('chainId', async function() {
        it('should pass for matching chainId', async function() {
            try {
                precheck.chainId(parsedTxWithMatchingChainId);
            }
            catch(e: any) {
                expect(e).to.not.exist;
            }
        });

        it('should not pass for non-matching chainId', async function() {
            try {
                precheck.chainId(parsedTxWithNonMatchingChainId);
                expectedError();
            }
            catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32000);
                expect(e.message).to.eq('ChainId (0x0) not supported. The correct chainId is 0x12a');
            }
        });
    });

    describe('gasLimit', async function() {
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId
        };

        function testFailingGasLimitPrecheck(gasLimits, errorCode) {
            for (const gasLimit of gasLimits) {
                it(`should fail for gasLimit: ${gasLimit}`, async function () {
                    const tx = {
                        ...defaultTx,
                        gasLimit: gasLimit
                    };
                    const signed = await signTransaction(tx);
                    const parsedTx = ethers.utils.parseTransaction(signed);
                    const message =  gasLimit > constants.BLOCK_GAS_LIMIT ? 
                        `Transaction gas limit '${gasLimit}' exceeds block gas limit '${constants.BLOCK_GAS_LIMIT}'` :
                        `Transaction gas limit provided '${gasLimit}' is insufficient of intrinsic gas required `;
                    try {
                        await precheck.gasLimit(parsedTx);
                        expectedError();
                    } catch (e: any) {
                        expect(e).to.exist;
                        expect(e.code).to.eq(errorCode);
                        expect(e.message).to.contain(message);
                    }
                });
            }
        }

        function testPassingGasLimitPrecheck(gasLimits) {
            for (const gasLimit of gasLimits) {
                it(`should pass for gasLimit: ${gasLimit}`, async function () {
                    const tx = {
                        ...defaultTx,
                        gasLimit: gasLimit
                    };
                    const signed = await signTransaction(tx);
                    const parsedTx = ethers.utils.parseTransaction(signed);

                    try {
                        await precheck.gasLimit(parsedTx);
                    } catch (e: any) {
                        expect(e).to.not.exist;
                    }
                });
            }
        }

        const validGasLimits = [60000, 100000, 500000, 1000000, 5000000, 10000000];
        const lowGasLimits = [1, 10, 100, 1000, 10000, 30000, 50000];
        const highGasLimits = [20000000, 100000000, 999999999999];

        testPassingGasLimitPrecheck(validGasLimits);
        testFailingGasLimitPrecheck(lowGasLimits, -32003);
        testFailingGasLimitPrecheck(highGasLimits, -32005);
    });

    describe('gas price', async function() {
        let initialMinGasPriceBuffer;
        before(async () =>{
            initialMinGasPriceBuffer = constants.GAS_PRICE_TINY_BAR_BUFFER;
            process.env.GAS_PRICE_TINY_BAR_BUFFER = '10000000000'; // 1 tinybar
        })

        after(async () =>{
            process.env.GAS_PRICE_TINY_BAR_BUFFER = initialMinGasPriceBuffer;
        })

        it('should pass for gas price gt to required gas price', async function() {
            const result = precheck.gasPrice(parsedTxWithMatchingChainId, 10);
            expect(result).to.not.exist;
        });

        it('should pass for gas price equal to required gas price', async function() {
            const result = precheck.gasPrice(parsedTxWithMatchingChainId, defaultGasPrice);
            expect(result).to.not.exist;
        });

        it('should not pass for gas price not enough', async function() {
            const minGasPrice = 1000 * constants.TINYBAR_TO_WEIBAR_COEF;
            try {
                precheck.gasPrice(parsedTxWithMatchingChainId, minGasPrice);
                expectedError();
            } catch (e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32009);
                expect(e.message).to.contains(`Gas price `);
                expect(e.message).to.contains(` is below configured minimum gas price '${minGasPrice}`);
            }
        });

        it('should pass for gas price not enough but within buffer', async function() {
            const adjustedGasPrice = parsedTxGasPrice + Number(constants.GAS_PRICE_TINY_BAR_BUFFER);
            precheck.gasPrice(parsedTxWithMatchingChainId, adjustedGasPrice);
        });
    });

    describe('balance', async function() {
        // sending 2 hbars
        const transaction = '0x02f876820128078459682f0086018a4c7747008252089443cb701defe8fc6ed04d7bddf949618e3c575fe1881bc16d674ec8000080c001a0b8c604e08c15a7acc8c898a1bbcc41befcd0d120b64041d1086381c7fc2a5339a062eabec286592a7283c90ce90d97f9f8cf9f6c0cef4998022660e7573c046a46';
        const parsedTransaction = ethers.utils.parseTransaction(transaction);
        const mirrorAccountsPath = 'accounts/0xF8A44f9a4E4c452D25F5aE0F5d7970Ac9522a3C8';
        const accountId = '0.1.2';

        it('should not pass for 1 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });

            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(1, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            try {
                await precheck.balance(parsedTransaction, 'sendRawTransaction');
                expectedError();
            } catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32000);
                expect(e.message).to.eq('Insufficient funds for transfer');
            }
        });

        it('should not pass for no account found', async function() {
            mock.onGet(mirrorAccountsPath).reply(404, {
                "_status": {
                    "messages": [
                        {
                            "message": "Not found"
                        }
                    ]
                }
            });

            try {
                await precheck.balance(parsedTransaction, 'sendRawTransaction');
                expectedError();
            } catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32001);
                expect(e.message).to.contain('Requested resource not found');
            }
        });

        it('should pass for 10 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });
            
            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(10, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            const result = await precheck.balance(parsedTransaction, 'sendRawTransaction');
            expect(result).to.not.exist;
        });

        it('should pass for 100 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });
            
            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(100, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            const result = await precheck.balance(parsedTransaction, 'sendRawTransaction');
            expect(result).to.not.exist;
        });

        it('should pass for 10000 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });
            
            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(10_000, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            const result = await precheck.balance(parsedTransaction, 'sendRawTransaction');
            expect(result).to.not.exist;
        });

        it('should pass for 100000 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });
            
            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(100_000, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            const result = await precheck.balance(parsedTransaction, 'sendRawTransaction');
            expect(result).to.not.exist;
        });

        it('should pass for 50_000_000_000 hbar', async function() {
            mock.onGet(mirrorAccountsPath).reply(200, {
                account: accountId
            });
            
            sdkInstance.getAccountBalanceInTinyBar.returns(Hbar.from(50_000_000_000, HbarUnit.Hbar).to(HbarUnit.Tinybar));
            const result = await precheck.balance(parsedTransaction, 'sendRawTransaction');
            expect(result).to.not.exist;
        });
    });

    describe('nonce', async function() {
        const defaultNonce = 3;
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId,
            nonce: defaultNonce
        };

        const mirrorAccount = {
            ethereum_nonce: defaultNonce
        };

        it(`should fail for low nonce`, async function () {
            const tx = {
                ...defaultTx,
                nonce: 1
            };
            const signed = await signTransaction(tx);
            const parsedTx = ethers.utils.parseTransaction(signed);

            mock.onGet(`accounts/${parsedTx.from}`).reply(200, mirrorAccount);


            try {
                await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
                expectedError();
            } catch (e: any) {
                expect(e).to.eql(predefined.NONCE_TOO_LOW(parsedTx.nonce, mirrorAccount.ethereum_nonce));
            }
        });

        it(`should not fail for next nonce`, async function () {
            const tx = {
                ...defaultTx,
                nonce: 4
            };
            const signed = await signTransaction(tx);
            const parsedTx = ethers.utils.parseTransaction(signed);

            mock.onGet(`accounts/${parsedTx.from}`).reply(200, mirrorAccount);

            await precheck.nonce(parsedTx, mirrorAccount.ethereum_nonce);
        });
    });

    describe('account', async function() {
        const defaultNonce = 3;
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId,
            nonce: defaultNonce,
            from: mockData.accountEvmAddress
        };

        const signed = await signTransaction(defaultTx);
        const parsedTx = ethers.utils.parseTransaction(signed);

        const mirrorAccount = {
            evm_address: mockData.accountEvmAddress,
            ethereum_nonce: defaultNonce
        };

        it(`should fail for missing account`, async function () {
            mock.onGet(`accounts/${mockData.accountEvmAddress}`).reply(404, mockData.notFound);


            try {
                await precheck.verifyAccount(parsedTx);
                expectedError();
            } catch (e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32001);
                expect(e.name).to.eq('Resource not found');
                expect(e.message).to.contain(mockData.accountEvmAddress);
            }
        });

        it(`should not fail for matched account`, async function () {
            mock.onGet(`accounts/${mockData.accountEvmAddress}`).reply(200, mirrorAccount);
            const account = await precheck.verifyAccount(parsedTx);


            expect(account.ethereum_nonce).to.eq(defaultNonce);
        });
    });
});
