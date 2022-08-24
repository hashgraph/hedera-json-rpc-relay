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
import Assertions from '../helpers/assertions';
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
  let HTSTokenContract;
  let baseHTSContract;
  let baseHTSContractOwner;
  let baseHTSContractReceiverWalletFirst;
  let baseHTSContractReceiverWalletSecond;
  let HTSTokenWithCustomFeesContractAddress;

  this.beforeAll(async () => {
    accounts[0] = await servicesNode.createAliasAccount(160, relay.provider);
    accounts[1] = await servicesNode.createAliasAccount(30, relay.provider);
    accounts[2] = await servicesNode.createAliasAccount(30, relay.provider);

    // alow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));

    BaseHTSContractAddress = await deployBaseHTSContract();
    HTSTokenContractAddress = await createHTSToken();
    NftHTSTokenContractAddress = await createNftHTSToken();
    HTSTokenWithCustomFeesContractAddress = await createHTSTokenWithCustomFees();

    HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    baseHTSContractOwner = baseHTSContract;
    baseHTSContractReceiverWalletFirst = baseHTSContract.connect(accounts[1].wallet);
    baseHTSContractReceiverWalletSecond = baseHTSContract.connect(accounts[2].wallet);
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

  async function createHTSTokenWithCustomFees() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createFungibleTokenWithCustomFeesPublic(accounts[0].wallet.address, HTSTokenContractAddress, {
      value: ethers.BigNumber.from('20000000000000000000'),
      gasLimit: 10_000_000
    });
    const txReceipt = await tx.wait();
    const { tokenAddress } = txReceipt.events.filter(e => e.event === 'CreatedToken')[0].args;

    return tokenAddress;
  }

  it('should associate to a token', async function() {
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  it('should associate to a nft', async function() {
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  it('should associate to a token with custom fees', async function() {
    const baseHTSContractOwner = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const baseHTSContractReceiverWalletFirst = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[1].wallet);
    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const baseHTSContractReceiverWalletSecond = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[2].wallet);
    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  it('should check initial balances', async function() {
    expect(await HTSTokenContract.balanceOf(accounts[0].wallet.address)).to.equal(1000);
    expect(await HTSTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(0);
    expect(await HTSTokenContract.balanceOf(accounts[2].wallet.address)).to.equal(0);
  });

  it('should be able to transfer hts tokens between accounts', async function () {
    const amount = 10;

    const balanceBefore = await HTSTokenContract.balanceOf(accounts[1].wallet.address);
    await baseHTSContract.transferTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, amount);
    const balanceAfter = await HTSTokenContract.balanceOf(accounts[1].wallet.address);

    expect(balanceBefore + amount).to.equal(balanceAfter);
  });

  it('should be able to approve anyone to spend tokens', async function() {
    const amount = 13;

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
    const tx = await baseHTSContract.getFungibleTokenInfoPublic(HTSTokenContractAddress);

    const { tokenInfo, decimals } = (await tx.wait()).events.filter(e => e.event === 'FungibleTokenInfo')[0].args.tokenInfo;

    expect(tokenInfo.totalSupply.toNumber()).to.equal(TOKEN_MAX_SUPPLY);
    expect(decimals).to.equal(TOKEN_DECIMALS);
    expect(tokenInfo.token.maxSupply).to.equal(TOKEN_MAX_SUPPLY);
    expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
    expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
  });

  it('should be able to get token info', async () => {
    const tx = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);

    const { token, totalSupply } = (await tx.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

    expect(totalSupply.toNumber()).to.equal(TOKEN_MAX_SUPPLY);
    expect(token.maxSupply).to.equal(TOKEN_MAX_SUPPLY);
    expect(token.name).to.equal(TOKEN_NAME);
    expect(token.symbol).to.equal(TOKEN_SYMBOL);
  });

  it('should be able to mint a nft', async function() {
    const tx = await baseHTSContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x01'], { gasLimit: 5_000_000 });
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const { serialNumbers } = (await tx.wait()).events.filter(e => e.event === 'MintedToken')[0].args;
    expect(serialNumbers[0].toNumber()).to.be.greaterThan(0);
    NftSerialNumber = serialNumbers[0];
  });

  it('should be able to execute getApproved on nft', async function() {
    const tx = await baseHTSContractReceiverWalletFirst.getApprovedPublic(NftHTSTokenContractAddress, NftSerialNumber, { gasLimit: 5_000_000 });
    const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const { approved } = (await tx.wait()).events.filter(e => e.event === 'ApprovedAddress')[0].args;
    expect(approved).to.equal('0x0000000000000000000000000000000000000000');
  });

  it('should be able to get non-fungible token info', async () => {
    const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(NftHTSTokenContractAddress, NftSerialNumber);

    const { tokenInfo, serialNumber } = (await tx.wait()).events.filter(e => e.event === 'NonFungibleTokenInfo')[0].args.tokenInfo;

    expect(tokenInfo.totalSupply.toNumber()).to.equal(NftSerialNumber);
    expect(serialNumber).to.equal(NftSerialNumber);
    expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
    expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
  });

  describe('HTS Precompile Freeze/Unfreeze Tests', async function() {
    async function checkTokenFrozen(contractOwner, tokenAddress, expectedValue: boolean) {
      const txBefore = await contractOwner.isFrozenPublic(tokenAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const txBeforeReceipt = await txBefore.wait();
      const responseCodeBefore = txBeforeReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const isFrozenBefore = txBeforeReceipt.events.filter(e => e.event === 'Frozen')[0].args.frozen;

      expect(responseCodeBefore).to.equal(TX_SUCCESS_CODE);
      expect(isFrozenBefore).to.be.equal(expectedValue);
    }

    async function checkTokenDefaultFreezeStatus(contractOwner, tokenAddress, expectedValue: boolean) {
      const txTokenDefaultStatus = await contractOwner.getTokenDefaultFreezeStatusPublic(tokenAddress, { gasLimit: 1_000_000 });
      const responseCodeTokenDefaultStatus = (await txTokenDefaultStatus.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const defaultTokenFreezeStatus = (await txTokenDefaultStatus.wait()).events.filter(e => e.event === 'TokenDefaultFreezeStatus')[0].args.defaultFreezeStatus;
      expect(responseCodeTokenDefaultStatus).to.equal(TX_SUCCESS_CODE);
      expect(defaultTokenFreezeStatus).to.equal(expectedValue);
    }

    it('should be able to freeze and unfreeze fungible token transfers', async function() {
      // expect the token to not be frozen
      await checkTokenFrozen(baseHTSContractOwner, HTSTokenContractAddress, false);

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(baseHTSContractOwner, HTSTokenContractAddress, false);

      // freeze token
      const freezeTx = await baseHTSContractOwner.freezeTokenPublic(HTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeFreeze = (await freezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeFreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to be frozen
      await checkTokenFrozen(baseHTSContractOwner, HTSTokenContractAddress, true);

      // unfreeze token
      const unfreezeTx = await baseHTSContractOwner.unfreezeTokenPublic(HTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeUnfreeze = (await unfreezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeUnfreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to not be frozen
      await checkTokenFrozen(baseHTSContractOwner, HTSTokenContractAddress, false);
    });

    it('should be able to freeze and unfreeze non-fungible token transfers', async function() {
      // expect the token to not be frozen
      await checkTokenFrozen(baseHTSContractOwner, NftHTSTokenContractAddress, false);

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(baseHTSContractOwner, NftHTSTokenContractAddress, false);

      // freeze token
      const freezeTx = await baseHTSContractOwner.freezeTokenPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeFreeze = (await freezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeFreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to be frozen
      await checkTokenFrozen(baseHTSContractOwner, NftHTSTokenContractAddress, true);

      // unfreeze token
      const unfreezeTx = await baseHTSContractOwner.unfreezeTokenPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeUnfreeze = (await unfreezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeUnfreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to not be frozen
      await checkTokenFrozen(baseHTSContractOwner, NftHTSTokenContractAddress, false);
    });

    it('should create fungible token with default freeze status true', async function() {
      // change default freeze status
      const txSetDefaultFreezeStatus = await baseHTSContractOwner.setFreezeDefaultStatus(true, { gasLimit: 1_000_000 });
      const newDefaultFreezeStatus = (await txSetDefaultFreezeStatus.wait()).events.filter(e => e.event === 'DefaultFreezeStatusChanged')[0].args.freezeStatus;

      expect(newDefaultFreezeStatus).to.equal(true);

      // create token with new default freeze status
      const tx = await baseHTSContractOwner.createFungibleTokenPublic(accounts[0].wallet.address, {
        value: ethers.BigNumber.from('10000000000000000000'),
        gasLimit: 10000000
      });

      const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(baseHTSContractOwner, tokenAddress, newDefaultFreezeStatus);
    });

    it('should create non fungible token with default freeze status true', async function() {
      // change default freeze status
      const txSetDefaultFreezeStatus = await baseHTSContractOwner.setFreezeDefaultStatus(true, { gasLimit: 1_000_000 });
      const newDefaultFreezeStatus = (await txSetDefaultFreezeStatus.wait()).events.filter(e => e.event === 'DefaultFreezeStatusChanged')[0].args.freezeStatus;

      expect(newDefaultFreezeStatus).to.equal(true);

      // create non fungible token with new default freeze status
      const tx = await baseHTSContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
        value: ethers.BigNumber.from('10000000000000000000'),
        gasLimit: 10000000
      });
      const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(baseHTSContractOwner, tokenAddress, newDefaultFreezeStatus);
    });
  });

  describe('HTS Precompile Pause/Unpause Tests', async function() {

    it('should be able to pause fungible token', async () => {
      const txTokenInfoBefore = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);
      const txPause = await baseHTSContract.pauseTokenPublic(HTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);

      const pauseResponse = (await txPause.wait()).events.filter(e => e.event === 'PausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(pauseResponse.paused).to.equal(true);
      expect(pauseStatusBefore).to.equal(false);
      expect(pauseStatusAfter).to.equal(true);
    });

    it('should be able to unpause fungible token', async () => {
      const txTokenInfoBefore = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);
      const txPause = await baseHTSContract.unpauseTokenPublic(HTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress);

      const unpauseResponse = (await txPause.wait()).events.filter(e => e.event === 'UnpausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(unpauseResponse.unpaused).to.equal(true);
      expect(pauseStatusBefore).to.equal(true);
      expect(pauseStatusAfter).to.equal(false);
    });

    it('should be able to pause non fungible token', async () => {
      const txTokenInfoBefore = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress);
      const txPause = await baseHTSContract.pauseTokenPublic(NftHTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress);

      const pauseResponse = (await txPause.wait()).events.filter(e => e.event === 'PausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(pauseResponse.paused).to.equal(true);
      expect(pauseStatusBefore).to.equal(false);
      expect(pauseStatusAfter).to.equal(true);
    });

    it('should be able to unpause non fungible token', async () => {
      const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

      const txTokenInfoBefore = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress);
      const txPause = await baseHTSContract.unpauseTokenPublic(NftHTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress);

      const unpauseResponse = (await txPause.wait()).events.filter(e => e.event === 'UnpausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(unpauseResponse.unpaused).to.equal(true);
      expect(pauseStatusBefore).to.equal(true);
      expect(pauseStatusAfter).to.equal(false);
    });
  });

  // FIXME
  // Requires a newer version of services than 0.29.0-alpha.1
  xdescribe('HTS Precompile Wipe Tests', async function() {

    before(async function() {
      const amount = 5;
      await baseHTSContract.transferTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, amount);
    });

    it('should revert if attempting to wipe more tokens than the owned amount', async function() {
      const wipeAmount = 100;
      const balanceBefore = await HTSTokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await baseHTSContract.wipeTokenAccountPublic(HTSTokenContractAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 1_000_000 });

      await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      const balanceAfter = await HTSTokenContract.balanceOf(accounts[1].wallet.address);
      expect(balanceBefore.toString()).to.eq(balanceAfter.toString());
    });

    it('should be able to execute wipeTokenAccount', async function() {
      const wipeAmount = 3;
      const balanceBefore = await HTSTokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await baseHTSContract.wipeTokenAccountPublic(HTSTokenContractAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 1_000_000 });
      const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const balanceAfter = await HTSTokenContract.balanceOf(accounts[1].wallet.address);
      expect(Number(balanceAfter.toString()) + wipeAmount).to.equal(Number(balanceBefore.toString()));
    });

    it('should be able to execute wipeTokenAccountNFT', async function() {
      let NftSerialNumber, serials;

      // Mint an NFT
      {
        const tx = await baseHTSContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x02'], { gasLimit: 1_000_000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        const { serialNumbers } = (await tx.wait()).events.filter(e => e.event === 'MintedToken')[0].args;
        expect(serialNumbers[0].toNumber()).to.be.greaterThan(0);
        NftSerialNumber = serialNumbers[0];
        serials = serialNumbers;
        expect(NftSerialNumber.toNumber()).to.equal(2);
      }

      // Associate the nft contract
      {
        const tx = await baseHTSContract.associateTokenPublic(baseHTSContract.address, NftHTSTokenContractAddress, { gasLimit: 1_000_000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Associate the receiver wallet
      {
        const tx2 = await baseHTSContract.connect(accounts[1].wallet).associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, {gasLimit: 1_000_000});
        const {responseCode} = (await tx2.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Transfer the NFT to the receiver wallet
      {
        const tx = await baseHTSContract.transferNFTPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, accounts[1].wallet.address, NftSerialNumber);
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Get token info before
      {
        const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(NftHTSTokenContractAddress, NftSerialNumber, { gasLimit: 1_000_000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        const { tokenInfo } = (await tx.wait()).events.filter(e => e.event === 'TokenInfo')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        expect(tokenInfo).to.exist;
      }

      // Wipe the NFT
      {
        const tx = await baseHTSContract.wipeTokenAccountNFTPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, serials, { gasLimit: 1_000_000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Get token info after
      {
        const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(NftHTSTokenContractAddress, NftSerialNumber, { gasLimit: 1_000_000 });
        await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      }
    });
  });

  // FIXME
  // Key management functionality is not present in the Consensus Node yet
  xdescribe('HTS Precompile Key management Tests', async function() {
    it('should be able to execute getTokenKey', async function() {
        const tx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        const { key } = (await tx.wait()).events.filter(e => e.event === 'KeyValue')[0].args;

        expect(key).to.exist;
        expect(key.inheritAccountKey).to.exist;
        expect(key.contractId).to.eq(HTSTokenContractAddress);
        expect(key.ed25519).to.exist;
        expect(key.ECDSA_secp256k1).to.exist;
        expect(key.delegatableContractId).to.exist;
    });

    it('should be able to execute updateTokenKeys', async function() {
      // Get key value before update
      const getKeyTx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
      const { key } = (await getKeyTx.wait()).events.filter(e => e.event === 'KeyValue')[0].args;

      // Update keys. After updating there should be only one key with keyValue = 6. Other keys are removed
      const tx = await baseHTSContract.updateTokenKeysPublic(HTSTokenContractAddress, [{
        keyValue: 6,
        key
      }]);
      const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      // Assert updated key
      {
        const tx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 6);
        const {responseCode} = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        const {key} = (await tx.wait()).events.filter(e => e.event === 'KeyValue')[0].args;

        expect(key).to.exist;
        expect(key.inheritAccountKey).to.exist;
        expect(key.contractId).to.eq(HTSTokenContractAddress);
        expect(key.ed25519).to.exist;
        expect(key.ECDSA_secp256k1).to.exist;
        expect(key.delegatableContractId).to.exist;
      }

      // Assert the original key is deleted
      {
        const tx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
        const {responseCode} = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.not.equal(TX_SUCCESS_CODE);
      }
    });
  });

  describe('HTS Precompile KYC Tests', async function() {
    async function checkTokenDefaultKYCStatus(contractOwner, tokenAddress, expectedValue: boolean) {
      const txTokenDefaultStatus = await contractOwner.getTokenDefaultKycStatusPublic(tokenAddress, { gasLimit: 1_000_000 });
      const responseCodeTokenDefaultStatus = (await txTokenDefaultStatus.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const defaultTokenKYCStatus = (await txTokenDefaultStatus.wait()).events.filter(e => e.event === 'TokenDefaultKycStatus')[0].args.defaultKycStatus;
      expect(responseCodeTokenDefaultStatus).to.equal(TX_SUCCESS_CODE);
      expect(defaultTokenKYCStatus).to.equal(expectedValue);
    }

    it('should be able to get default KYC status for fungible token', async function() {
      await checkTokenDefaultKYCStatus(baseHTSContractOwner, HTSTokenContractAddress, true);
    });

    it('should be able to get default KYC status for non fungible token', async function() {
      await checkTokenDefaultKYCStatus(baseHTSContractOwner, NftHTSTokenContractAddress, true);
    });
  });

  it('should be able to get a custom token fees', async function() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    const tx = (await baseHTSContract.getTokenCustomFeesPublic(HTSTokenWithCustomFeesContractAddress));
    const { fixedFees, fractionalFees } = (await tx.wait()).events.filter(e => e.event === 'TokenCustomFees')[0].args;

    expect(fixedFees[0].amount).to.equal(1);
    expect(fixedFees[0].tokenId).to.equal(HTSTokenContractAddress);
    expect(fixedFees[0].useHbarsForPayment).to.equal(false);
    expect(fixedFees[0].useCurrentTokenForPayment).to.equal(false);

    expect(fractionalFees[0].numerator).to.equal(4);
    expect(fractionalFees[0].denominator).to.equal(5);
    expect(fractionalFees[0].minimumAmount).to.equal(10);
    expect(fractionalFees[0].maximumAmount).to.equal(30);
    expect(fractionalFees[0].netOfTransfers).to.equal(false);
  });

  it('should be able to delete a token', async function() {
    const createdTokenAddress = await createHTSToken();

    const txBefore = (await baseHTSContract.getTokenInfoPublic(createdTokenAddress, { gasLimit: 1000000 }));
    const tokenInfoBefore = (await txBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

    const tx = await baseHTSContract.deleteTokenPublic(createdTokenAddress);
    const responseCode = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
    expect(responseCode).to.equal(TX_SUCCESS_CODE);

    const txAfter = (await baseHTSContract.getTokenInfoPublic(createdTokenAddress, { gasLimit: 1000000 }));
    const tokenInfoAfter = (await txAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

    expect(tokenInfoBefore.deleted).to.equal(false);
    expect(tokenInfoAfter.deleted).to.equal(true);
  });
});
