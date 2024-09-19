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
import { providers, Wallet, ContractFactory, ethers } from 'ethers';
import { createFixtureLoader } from 'ethereum-waffle';

import IERC20Contract from '../build/IERC20.json' assert { type: "json" };

dotenv.config();
const { JsonRpcProvider } = providers;

const usdcAddress = process.env.ERC20_TOKEN_ADDRESS;
const bob = '0x0000000000000000000000000000000000000887';

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
        expect((await contract.balanceOf(wallet.address)).toNumber()).to.not.equal(
          0,
          `Please use an account with a non-zero ${usdcAddress} token balance for this test to function correctly.`
        );
        const currentBalance = await contract.balanceOf(wallet.address);
        await contract.transfer(bob, currentBalance.toNumber()); // We transfer everything out.
        expect((await contract.balanceOf(wallet.address)).toNumber()).to.equal(0);
    });

    it('should have some initial balance again!', async () => {
        const contract = await loadFixture(fixture);
        expect((await contract.balanceOf(wallet.address)).toNumber()).to.not.equal(0);
    });
});
