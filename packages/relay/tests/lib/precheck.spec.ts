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
const registry = new Registry();

import sinon from 'sinon';
import pino from 'pino';
import {Precheck} from "../../src/lib/precheck";
import {expectedError, signTransaction} from "../helpers";
import {MirrorNodeClient, SDKClient} from "../../src/lib/clients";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import {ethers} from "ethers";
import constants from '../../src/lib/constants';
const logger = pino();

describe('Precheck', async function() {

    const txWithMatchingChainId = '0x02f87482012a0485a7a358200085a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be40080c001a006f4cd8e6f84b76a05a5c1542a08682c928108ef7163d9c1bf1f3b636b1cd1fba032097cbf2dda17a2dcc40f62c97964d9d930cdce2e8a9df9a8ba023cda28e4ad';
    const txWithNonMatchingChainId = '0xf86a0385a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be400801ca06750e92db52fa708e27f94f27e0cfb7f5800f9b657180bb2e94c1520cfb1fb6da01bec6045068b6db38b55017bb8b50166699384bc1791fd8331febab0cf629a2a';
    const oneTinyBar = ethers.utils.parseUnits('1', 10);
    const defaultGasPrice = 720_000_000_000;
    const defaultChainId = Number('0x12a');

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
        const sdkInstance = sinon.createStubInstance(SDKClient);
        precheck = new Precheck(mirrorNodeInstance, sdkInstance, logger, '0x12a');
    });

    describe('chainId', async function() {
        it('should pass for matching chainId', async function() {
            try {
                precheck.chainId(txWithMatchingChainId);
            }
            catch(e) {
                expect(e).to.not.exist;
            }
        });

        it('should not pass for non-matching chainId', async function() {
            try {
                precheck.chainId(txWithNonMatchingChainId);
                expectedError();
            }
            catch(e: any) {
                expect(e).to.exist;
                expect(e.code).to.eq(-32000);
                expect(e.message).to.eq('ChainId (0x0) not supported. The correct chainId is 0x12a.');
            }
        });
    });

    describe('gasLimit', async function() {
        const defaultTx = {
            value: oneTinyBar,
            gasPrice: defaultGasPrice,
            chainId: defaultChainId
        };

        function testFailingGasLimitPrecheck(gasLimits, errorCode, errorMessage) {
            for (const gasLimit of gasLimits) {
                it(`should fail for gasLimit: ${gasLimit}`, async function () {
                    const tx = {
                        ...defaultTx,
                        gasLimit: gasLimit
                    };
                    const signed = await signTransaction(tx);

                    try {
                        await precheck.gasLimit(signed);
                        expectedError();
                    } catch (e: any) {
                        expect(e).to.exist;
                        expect(e.code).to.eq(errorCode);
                        expect(e.message).to.eq(errorMessage);
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

                    try {
                        await precheck.gasLimit(signed);
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
        testFailingGasLimitPrecheck(lowGasLimits, -32003, 'Intrinsic gas exceeds gas limit');
        testFailingGasLimitPrecheck(highGasLimits, -32005, 'Transaction gas limit exceeds block gas limit');
    });

    describe('gas price', async function() {
        it('should return true for gas price gt to required gas price', async function() {
            const result = precheck.gasPrice(txWithMatchingChainId, 10);
            expect(result).to.exist;
            expect(result.error).to.exist;
            expect(result.passes).to.eq(true);
        });

        it('should return true for gas price equal to required gas price', async function() {
            const result = precheck.gasPrice(txWithMatchingChainId, defaultGasPrice);
            expect(result).to.exist;
            expect(result.error).to.exist;
            expect(result.passes).to.eq(true);
        });

        it('should return false for gas price not enough', async function() {
            const minGasPrice = 1000 * constants.TINYBAR_TO_WEIBAR_COEF;
            const result = precheck.gasPrice(txWithMatchingChainId, minGasPrice);
            expect(result).to.exist;
            expect(result.error).to.exist;
            expect(result.passes).to.eq(false);
        });
    });
});
