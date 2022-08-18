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
import { ethers } from 'ethers';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import BaseHTSJson from '../contracts/BaseHTS.json';


describe('HTS Precompile Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, relay } = global;

  const TX_SUCCESS_CODE = 22;
  const TOKEN_NAME = 'tokenName';
  const TOKEN_SYMBOL = 'tokenSymbol';
  const TOKEN_MAX_SUPPLY = 1000;
  const TOKEN_DECIMALS = 8;

  const accounts: AliasAccount[] = [];
  let BaseHTSContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let NftSerialNumber;

  this.beforeAll(async () => {
    accounts[0] = await servicesNode.createAliasAccount(60, relay.provider);
    accounts[1] = await servicesNode.createAliasAccount(30, relay.provider);
    accounts[2] = await servicesNode.createAliasAccount(30, relay.provider);

    // alow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));
    
    BaseHTSContractAddress = await deployBaseHTSContract();
    HTSTokenContractAddress = await createHTSToken();
    NftHTSTokenContractAddress = await createNftHTSToken();
  });

  async function deployBaseHTSContract() {
    const baseHTSFactory = new ethers.ContractFactory(BaseHTSJson.abi, BaseHTSJson.bytecode, accounts[0].wallet);
    const baseHTS = await baseHTSFactory.deploy({gasLimit: 10000000});
    const { contractAddress } = await baseHTS.deployTransaction.wait();

    return contractAddress;
  }

  async function createHTSToken() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: ethers.BigNumber.from('10000000000000000000'),
      gasLimit: 10000000
    });
    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

    return tokenAddress;
  }

  async function createNftHTSToken() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
      value: ethers.BigNumber.from('10000000000000000000'),
      gasLimit: 10000000
    });
    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

    return tokenAddress;
  }

  it('should associate to a token', async function() {
    const baseHTSContractOwner = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);

    const baseHTSContractReceiverWalletFirst = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[1].wallet);
    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);

    const baseHTSContractReceiverWalletSecond = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[2].wallet);
    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);
  });

  it('should associate to a nft', async function() {
    const baseHTSContractOwner = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);

    const baseHTSContractReceiverWalletFirst = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[1].wallet);
    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);

    const baseHTSContractReceiverWalletSecond = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[2].wallet);
    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(22);
  });

  it('should check initial balances', async function() {
    const HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    expect(await HTSTokenContract.balanceOf(accounts[0].wallet.address)).to.equal(1000);
    expect(await HTSTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(0);
    expect(await HTSTokenContract.balanceOf(accounts[2].wallet.address)).to.equal(0);
  });

  it('should be able to transfer hts tokens between accounts', async function () {
    const amount = 10;
    const HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const balanceBefore = await HTSTokenContract.balanceOf(accounts[1].wallet.address);
    await baseHTSContract.transferTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, amount);
    const balanceAfter = await HTSTokenContract.balanceOf(accounts[1].wallet.address);

    expect(balanceBefore + amount).to.equal(balanceAfter);
  });

  it('should be able to approve anyone to spend tokens', async function() {
    const amount = 13;
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const txBefore = await baseHTSContract.allowancePublic(HTSTokenContractAddress, BaseHTSContractAddress, accounts[2].wallet.address);
    const txBeforeReceipt = await txBefore.wait();
    const beforeAmount = txBeforeReceipt.events.filter(e => e.event === 'AllowanceValue')[0].args.amount.toNumber();
    const { responseCode } = txBeforeReceipt.events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    await baseHTSContract.approvePublic(HTSTokenContractAddress, accounts[2].wallet.address, amount, { gasLimit: 1_000_000 });

    const txAfter = await baseHTSContract.allowancePublic(HTSTokenContractAddress, BaseHTSContractAddress, accounts[2].wallet.address);
    const afterAmount = (await txAfter.wait()).events.filter(e => e.event === 'AllowanceValue')[0].args.amount.toNumber();

    expect(beforeAmount).to.equal(0);
    expect(afterAmount).to.equal(amount);
  });

  // Depends on https://github.com/hashgraph/hedera-services/pull/3798
  xit('should be able to execute setApprovalForAllPublic', async function() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const txBefore = (await baseHTSContract.isApprovedForAllPublic(NftHTSTokenContractAddress, BaseHTSContractAddress, accounts[1].wallet.address));
    const txBeforeReceipt = await txBefore.wait();
    const beforeFlag = txBeforeReceipt.events.filter(e => e.event === 'Approved')[0].args.approved;
    const responseCodeTxBefore = txBeforeReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
    expect(responseCodeTxBefore).to.equal(TX_SUCCESS_CODE);

    const tx = await baseHTSContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, true, { gasLimit: 5_000_000 });
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const txAfter = (await baseHTSContract.isApprovedForAllPublic(NftHTSTokenContractAddress, BaseHTSContractAddress, accounts[1].wallet.address));
    const afterFlag = (await txAfter.wait()).events.filter(e => e.event === 'Approved')[0].args.approved;

    expect(beforeFlag).to.equal(false);
    expect(afterFlag).to.equal(true);
  });

  it('should be able to get fungible token info', async () => {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const tx = await baseHTSContract.getFungibleTokenInfoPublic(HTSTokenContractAddress);

    const { tokenInfo, decimals } = (await tx.wait()).events.filter(e => e.event === 'FungibleTokenInfo')[0].args.tokenInfo;

    expect(tokenInfo.totalSupply.toNumber()).to.equal(TOKEN_MAX_SUPPLY);
    expect(decimals).to.equal(TOKEN_DECIMALS);
    expect(tokenInfo.token.maxSupply).to.equal(TOKEN_MAX_SUPPLY);
    expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
    expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
  });

  it('should be able to get token info', async () => {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const tx = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);

    const { token, totalSupply } = (await tx.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

    expect(totalSupply.toNumber()).to.equal(TOKEN_MAX_SUPPLY);
    expect(token.maxSupply).to.equal(TOKEN_MAX_SUPPLY);
    expect(token.name).to.equal(TOKEN_NAME);
    expect(token.symbol).to.equal(TOKEN_SYMBOL);
  });

  it('should be able to mint a nft', async function() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const tx = await baseHTSContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x01'], { gasLimit: 5_000_000 });
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const { serialNumbers } = (await tx.wait()).events.filter(e => e.event === 'MintedToken')[0].args;
    expect(serialNumbers[0].toNumber()).to.be.greaterThan(0);
    NftSerialNumber = serialNumbers[0];
  });

  it('should be able to execute getApproved on nft', async function() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[1].wallet);

    const tx = await baseHTSContract.getApprovedPublic(NftHTSTokenContractAddress, NftSerialNumber, { gasLimit: 5_000_000 });
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const { approved } = (await tx.wait()).events.filter(e => e.event === 'ApprovedAddress')[0].args;
    expect(approved).to.equal('0x0000000000000000000000000000000000000000');
  });

  it('should be able to get non-fungible token info', async () => {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(NftHTSTokenContractAddress, NftSerialNumber);

    const { tokenInfo, serialNumber } = (await tx.wait()).events.filter(e => e.event === 'NonFungibleTokenInfo')[0].args.tokenInfo;

    expect(tokenInfo.totalSupply.toNumber()).to.equal(NftSerialNumber);
    expect(serialNumber).to.equal(NftSerialNumber);
    expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
    expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
  });
});
