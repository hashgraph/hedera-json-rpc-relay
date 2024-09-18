/*-
 *
 * Test e2e: Hedera Waffle Project
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import { expect, use } from 'chai';
import dotenv from 'dotenv';
import { providers, Wallet, ContractFactory } from 'ethers';
import { createFixtureLoader } from 'ethereum-waffle';

import IERC20Contract from '../build/IERC20.json' assert { type: "json" };

dotenv.config();
const { JsonRpcProvider } = providers;


const usdcAddress = '0x0000000000000000000000000000000000068cDa';
const alice = '0x4D1c823b5f15bE83FDf5adAF137c2a9e0E78fE15';
const bob = '0x0000000000000000000000000000000000000887';
const initialAliceBalance = 49_300000;
describe('RPC', () => {
    let loadFixture;
    let fixture;
    let wallet;

    beforeEach(async () => {
        const provider = new JsonRpcProvider(process.env.RELAY_ENDPOINT);
        wallet = new Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
        loadFixture = createFixtureLoader([wallet]);
        fixture = ([wallet]) => ContractFactory.getContract(usdcAddress, IERC20Contract.abi, wallet);
    });

    it('should have initial balance', async () => {
        const contract = await loadFixture(fixture);
        expect(await contract.balanceOf([alice])).to.equal(initialAliceBalance);
        await contract.transfer([alice, initialAliceBalance]); // We transfer everything out.
        expect(await contract.balanceOf([bob])).to.equal(0);
    });

    it('should have initial balance again!', async () => {
        const contract = await loadFixture(fixture);
        expect(await contract.balanceOf([alice])).to.equal(initialAliceBalance);
    });
});
