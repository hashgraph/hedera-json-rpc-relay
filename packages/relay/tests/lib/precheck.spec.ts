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
import {MirrorNodeClient, SDKClient} from "../../src/lib/clients";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import constants from '../../src/lib/constants';
const logger = pino();

describe('Precheck', async function() {

    const txWithMatchingChainId = '0x02f87482012a0485a7a358200085a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be40080c001a006f4cd8e6f84b76a05a5c1542a08682c928108ef7163d9c1bf1f3b636b1cd1fba032097cbf2dda17a2dcc40f62c97964d9d930cdce2e8a9df9a8ba023cda28e4ad';
    const txWithNonMatchingChainId = '0xf86a0385a7a3582000832dc6c09400000000000000000000000000000000000003f78502540be400801ca06750e92db52fa708e27f94f27e0cfb7f5800f9b657180bb2e94c1520cfb1fb6da01bec6045068b6db38b55017bb8b50166699384bc1791fd8331febab0cf629a2a';
    const defaultGasPrice = 720_000_000_000;

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
        it('should return true for matching chainId', async function() {
            const result = precheck.chainId(txWithMatchingChainId);
            expect(result).to.exist;
            expect(result.passes).to.eq(true);
            expect(result.chainId).to.eq('0x12a');
        });

        it('should return false for non-matching chainId', async function() {
            const result = precheck.chainId(txWithNonMatchingChainId);
            expect(result).to.exist;
            expect(result.passes).to.eq(false);
            expect(result.chainId).to.eq('0x0');
        });
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
    })
});
