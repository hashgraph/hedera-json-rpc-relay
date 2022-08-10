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
import { solidity } from 'ethereum-waffle';
import chai, { expect } from 'chai';

chai.use(solidity);

import { AliasAccount } from '../clients/servicesClient';
import { ethers, BigNumber } from 'ethers';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import BaseHTSJson from '../contracts/BaseHTS.json';


describe('HTS Precompile Acceptance Tests', async function() {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, relay } = global;

  const accounts: AliasAccount[] = [];
  let baseHTSContract;
  let HTSTokenContract;

  before(async () => {
    accounts[0] = await servicesNode.createAliasAccount(40, relay.provider);
    accounts[1] = await servicesNode.createAliasAccount(10, relay.provider);
    accounts[2] = await servicesNode.createAliasAccount(10, relay.provider);

    baseHTSContract = await deployBaseHTSContract();
    HTSTokenContract = await createHTSToken();
  });

  async function deployBaseHTSContract() {
    const baseHTSFactory = new ethers.ContractFactory(BaseHTSJson.abi, BaseHTSJson.bytecode, accounts[0].wallet);
    const baseHTS = await baseHTSFactory.deploy();
    const { contractAddress } = await baseHTS.deployTransaction.wait();

    return new ethers.Contract(contractAddress, BaseHTSJson.abi, accounts[0].wallet);
  }

  async function createHTSToken() {
    const tx = await baseHTSContract.createToken(accounts[0].wallet.address, {
      value: ethers.BigNumber.from('20000000000000000000'),
      gasLimit: 1000000
    });
    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

    return new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
  }

  it('should associate to a token', async function() {
    const baseHTSContractReceiverWalletFirst = new ethers.Contract(baseHTSContract.address, BaseHTSJson.abi, accounts[1].wallet);
    expect(baseHTSContractReceiverWalletFirst.associateTokenTo(accounts[1].wallet.address, HTSTokenContract.address, { gasLimit: 10000000 }))
      .to.not.be.reverted;

    const baseHTSContractReceiverWalletSecond = new ethers.Contract(baseHTSContract.address, BaseHTSJson.abi, accounts[2].wallet);
    expect(baseHTSContractReceiverWalletSecond.associateTokenTo(accounts[2].wallet.address, HTSTokenContract.address, { gasLimit: 10000000 }))
      .to.not.be.reverted;
  });

  it('should check initial balances', async function() {
    expect(await HTSTokenContract.balanceOf(accounts[0].wallet.address)).to.equal(1000);
    expect(await HTSTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(0);
    expect(await HTSTokenContract.balanceOf(accounts[2].wallet.address)).to.equal(0);
  });

  it('should be able to transfer hts tokens between accounts', async function() {
    const amount = 10;
    const balanceBefore = await HTSTokenContract.balanceOf(accounts[1].wallet.address);

    await baseHTSContract.transferTokenTo(accounts[1].wallet.address, HTSTokenContract.address, amount);

    const balanceAfter = await HTSTokenContract.balanceOf(accounts[1].wallet.address);
    expect(balanceBefore + amount).to.equal(balanceAfter);
  });
});
