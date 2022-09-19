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
import BaseHTSJson from '../contracts/contracts_v2/BaseHTS.json';

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
 */
describe('@htsprecompilev2 HTS Precompile V2 Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, mirrorNode, relay } = global;

  const TX_SUCCESS_CODE = 22;

  const accounts: AliasAccount[] = [];
  let BaseHTSContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let HTSTokenContract;
  let baseHTSContract;
  let baseHTSContractOwner;
  let baseHTSContractReceiverWalletFirst;

  this.beforeAll(async () => {
    accounts[0] = await servicesNode.createAliasAccount(200, relay.provider);
    accounts[1] = await servicesNode.createAliasAccount(30, relay.provider);

    // allow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));
    await mirrorNode.get(`/accounts/${accounts[0].accountId}`);
    await mirrorNode.get(`/accounts/${accounts[1].accountId}`);

    BaseHTSContractAddress = await deployBaseHTSContract();
    HTSTokenContractAddress = await createHTSToken();
    NftHTSTokenContractAddress = await createNftHTSToken();

    HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    baseHTSContractOwner = baseHTSContract;
    baseHTSContractReceiverWalletFirst = baseHTSContract.connect(accounts[1].wallet);

    const tx1 = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx1.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx2 = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx2.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx3 = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx3.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const tx4 = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await tx4.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  async function deployBaseHTSContract() {
    const baseHTSFactory = new ethers.ContractFactory(BaseHTSJson.abi, BaseHTSJson.bytecode, accounts[0].wallet);
    const baseHTS = await baseHTSFactory.deploy({gasLimit: 15000000});
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

  describe('HTS Precompile Wipe Tests', async function() {
    let tokenAddress, tokenContract, nftAddress;

    before(async function() {
      // Create token and nft contracts
      tokenAddress = await createHTSToken();
      nftAddress = await createNftHTSToken();
      tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

      // Associate token and nft to accounts
      const tx1 = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, tokenAddress, {gasLimit: 1000000});
      expect((await tx1.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx2 = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, tokenAddress, {gasLimit: 1000000});
      expect((await tx2.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx3 = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, nftAddress, {gasLimit: 1000000});
      expect((await tx3.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      const tx4 = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, nftAddress, {gasLimit: 1000000});
      expect((await tx4.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

      // Grant Kyc to receiver account for token
      const grantKycTx = await baseHTSContract.grantTokenKycPublic(tokenAddress, accounts[1].wallet.address, { gasLimit: 1000000 });
      const responseCodeGrantKyc = (await grantKycTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);

      // Grant Kyc to receiver account for nft
      const grantKycNftTx = await baseHTSContract.grantTokenKycPublic(nftAddress, accounts[1].wallet.address, { gasLimit: 1000000 });
      const responseCodeGrantKycNft = (await grantKycNftTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCodeGrantKycNft).to.equal(TX_SUCCESS_CODE);
      // Transfer initial token balance to receiver
      const amount = 5;
      const tx = await baseHTSContract.cryptoTransferTokenPublic(accounts[1].wallet.address, tokenAddress, amount);
      await tx.wait();
    });

    it('should revert if attempting to wipe more tokens than the owned amount', async function() {
      const wipeAmount = 100;
      const balanceBefore = await tokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await baseHTSContract.wipeTokenAccountPublic(tokenAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 50000 });

      await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      const balanceAfter = await tokenContract.balanceOf(accounts[1].wallet.address);
      expect(balanceBefore.toString()).to.eq(balanceAfter.toString());
    });

    it('should be able to execute wipeTokenAccount', async function() {
      const wipeAmount = 3;
      const balanceBefore = await tokenContract.balanceOf(accounts[1].wallet.address);

      const tx = await baseHTSContract.wipeTokenAccountPublic(tokenAddress, accounts[1].wallet.address, wipeAmount, { gasLimit: 50000 });
      const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const balanceAfter = await tokenContract.balanceOf(accounts[1].wallet.address);
      expect(Number(balanceAfter.toString()) + wipeAmount).to.equal(Number(balanceBefore.toString()));
    });

    it('should be able to execute wipeTokenAccountNFT', async function() {
      let NftSerialNumber, serials;

      // Mint an NFT
      {
        const tx = await baseHTSContract.mintTokenPublic(nftAddress, 0, ['0x02'], { gasLimit: 1000000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        const { serialNumbers } = (await tx.wait()).events.filter(e => e.event === 'MintedToken')[0].args;
        expect(serialNumbers[0].toNumber()).to.be.greaterThan(0);
        NftSerialNumber = serialNumbers[0];
        serials = serialNumbers;
      }

      // Transfer the NFT to the receiver wallet
      {
        const tx = await baseHTSContract.transferNFTPublic(nftAddress, accounts[0].wallet.address, accounts[1].wallet.address, NftSerialNumber);
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
      }

      // Get token info before
      {
        const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(nftAddress, NftSerialNumber, { gasLimit: 1000000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        const { tokenInfo } = (await tx.wait()).events.filter(e => e.event === 'NonFungibleTokenInfo')[0].args;
        expect(responseCode).to.equal(TX_SUCCESS_CODE);
        expect(tokenInfo).to.exist;
      }

      // Wipe the NFT
      {
        const tx = await baseHTSContract.wipeTokenAccountNFTPublic(nftAddress, accounts[1].wallet.address, serials, { gasLimit: 50000 });
        const { responseCode } = (await tx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args;
        console.log(`Wipe response: ${responseCode}`);
      }

      // Get token info after
      {
        const tx = await baseHTSContract.getNonFungibleTokenInfoPublic(nftAddress, NftSerialNumber, { gasLimit: 50000 });
        await Assertions.expectRevert(tx, 'CALL_EXCEPTION');
      }
    });
  });

  describe('HTS Precompile for token check methods', async function() {
    it('should return false for isToken with passed contract address', async function() {
      const tx = await baseHTSContract.isTokenPublic(BaseHTSContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const isTokenFlag = txReceipt.events.filter(e => e.event === 'IsToken')[0].args.isToken;
      expect(isTokenFlag).to.equal(false);
    });
    it('should return true for isToken with passed token address', async function() {
      const tx = await baseHTSContract.isTokenPublic(HTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const isTokenFlag = txReceipt.events.filter(e => e.event === 'IsToken')[0].args.isToken;
      expect(isTokenFlag).to.equal(true);
    });
    it('should return 0 for getTokenType with passed FUNGIBLE_COMMON token', async function() {
      const tx = await baseHTSContract.getTokenTypePublic(HTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const tokenType = txReceipt.events.filter(e => e.event === 'TokenType')[0].args.tokenType;
      expect(tokenType).to.equal(0);
    });
    it('should return 1 for getTokenType with passed HTS NON_FUNGIBLE_UNIQUE token', async function() {
      const tx = await baseHTSContract.getTokenTypePublic(NftHTSTokenContractAddress, { gasLimit: 50000 });
      const txReceipt = await tx.wait();

      const responseCode = txReceipt.events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);

      const tokenType = txReceipt.events.filter(e => e.event === 'TokenType')[0].args.tokenType;
      expect(tokenType).to.equal(1);
    });
    it('should throw an exception for getTokenType with passed contract address', async function() {
      let hasError = false;
      try {
        const tx = await baseHTSContract.getTokenTypePublic(BaseHTSContractAddress, { gasLimit: 50000 });
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
      token.treasury = BaseHTSContractAddress;
    }

    function checkUpdatedTokenInfo(tokenInfo) {
      expect(tokenInfo.name).to.equal(TOKEN_UPDATE_NAME);
      expect(tokenInfo.symbol).to.equal(TOKEN_UPDATE_SYMBOL);
      expect(tokenInfo.treasury).to.equal(BaseHTSContractAddress);
      expect(tokenInfo.memo).to.equal(TOKEN_UPDATE_MEMO);
    }

    it('should update fungible token properties', async function() {
      const txBeforeInfo = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoBefore = ((await txBeforeInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];

      const token = {
        ...tokenInfoBefore, tokenKeys: [{...tokenInfoBefore.tokenKeys[0]}]
      };

      setUpdatedValues(token);

      // update contract properties
      const txUpdate = await baseHTSContractOwner.updateTokenInfoPublic(HTSTokenContractAddress, token, { gasLimit: 1000000 });
      expect((await txUpdate.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.be.equal(TX_SUCCESS_CODE);

      const txAfterInfo = await baseHTSContract.getTokenInfoPublic(HTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoAfter = ((await txAfterInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];
      checkUpdatedTokenInfo(tokenInfoAfter);
    });

    it('should update non-fungible token properties', async function() {
      const txBeforeInfo = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoBefore = ((await txBeforeInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];

      const token = {
        ...tokenInfoBefore, tokenKeys: [{...tokenInfoBefore.tokenKeys[0]}]
      };

      setUpdatedValues(token);

      const txUpdate = await baseHTSContractOwner.updateTokenInfoPublic(NftHTSTokenContractAddress, token, { gasLimit: 1000000 });
      expect((await txUpdate.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode).to.be.equal(TX_SUCCESS_CODE);

      const txAfterInfo = await baseHTSContract.getTokenInfoPublic(NftHTSTokenContractAddress, { gasLimit: 1000000 });
      const tokenInfoAfter = ((await txAfterInfo.wait()).events.filter(e => e.event === 'TokenInfo')[0].args.tokenInfo)[0];
      checkUpdatedTokenInfo(tokenInfoAfter);
    });
  });

  describe('HTS Precompile Key management Tests', async function() {
    it('should be able to execute getTokenKey', async function() {
      const tx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
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
      const getKeyTx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
      const originalKey = (await getKeyTx.wait()).events.filter(e => e.event === 'TokenKey')[0].args.key;
      const updateKey = [
        false,
        '0x0000000000000000000000000000000000000000',
        '0x',
        '0x03dfcc94dfd843649cc594ada5ac6627031454602aa190223f996de25a05828f36',
        '0x0000000000000000000000000000000000000000',
      ];

      // Update keys. After updating there should be only one key with keyValue = 6. Other keys are removed
      const updateTx = await baseHTSContract.updateTokenKeysPublic(HTSTokenContractAddress, [[ 2, updateKey]]);
      const updateResponseCode = (await updateTx.wait()).events.filter(e => e.event === 'ResponseCode')[0].args.responseCode;
      expect(Number(updateResponseCode.toString())).to.equal(TX_SUCCESS_CODE);

      // Assert updated key
      const tx = await baseHTSContract.getTokenKeyPublic(HTSTokenContractAddress, 2);
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
