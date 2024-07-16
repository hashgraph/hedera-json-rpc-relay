/*-
 *
 * Hedera Waffle Project
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
import { providers, Wallet } from 'ethers';
import { createFixtureLoader, deployContract, solidity } from 'ethereum-waffle';

import SampleContract from '../build/SampleContract.json' assert { type: "json" };

dotenv.config();
const { JsonRpcProvider } = providers;

const provider = new JsonRpcProvider(process.env.RELAY_ENDPOINT);
const wallet = new Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
const loadFixture = createFixtureLoader([wallet]);
const fixture = ([wallet]) => deployContract(wallet, SampleContract);

use(solidity); // use mocha matchers

describe('RPC', () => {

    it('should emit event', async () => {
        const contract = await loadFixture(fixture);
        await expect(contract.emitEvent())
            .to.emit(contract, 'Notification')
            .withArgs("Hello world!");
    });

    it('should be reverted', async () => {
        const contract = await loadFixture(fixture);
        await expect(contract.revertableFunction()).to.be.reverted;
    });
});
