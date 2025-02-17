// SPDX-License-Identifier: Apache-2.0

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
