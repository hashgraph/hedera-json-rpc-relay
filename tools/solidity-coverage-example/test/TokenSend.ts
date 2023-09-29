/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('TokenSend', function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployTokenSendFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const TokenSend = await ethers.getContractFactory('TokenSend');
    const contract = await TokenSend.deploy();

    return { contract, owner, otherAccount };
  }
  const AMOUNT = 10;

  describe('Amount', function () {
    it('Should return the right amount', async function () {
      const { contract } = await loadFixture(deployTokenSendFixture);
      await contract.storeAmount(AMOUNT);
      const current = await contract.getAmount();

      expect(current).to.be.equal(AMOUNT);
    });
  });

  describe('Transfer', function () {
    it('Should transfer the funds to the owner', async function () {
      const { contract, owner } = await loadFixture(deployTokenSendFixture);
      await expect(await contract.loadFunds(AMOUNT)).to.changeTokenBalance(contract.tokenId, owner, AMOUNT);
    });
  });
});
