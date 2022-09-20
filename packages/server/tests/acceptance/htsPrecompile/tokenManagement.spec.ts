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

import { AliasAccount } from '../../clients/servicesClient';
import Assertions from '../../helpers/assertions';
import { ethers } from 'ethers';
import ERC20MockJson from '../../contracts/ERC20Mock.json';
import TokenManagementJson from '../../contracts/TokenManagementContract.json';

/**
 * Tests for:
 * wipeTokenAccount
 * wipeTokenAccountNFT
 * getTokenKey
 * updateTokenKeys
 * getTokenInfo
 * updateTokenInfo
 * isToken
 * getTokenType
 * getTokenExpiryInfo
 * freezeToken
 * unfreezeToken
 * pauseToken
 * unpauseToken
 * updateTokenExpiryInfo
 */
describe('@tokenmanagement', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, mirrorNode, relay } = global;

  const TX_SUCCESS_CODE = 22;

  const accounts: AliasAccount[] = [];
  let mainContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let HTSTokenContract;
  let mainContract;
  let mainContractOwner;
  let mainContractReceiverWalletFirst;

  this.beforeAll(async () => {
    accounts[0] = await servicesNode.createAliasAccount(200, relay.provider);
    accounts[1] = await servicesNode.createAliasAccount(30, relay.provider);

    // allow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));
    await mirrorNode.get(`/accounts/${accounts[0].accountId}`);
    await mirrorNode.get(`/accounts/${accounts[1].accountId}`);

    mainContractAddress = await deploymainContract();
    HTSTokenContractAddress = await createHTSToken();
    NftHTSTokenContractAddress = await createNftHTSToken();

    HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    mainContract = new ethers.Contract(mainContractAddress, TokenManagementJson.abi, accounts[0].wallet);

    mainContractOwner = mainContract;
    mainContractReceiverWalletFirst = mainContract.connect(accounts[1].wallet);

    const tx1 = await mainContractOwner.associateTokenPublic(mainContractAddress, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx1.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx2 = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx2.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx3 = await mainContractOwner.associateTokenPublic(mainContractAddress, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx3.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx4 = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx4.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  async function deploymainContract() {
    const mainFactory = new ethers.ContractFactory(TokenManagementJson.abi, TokenManagementJson.bytecode, accounts[0].wallet);
    const mainContract = await mainFactory.deploy({gasLimit: 15000000});
    const { contractAddress } = await mainContract.deployTransaction.wait();

    return contractAddress;
  }

  async function createHTSToken() {
    const mainContract = new ethers.Contract(mainContractAddress, TokenManagementJson.abi, accounts[0].wallet);
    const tx = await mainContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: ethers.BigNumber.from('10000000000000000000'),
      gasLimit: 10000000
    });
    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

    return tokenAddress;
  }

  async function createNftHTSToken() {
    const mainContract = new ethers.Contract(mainContractAddress, TokenManagementJson.abi, accounts[0].wallet);
    const tx = await mainContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
      value: ethers.BigNumber.from('10000000000000000000'),
      gasLimit: 10000000
    });
    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

    return tokenAddress;
  }

  describe('HTS Precompile Wipe Tests', async function() {
    let tokenAddress, tokenContract, nftAddress;

    before(async function() {
      // Create token and nft contracts
      tokenAddress = await createHTSToken();
      nftAddress = await createNftHTSToken();
      tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

      // Associate token and nft to accounts
      const tx1 = await mainContractOwner.associateTokenPublic(mainContractAddress, tokenAddress, {gasLimit: 1000000});
      expect((await tx1.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx2 = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, tokenAddress, {gasLimit: 1000000});
      expect((await tx2.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx3 = await mainContractOwner.associateTokenPublic(mainContractAddress, nftAddress, {gasLimit: 1000000});
      expect((await tx3.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx4 = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, nftAddress, {gasLimit: 1000000});
      expect((await tx4.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      // Grant Kyc to receiver account for token
      const grantKycTx = await mainContract.grantTokenKycPublic(tokenAddress, accounts[1].wallet.address, { gasLimit: 1000000 });
      const responseCodeGrantKyc = (await grantKycTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);

      // Grant Kyc to receiver account for nft
      const grantKycNftTx = await mainContract.grantTokenKycPublic(nftAddress, accounts[1].wallet.address, { gasLimit: 1000000 });
      const responseCodeGrantKycNft = (await grantKycNftTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeGrantKycNft).to.equal(TX_SUCCESS_CODE);
      // Transfer initial token balance to receiver
      const amount = 5;
      const tx = await mainContract.cryptoTransferTokenPublic(accounts[1].wallet.address, tokenAddress, amount);
      await tx.wait();
    });

    it('should revert if attempting to wipe more tokens than the owned amount', async function() {
      const wipeAmount = 100;
      const balanceBefore = await tokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await mainContract.wipeTokenAccountPublic(tokenAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 50000 });

      await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      const balanceAfter = await tokenContract.balanceOf(accounts[1].wallet.address);
      expect(balanceBefore.toString()).to.eq(balanceAfter.toString());
    });

    it('should be able to execute wipeTokenAccount', async function() {
      const wipeAmount = 3;
      const balanceBefore = await tokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await mainContract.wipeTokenAccountPublic(tokenAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 50000 });
      const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const balanceAfter = await tokenContract.balanceOf(accounts[1].wallet.address);
      expect(Number(balanceAfter.toString()) + wipeAmount).to.equal(Number(balanceBefore.toString()));
    });

    it('should be able to execute wipeTokenAccountNFT', async function() {
      let NftSerialNumber, serials;

      // Mint an NFT
      {
        const tx = await mainContract.mintTokenPublic(nftAddress, 0, ['0x02'], { gasLimit: 1000000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        const { serialNumbers } = (await tx.wait()).events.filter(e => e.event === 'MintedToken')[0].args;
        expect(serialNumbers[0].toNumber()).to.be.greaterThan(0);
        NftSerialNumber = serialNumbers[0];
        serials = serialNumbers;
      }

      // Transfer the NFT to the receiver wallet
      {
        const tx = await mainContract.transferNFTPublic(nftAddress, accounts[0].wallet.address, accounts[1].wallet.address, NftSerialNumber);
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Get token info before
      {
        const tx = await mainContract.getNonFungibleTokenInfoPublic(nftAddress, NftSerialNumber, { gasLimit: 1000000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        const { tokenInfo } = (await tx.wait()).events.filter(e => e.event === 'NonFungibleTokenInfo')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        expect(tokenInfo).to.exist;
      }

      // Wipe the NFT
      {
        const tx = await mainContract.wipeTokenAccountNFTPublic(nftAddress, accounts[1].wallet.address, serials, { gasLimit: 50000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        console.log(`Wipe response: ${responseCode}`);
      }

      // Get token info after
      {
        const tx = await mainContract.getNonFungibleTokenInfoPublic(nftAddress, NftSerialNumber, { gasLimit: 50000 });
        await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      }
    });
  });

  describe('HTS Precompile for token check methods', async function() {
    it('should return false for isToken with passed contract address', async function() {
      const tx = await mainContract.isTokenPublic(mainContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const isTokenFlag = txReceipt.events.filter(e => e.event === 'IsToken')[0].args.isToken;
      expect(isTokenFlag).to.equal(false);
    });
    it('should return true for isToken with passed token address', async function() {
      const tx = await mainContract.isTokenPublic(HTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const isTokenFlag = txReceipt.events.filter(e => e.event === 'IsToken')[0].args.isToken;
      expect(isTokenFlag).to.equal(true);
    });
    it('should return 0 for getTokenType with passed FUNGIBLE_COMMON token', async function() {
      const tx = await mainContract.getTokenTypePublic(HTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const tokenType = txReceipt.events.filter(e => e.event === 'TokenType')[0].args.tokenType;
      expect(tokenType).to.equal(0);
    });
    it('should return 1 for getTokenType with passed HTS NON_FUNGIBLE_UNIQUE token', async function() {
      const tx = await mainContract.getTokenTypePublic(NftHTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const tokenType = txReceipt.events.filter(e => e.event === 'TokenType')[0].args.tokenType;
      expect(tokenType).to.equal(1);
    });
    it('should throw an exception for getTokenType with passed contract address', async function() {
      let hasError = false;
      try {
        const tx = await mainContract.getTokenTypePublic(mainContractAddress, { gasLimit: 50000 });
        await tx.wait();
      } catch (e) {
        hasError = true;
      }
      expect(hasError).to.equal(true);
    });
  });

  describe('HTS update token info test', async function() {
    const TOKEN_UPDATE_NAME = 'tokenUpdateName';
    const TOKEN_UPDATE_SYMBOL = 'tokenUpdateSymbol';
    const TOKEN_UPDATE_MEMO = 'tokenUpdateMemo';

    function setUpdatedValues(token) {
      token.name = TOKEN_UPDATE_NAME;
      token.symbol = TOKEN_UPDATE_SYMBOL;
      token.memo = TOKEN_UPDATE_MEMO;
      token.treasury = mainContractAddress;
    }

    function checkUpdatedTokenInfo(tokenInfo) {
      expect(tokenInfo.name).to.equal(TOKEN_UPDATE_NAME);
      expect(tokenInfo.symbol).to.equal(TOKEN_UPDATE_SYMBOL);
      expect(tokenInfo.treasury).to.equal(mainContractAddress);
      expect(tokenInfo.memo).to.equal(TOKEN_UPDATE_MEMO);
    }

    it('should update fungible token properties', async function() {
      const txBeforeInfo = await mainContract.getTokenInfoPublic(HTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoBefore = ((await txBeforeInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];

      const token = {
        ...tokenInfoBefore, tokenKeys: [{...tokenInfoBefore.tokenKeys[0]}]
      };

      setUpdatedValues(token);

      // update contract properties
      const txUpdate = await mainContractOwner.updateTokenInfoPublic(HTSTokenContractAddress, token, { gasLimit: 1000000 });
      expect((await txUpdate.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.be.equal(TX_SUCCESS_CODE);

      const txAfterInfo = await mainContract.getTokenInfoPublic(HTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoAfter = ((await txAfterInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];
      checkUpdatedTokenInfo(tokenInfoAfter);
    });

    it('should update non-fungible token properties', async function() {
      const txBeforeInfo = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoBefore = ((await txBeforeInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];

      const token = {
        ...tokenInfoBefore, tokenKeys: [{...tokenInfoBefore.tokenKeys[0]}]
      };

      setUpdatedValues(token);

      const txUpdate = await mainContractOwner.updateTokenInfoPublic(NftHTSTokenContractAddress, token, { gasLimit: 1000000 });
      expect((await txUpdate.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.be.equal(TX_SUCCESS_CODE);

      const txAfterInfo = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoAfter = ((await txAfterInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];
      checkUpdatedTokenInfo(tokenInfoAfter);
    });
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
      await checkTokenFrozen(mainContractOwner, HTSTokenContractAddress, false);

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(mainContractOwner, HTSTokenContractAddress, false);

      // freeze token
      const freezeTx = await mainContractOwner.freezeTokenPublic(HTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeFreeze = (await freezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeFreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to be frozen
      await checkTokenFrozen(mainContractOwner, HTSTokenContractAddress, true);

      // unfreeze token
      const unfreezeTx = await mainContractOwner.unfreezeTokenPublic(HTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeUnfreeze = (await unfreezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeUnfreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to not be frozen
      await checkTokenFrozen(mainContractOwner, HTSTokenContractAddress, false);
    });

    it('should be able to freeze and unfreeze non-fungible token transfers', async function() {
      // expect the token to not be frozen
      await checkTokenFrozen(mainContractOwner, NftHTSTokenContractAddress, false);

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(mainContractOwner, NftHTSTokenContractAddress, false);

      // freeze token
      const freezeTx = await mainContractOwner.freezeTokenPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeFreeze = (await freezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeFreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to be frozen
      await checkTokenFrozen(mainContractOwner, NftHTSTokenContractAddress, true);

      // unfreeze token
      const unfreezeTx = await mainContractOwner.unfreezeTokenPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeUnfreeze = (await unfreezeTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeUnfreeze).to.equal(TX_SUCCESS_CODE);

      // expect the token to not be frozen
      await checkTokenFrozen(mainContractOwner, NftHTSTokenContractAddress, false);
    });

    it('should create fungible token with default freeze status true', async function() {
      // change default freeze status
      const txSetDefaultFreezeStatus = await mainContractOwner.setFreezeDefaultStatus(true, { gasLimit: 1_000_000 });
      const newDefaultFreezeStatus = (await txSetDefaultFreezeStatus.wait()).events.filter(e => e.event === 'DefaultFreezeStatusChanged')[0].args.freezeStatus;

      expect(newDefaultFreezeStatus).to.equal(true);

      // create token with new default freeze status
      const tx = await mainContractOwner.createFungibleTokenPublic(accounts[0].wallet.address, {
        value: ethers.BigNumber.from('10000000000000000000'),
        gasLimit: 10000000
      });

      const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(mainContractOwner, tokenAddress, newDefaultFreezeStatus);
    });

    it('should create non fungible token with default freeze status true', async function() {
      // change default freeze status
      const txSetDefaultFreezeStatus = await mainContractOwner.setFreezeDefaultStatus(true, { gasLimit: 1_000_000 });
      const newDefaultFreezeStatus = (await txSetDefaultFreezeStatus.wait()).events.filter(e => e.event === 'DefaultFreezeStatusChanged')[0].args.freezeStatus;

      expect(newDefaultFreezeStatus).to.equal(true);

      // create non fungible token with new default freeze status
      const tx = await mainContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
        value: ethers.BigNumber.from('10000000000000000000'),
        gasLimit: 10000000
      });
      const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;

      // get token default freeze status
      await checkTokenDefaultFreezeStatus(mainContractOwner, tokenAddress, newDefaultFreezeStatus);
    });
  });

  describe('HTS Precompile Pause/Unpause Tests', async function() {

    it('should be able to pause fungible token', async () => {
      const txTokenInfoBefore = await mainContract.getTokenInfoPublic(HTSTokenContractAddress);
      const txPause = await mainContract.pauseTokenPublic(HTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await mainContract.getTokenInfoPublic(HTSTokenContractAddress);

      const pauseResponse = (await txPause.wait()).events.filter(e => e.event === 'PausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(pauseResponse.paused).to.equal(true);
      expect(pauseStatusBefore).to.equal(false);
      expect(pauseStatusAfter).to.equal(true);
    });

    it('should be able to unpause fungible token', async () => {
      const txTokenInfoBefore = await mainContract.getTokenInfoPublic(HTSTokenContractAddress);
      const txPause = await mainContract.unpauseTokenPublic(HTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await mainContract.getTokenInfoPublic(HTSTokenContractAddress);

      const unpauseResponse = (await txPause.wait()).events.filter(e => e.event === 'UnpausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(unpauseResponse.unpaused).to.equal(true);
      expect(pauseStatusBefore).to.equal(true);
      expect(pauseStatusAfter).to.equal(false);
    });

    it('should be able to pause non fungible token', async () => {
      const txTokenInfoBefore = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress);
      const txPause = await mainContract.pauseTokenPublic(NftHTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress);

      const pauseResponse = (await txPause.wait()).events.filter(e => e.event === 'PausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(pauseResponse.paused).to.equal(true);
      expect(pauseStatusBefore).to.equal(false);
      expect(pauseStatusAfter).to.equal(true);
    });

    it('should be able to unpause non fungible token', async () => {
      const mainContract = new ethers.Contract(mainContractAddress, TokenManagementJson.abi, accounts[0].wallet);

      const txTokenInfoBefore = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress);
      const txPause = await mainContract.unpauseTokenPublic(NftHTSTokenContractAddress, {gasLimit: 1000000});
      const txTokenInfoAfter = await mainContract.getTokenInfoPublic(NftHTSTokenContractAddress);

      const unpauseResponse = (await txPause.wait()).events.filter(e => e.event === 'UnpausedToken')[0].args;
      const { pauseStatus: pauseStatusBefore } = (await txTokenInfoBefore.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;
      const { pauseStatus: pauseStatusAfter } = (await txTokenInfoAfter.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo;

      expect(unpauseResponse.unpaused).to.equal(true);
      expect(pauseStatusBefore).to.equal(true);
      expect(pauseStatusAfter).to.equal(false);
    });
  });

  describe('HTS Precompile Token Expiry Info Tests', async function() {
    const AUTO_RENEW_PERIOD = 8000000;
    const NEW_AUTO_RENEW_PERIOD = 7999900;
    const AUTO_RENEW_SECOND = 0;

    //Expiry Info auto renew account returns account id from type - 0x000000000000000000000000000000000000048C
    //We expect account to be evm address, but because we can't compute one address for the other, we have to make a mirror node query to get expiry info auto renew evm address
    async function mirrorNodeAddressReq(address){
      const accountEvmAddress = await mirrorNode.get(`/accounts/${address}?transactiontype=cryptotransfer`);
      return accountEvmAddress.evm_address;
    }

    it('should be able to get and update fungible token expiry info', async function() {
      //get current epoch + auto renew period , which result to expiry info second
      const epoch = parseInt((Date.now()/1000 + NEW_AUTO_RENEW_PERIOD).toFixed(0));

      // get current expiry info
      const getTokenExpiryInfoTxBefore = await mainContract.getTokenExpiryInfoPublic(HTSTokenContractAddress);
      const responseCode = (await getTokenExpiryInfoTxBefore.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const tokenExpiryInfoBefore = (await getTokenExpiryInfoTxBefore.wait()).events.filter(e => e.event === 'TokenExpiryInfo')[0].args.expiryInfo;

      const renewAccountEvmAddress = await mirrorNodeAddressReq(tokenExpiryInfoBefore.autoRenewAccount);

      expect(responseCode).to.equal(TX_SUCCESS_CODE);
      expect(tokenExpiryInfoBefore.autoRenewPeriod).to.equal(AUTO_RENEW_PERIOD);
      expect(renewAccountEvmAddress).to.equal(`0x${accounts[0].address}`);

      const expiryInfo = {
        second: AUTO_RENEW_SECOND,
        autoRenewAccount: `${mainContractAddress}`,
        autoRenewPeriod: NEW_AUTO_RENEW_PERIOD
      };
      // update expiry info
      const updateTokenExpiryInfoTx = (await mainContract.updateTokenExpiryInfoPublic(HTSTokenContractAddress, expiryInfo, { gasLimit: 1_000_000 }));
      const updateExpiryInfoResponseCode = (await updateTokenExpiryInfoTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;

      // get updated expiryInfo
      const getTokenExpiryInfoTxAfter = (await mainContract.getTokenExpiryInfoPublic(HTSTokenContractAddress));
      const getExpiryInfoResponseCode = (await getTokenExpiryInfoTxAfter.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const tokenExpiryInfoAfter = (await getTokenExpiryInfoTxAfter.wait()).events.filter(e => e.event === 'TokenExpiryInfo')[0].args.expiryInfo;

      const newRenewAccountEvmAddress = await mirrorNodeAddressReq(tokenExpiryInfoAfter.autoRenewAccount);
      const expectedRenewAddress = `0x${mainContractAddress.substring(2)}`;

      expect(updateExpiryInfoResponseCode).to.equal(TX_SUCCESS_CODE);
      expect(getExpiryInfoResponseCode).to.equal(TX_SUCCESS_CODE);
      expect(tokenExpiryInfoAfter.autoRenewPeriod).to.equal(expiryInfo.autoRenewPeriod);
      expect(newRenewAccountEvmAddress.toLowerCase()).to.equal(expectedRenewAddress.toLowerCase());

      //use close to with delta 300 seconds, because we don't know the exact second it was set to expiry
      expect(tokenExpiryInfoAfter.second).to.be.closeTo(epoch, 300);
    });

    it('should be able to get and update non fungible token expiry info', async function() {
      //get current epoch + auto renew period , which result to expiry info second
      const epoch = parseInt((Date.now()/1000 + NEW_AUTO_RENEW_PERIOD).toFixed(0));
      // get current expiry info
      const getTokenExpiryInfoTxBefore = (await mainContract.getTokenExpiryInfoPublic(NftHTSTokenContractAddress));
      const responseCode = (await getTokenExpiryInfoTxBefore.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const tokenExpiryInfoBefore = (await getTokenExpiryInfoTxBefore.wait()).events.filter(e => e.event === 'TokenExpiryInfo')[0].args.expiryInfo;

      //Expiry Info auto renew account returns account id from type - 0x000000000000000000000000000000000000048C
      //We expect account to be evm address, but because we can't compute one address for the other, we have to make a mirror node query to get expiry info auto renew evm address
      const renewAccountEvmAddress = await mirrorNodeAddressReq(tokenExpiryInfoBefore.autoRenewAccount);

      expect(responseCode).to.equal(TX_SUCCESS_CODE);
      expect(tokenExpiryInfoBefore.autoRenewPeriod).to.equal(8000000);
      expect(renewAccountEvmAddress).to.equal(`0x${accounts[0].address}`);

      // update expiry info
      const expiryInfo = {
        second: AUTO_RENEW_SECOND,
        autoRenewAccount: mainContractAddress,
        autoRenewPeriod: NEW_AUTO_RENEW_PERIOD
      };

      const updateTokenExpiryInfoTx = (await mainContract.updateTokenExpiryInfoPublic(NftHTSTokenContractAddress, expiryInfo, { gasLimit: 1_000_000 }));
      const updateExpiryInfoResponseCode = (await updateTokenExpiryInfoTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;

      // get updated expiryInfo
      const getTokenExpiryInfoTxAfter = (await mainContract.getTokenExpiryInfoPublic(NftHTSTokenContractAddress));
      const getExpiryInfoResponseCode = (await getTokenExpiryInfoTxAfter.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      const tokenExpiryInfoAfter = (await getTokenExpiryInfoTxAfter.wait()).events.filter(e => e.event === 'TokenExpiryInfo')[0].args.expiryInfo;

      const newRenewAccountEvmAddress = await mirrorNodeAddressReq(tokenExpiryInfoAfter.autoRenewAccount);
      const expectedRenewAddress = `0x${mainContractAddress.substring(2)}`;

      expect(updateExpiryInfoResponseCode).to.equal(TX_SUCCESS_CODE);
      expect(getExpiryInfoResponseCode).to.equal(TX_SUCCESS_CODE);
      expect(tokenExpiryInfoAfter.autoRenewPeriod).to.equal(expiryInfo.autoRenewPeriod);
      expect(newRenewAccountEvmAddress.toLowerCase()).to.equal(expectedRenewAddress.toLowerCase());

      //use close to with delta 300 seconds, because we don't know the exact second it was set to expiry
      expect(tokenExpiryInfoAfter.second).to.be.closeTo(epoch, 300);
    });
  });

  describe('HTS Precompile Key management Tests', async function() {
    it('should be able to execute getTokenKey', async function() {
      const tx = await mainContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
      const result = await tx.wait();
      const { responseCode } = result.events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);
      const { key } = result.events.filter(e => e.event === 'TokenKey')[0].args;

      expect(key).to.exist;
      expect(key.inheritAccountKey).to.eq(false);
      expect(key.contractId).to.eq('0x0000000000000000000000000000000000000000');
      expect(key.ed25519).to.eq('0x');
      expect(key.ECDSA_secp256k1).to.exist;
      expect(key.delegatableContractId).to.eq('0x0000000000000000000000000000000000000000');
    });

    it('should be able to execute updateTokenKeys', async function() {
      // Get key value before update
      const getKeyTx = await mainContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
      const originalKey = (await getKeyTx.wait()).events.filter(e => e.event === 'TokenKey')[0].args.key;
      const updateKey = [
        false,
        '0x0000000000000000000000000000000000000000',
        '0x',
        '0x03dfcc94dfd843649cc594ada5ac6627031454602aa190223f996de25a05828f36',
        '0x0000000000000000000000000000000000000000',
      ];

      // Update keys. After updating there should be only one key with keyValue = 6. Other keys are removed
      const updateTx = await mainContract.updateTokenKeysPublic(HTSTokenContractAddress, [[ 2, updateKey]]);
      const updateResponseCode = (await updateTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(Number(updateResponseCode.toString())).to.equal(TX_SUCCESS_CODE);

      // Assert updated key
      const tx = await mainContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
      const result = await tx.wait();
      const {responseCode} = result.events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(Number(responseCode.toString())).to.equal(TX_SUCCESS_CODE);
      const updatedKey = result.events.filter(e => e.event === 'TokenKey')[0].args.key;

      expect(updatedKey).to.exist;
      expect(updatedKey.inheritAccountKey).to.eq(updateKey[0]);
      expect(updatedKey.contractId).to.eq(updateKey[1]);
      expect(updatedKey.ed25519).to.eq(updateKey[2]);
      expect(updatedKey.ECDSA_secp256k1).to.eq(updateKey[3]);
      expect(updatedKey.delegatableContractId).to.eq(updateKey[4]);
      expect(updatedKey.ECDSA_secp256k1).to.not.eq(originalKey.ECDSA_secp256k1);
    });
  });
});
