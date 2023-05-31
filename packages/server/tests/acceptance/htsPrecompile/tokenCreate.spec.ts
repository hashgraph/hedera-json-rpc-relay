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
import { ethers } from 'ethers';
import ERC20MockJson from '../../contracts/ERC20Mock.json';
import ERC721MockJson from '../../contracts/ERC721Mock.json';
import TokenCreateJson from '../../contracts/TokenCreateContract.json';
import { Utils } from '../../helpers/utils';
import Assertions from '../../helpers/assertions';

/**
 * Tests for:
 * allowance
 * approve
 * approveNFT
 * associateToken
 * createFungibleToken
 * createFungibleTokenWithCustomFees
 * createNonFungibleToken
 * cryptoTransfer
 * cryptoTransferToken
 * deleteToken
 * getFungibleTokenInfo
 * getNonFungibleTokenInfo
 * getTokenCustomFees
 * getTokenInfo
 * grantTokenKyc
 * isApprovedForAll
 * mintToken
 * revokeTokenKyc
 * setApprovalForAll
 */
describe('@tokencreate HTS Precompile Token Create Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, mirrorNode, relay } = global;

  const TX_SUCCESS_CODE = BigInt(22);
  const TOKEN_NAME = 'tokenName';
  const TOKEN_SYMBOL = 'tokenSymbol';
  const TOKEN_MAX_SUPPLY = 1000;
  const TOKEN_DECIMALS = 8;

  const accounts: AliasAccount[] = [];
  let mainContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let NftSerialNumber;
  let HTSTokenContract;
  let NFTokenContract;
  let mainContract;
  let mainContractOwner;
  let mainContractReceiverWalletFirst;
  let mainContractReceiverWalletSecond;
  let HTSTokenWithCustomFeesContractAddress;
  let requestId;

  before(async () => {
    requestId = Utils.generateRequestId();

    accounts[0] = await servicesNode.createAliasAccount(200, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(30, relay.provider, requestId);
    accounts[2] = await servicesNode.createAliasAccount(30, relay.provider, requestId);

    // allow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));
    await mirrorNode.get(`/accounts/${accounts[0].accountId}`, requestId);
    await mirrorNode.get(`/accounts/${accounts[1].accountId}`, requestId);
    await mirrorNode.get(`/accounts/${accounts[2].accountId}`, requestId);

    mainContractAddress = await deploymainContract();
    HTSTokenContractAddress = await createHTSToken();
    NftHTSTokenContractAddress = await createNftHTSToken();
    HTSTokenWithCustomFeesContractAddress = await createHTSTokenWithCustomFees();

    HTSTokenContract = new ethers.Contract(HTSTokenContractAddress, ERC20MockJson.abi, accounts[0].wallet);
    NFTokenContract = new ethers.Contract(NftHTSTokenContractAddress, ERC721MockJson.abi, accounts[0].wallet);
    mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);

    mainContractOwner = mainContract;
    mainContractReceiverWalletFirst = mainContract.connect(accounts[1].wallet);
    mainContractReceiverWalletSecond = mainContract.connect(accounts[2].wallet);
  });

  this.beforeEach(async () => {
    requestId = Utils.generateRequestId();
  });

  async function deploymainContract() {
    const mainFactory = new ethers.ContractFactory(TokenCreateJson.abi, TokenCreateJson.bytecode, accounts[0].wallet);
    const mainContract = await mainFactory.deploy({gasLimit: 15000000});
    const { target } = await mainContract.waitForDeployment();

    return target;
  }

  async function createHTSToken() {
    const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
    const tx = await mainContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10000000
    });

    const [tokenAddress] = (await tx.wait()).logs.filter(e => e.fragment.name === 'CreatedToken')[0].args;

    return tokenAddress;
  }

  async function createNftHTSToken() {
    const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
    const tx = await mainContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10000000
    });
    const [tokenAddress] = (await tx.wait()).logs.filter(e => e.fragment.name === 'CreatedToken')[0].args;

    return tokenAddress;
  }

  async function createHTSTokenWithCustomFees() {
    const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
    const tx = await mainContract.createFungibleTokenWithCustomFeesPublic(accounts[0].wallet.address, HTSTokenContractAddress, {
      value: BigInt('20000000000000000000'),
      gasLimit: 10_000_000
    });
    const txReceipt = await tx.wait();
    const [tokenAddress] = txReceipt.logs.filter(e => e.fragment.name === 'CreatedToken')[0].args;

    return tokenAddress;
  }

  it('should associate to a token', async function() {
    const txCO = await mainContractOwner.associateTokenPublic(mainContractAddress, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const txRWF = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const txRWS = await mainContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
  });

  it('should associate to a nft', async function() {
    const txCO = await mainContractOwner.associateTokenPublic(mainContractAddress, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const txRWF = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const txRWS = await mainContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, NftHTSTokenContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
  });

  it('should associate to a token with custom fees', async function() {
    //delay for hbar rate limiter to reset
    await new Promise(r => setTimeout(r, parseInt(process.env.HBAR_RATE_LIMIT_DURATION!)));

    const mainContractOwner = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
    const txCO = await mainContractOwner.associateTokenPublic(mainContractAddress, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const mainContractReceiverWalletFirst = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[1].wallet);
    const txRWF = await mainContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const mainContractReceiverWalletSecond = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[2].wallet);
    const txRWS = await mainContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenWithCustomFeesContractAddress, { gasLimit: 10000000 });
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
  });

  it('should check initial balances', async function() {
    expect(await HTSTokenContract.balanceOf(accounts[0].wallet.address)).to.equal(BigInt(1000));
    expect(await HTSTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(BigInt(0));
    expect(await HTSTokenContract.balanceOf(accounts[2].wallet.address)).to.equal(BigInt(0));
  });

  it('should be able to mint a nft', async function() {
    const tx = await mainContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x01'], { gasLimit: 5_000_000 });
    expect((await tx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

    const serialNumbers = (await tx.wait()).logs.filter(e => e.fragment.name === 'MintedToken')[0].args[1];
    NftSerialNumber = Number(serialNumbers[0]);
    expect(NftSerialNumber).to.be.greaterThan(0);
  });

  describe('HTS Precompile Approval Tests', async function() {
    //When we use approve from our mainContract, it always gives approval only from itself (mainContract is owner).
    it('should be able to approve anyone to spend tokens', async function() {
      const amount = BigInt(13);

      const txBefore = await mainContract.allowancePublic(HTSTokenContractAddress, mainContractAddress, accounts[2].wallet.address);
      const beforeAmount =  Number((await txBefore.wait()).logs.filter(e => e.fragment.name === 'AllowanceValue')[0].args[0]);
      expect((await txBefore.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      // grant KYC
      {
        const grantKycTx = await mainContractOwner.grantTokenKycPublic(HTSTokenContractAddress, accounts[1].wallet.address, { gasLimit: 1_000_000 });
        expect((await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
      }
      {
        const grantKycTx = await mainContractOwner.grantTokenKycPublic(HTSTokenContractAddress, mainContract.target, { gasLimit: 1_000_000 });
        expect((await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
      }

      //Transfer some hbars to the contract address
      await mainContract.cryptoTransferTokenPublic(mainContract.target, HTSTokenContractAddress, amount);
      await new Promise(r => setTimeout(r, 2000));
      expect(await HTSTokenContract.balanceOf(mainContract.target)).to.equal(amount);
      expect(await HTSTokenContract.balanceOf(accounts[2].wallet.address)).to.be.equal(BigInt(0));

      //Give approval for account[2] to use HTSTokens which are owned by mainContract
      await mainContract.approvePublic(HTSTokenContractAddress, accounts[2].wallet.address, amount, { gasLimit: 1_000_000 });

      //Check if approval was given
      const txAfter = await mainContract.allowancePublic(HTSTokenContractAddress, mainContractAddress, accounts[2].wallet.address);
      const [afterAmount] = (await txAfter.wait()).logs.filter(e => e.fragment.name === 'AllowanceValue')[0].args;
      expect(beforeAmount).to.equal(0);
      expect(afterAmount).to.equal(amount);

      //transfer token which are owned by mainContract using signer account[2] with transferFrom to account[1]
      await HTSTokenContract.connect(accounts[2].wallet).transferFrom(mainContract.target, accounts[1].wallet.address, amount, { gasLimit: 1_000_000 });
      await new Promise(r => setTimeout(r, 2000));
      expect(await HTSTokenContract.balanceOf(accounts[1].wallet.address)).to.be.equal(amount);

      {
        const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(HTSTokenContractAddress, accounts[1].wallet.address, { gasLimit: 1_000_000 });
        const [responseCodeRevokeKyc] = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
      }
      {
        const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(HTSTokenContractAddress, mainContract.target, { gasLimit: 1_000_000 });
        const [responseCodeRevokeKyc] = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
      }
    });

    it('should be able to execute setApprovalForAllPublic', async function() {
      const txBefore = (await mainContract.isApprovedForAllPublic(NftHTSTokenContractAddress, mainContractAddress, accounts[1].wallet.address));
      const txBeforeReceipt = await txBefore.wait();
      const [beforeFlag] = txBeforeReceipt.logs.filter(e => e.fragment.name === 'Approved')[0].args;
      const [responseCodeTxBefore] = txBeforeReceipt.logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
      expect(responseCodeTxBefore).to.equal(TX_SUCCESS_CODE);
  
      const tx = await mainContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, true, { gasLimit: 5_000_000 });
      const [responseCode] = (await tx.wait()).logs.filter(e => e?.fragment?.name === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);
  
      const txAfter = (await mainContract.isApprovedForAllPublic(NftHTSTokenContractAddress, mainContractAddress, accounts[1].wallet.address));
      const [afterFlag] = (await txAfter.wait()).logs.filter(e => e.fragment.name === 'Approved')[0].args;
  
      expect(beforeFlag).to.equal(false);
      expect(afterFlag).to.equal(true);
    });

    it('should be able to execute getApproved on nft', async function() {
      const tx = await mainContractReceiverWalletFirst.getApprovedPublic(NftHTSTokenContractAddress, NftSerialNumber, { gasLimit: 5_000_000 });
      const [responseCode] = (await tx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
      expect(responseCode).to.equal(TX_SUCCESS_CODE);
  
      const [approved] = (await tx.wait()).logs.filter(e => e.fragment.name === 'ApprovedAddress')[0].args;
      expect(approved).to.equal('0x0000000000000000000000000000000000000000');
    });

    it('should be able to transfer nft with transferFrom', async function() {
      expect(await NFTokenContract.balanceOf(accounts[0].wallet.address)).to.equal(BigInt(1));
      expect(await NFTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(BigInt(0));

      // grant KYC
      {
        const grantKycTx = await mainContractOwner.grantTokenKycPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
        const [responseCodeGrantKyc] = (await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);
      }
      {
        const grantKycTx = await mainContractOwner.grantTokenKycPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, { gasLimit: 1_000_000 });
        const [responseCodeGrantKyc] = (await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);
      }
      {
        const grantKycTx = await mainContractOwner.grantTokenKycPublic(NftHTSTokenContractAddress, mainContract.target, { gasLimit: 1_000_000 });
        const [responseCodeGrantKyc] = (await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);
      }

      //transfer NFT to contract address
      const tokenTransferList = [{
        token: `${NftHTSTokenContractAddress}`,
        transfers: [],
        nftTransfers: [{
          senderAccountID: `${accounts[0].wallet.address}`,
          receiverAccountID: `${mainContract.target}`,
          serialNumber: NftSerialNumber,
        },],
      }];
      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      expect((await txXfer.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      expect(await NFTokenContract.balanceOf(mainContract.target)).to.equal(BigInt(1));
      expect(await NFTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(BigInt(0));
      expect(await NFTokenContract.balanceOf(accounts[2].wallet.address)).to.equal(BigInt(0));

      //approval for accounts[2] to use this NFT
      await mainContract.approveNFTPublic(NftHTSTokenContractAddress, accounts[2].address, NftSerialNumber, { gasLimit: 1_000_000 });
      await new Promise(r => setTimeout(r, 2000));
      expect(await NFTokenContract.getApproved(NftSerialNumber)).to.equal(accounts[2].wallet.address);

      //transfer NFT to accounts[1] with accounts[2] as signer
      await NFTokenContract.connect(accounts[2].wallet).transferFrom(mainContract.target, accounts[1].wallet.address, NftSerialNumber, { gasLimit: 1_000_000 });
      await new Promise(r => setTimeout(r, 2000));
      expect(await NFTokenContract.balanceOf(mainContract.target)).to.equal(BigInt(0));
      expect(await NFTokenContract.balanceOf(accounts[1].wallet.address)).to.equal(BigInt(1));

      // revoking kyc for the next tests
      {
        const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(NftHTSTokenContractAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
        const [responseCodeRevokeKyc] = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
      }

      {
        const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, { gasLimit: 1_000_000 });
        const [responseCodeRevokeKyc] = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
      }

      {
        const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(NftHTSTokenContractAddress, mainContract.target, { gasLimit: 1_000_000 });
        const [responseCodeRevokeKyc] = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args;
        expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
      }
    });
  });

  describe('HTS Precompile Get Token Info Tests', async function() {
    it('should be able to get fungible token info', async () => {
      const tx = await mainContract.getFungibleTokenInfoPublic(HTSTokenContractAddress);
  
      const { tokenInfo, decimals } = (await tx.wait()).logs.filter(e => e.fragment.name === 'FungibleTokenInfo')[0].args[0];
  
      expect(tokenInfo.totalSupply).to.equal(BigInt(TOKEN_MAX_SUPPLY));
      expect(decimals).to.equal(BigInt(TOKEN_DECIMALS));
      expect(tokenInfo.token.maxSupply).to.equal(BigInt(TOKEN_MAX_SUPPLY));
      expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
      expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
    });
  
    it('should be able to get token info', async () => {
      const tx = await mainContract.getTokenInfoPublic(HTSTokenContractAddress);
  
      const { token, totalSupply } = (await tx.wait()).logs.filter(e => e.fragment.name === 'TokenInfo')[0].args[0];
  
      expect(totalSupply).to.equal(BigInt(TOKEN_MAX_SUPPLY));
      expect(token.maxSupply).to.equal(BigInt(TOKEN_MAX_SUPPLY));
      expect(token.name).to.equal(TOKEN_NAME);
      expect(token.symbol).to.equal(TOKEN_SYMBOL);
    });
  
    it('should be able to get non-fungible token info', async () => {
      const tx = await mainContract.getNonFungibleTokenInfoPublic(NftHTSTokenContractAddress, NftSerialNumber);
  
      const { tokenInfo, serialNumber } = (await tx.wait()).logs.filter(e => e.fragment.name === 'NonFungibleTokenInfo')[0].args[0];
  
      expect(Number(tokenInfo.totalSupply)).to.equal(NftSerialNumber);
      expect(Number(serialNumber)).to.equal(NftSerialNumber);
      expect(tokenInfo.token.name).to.equal(TOKEN_NAME);
      expect(tokenInfo.token.symbol).to.equal(TOKEN_SYMBOL);
    });
  });

  describe('HTS Precompile KYC Tests', async function() {
    async function checkKyc(contractOwner, tokenAddress, accountAddress, expectedValue: boolean) {
      const tx = await contractOwner.isKycPublic(tokenAddress, accountAddress, { gasLimit: 1_000_000 });
      const responseCodeIsKyc = (await tx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0];
      expect(responseCodeIsKyc).to.equal(TX_SUCCESS_CODE);
  
      const isKycGranted = (await tx.wait()).logs.filter(e => e.fragment.name === 'KycGranted')[0].args.kycGranted;
      expect(isKycGranted).to.equal(expectedValue);
    };

    async function checkTokenDefaultKYCStatus(contractOwner, tokenAddress, expectedValue: boolean) {
      const txTokenDefaultStatus = await contractOwner.getTokenDefaultKycStatusPublic(tokenAddress, { gasLimit: 1_000_000 });
      const responseCodeTokenDefaultStatus = (await txTokenDefaultStatus.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0];
      const defaultTokenKYCStatus = (await txTokenDefaultStatus.wait()).logs.filter(e => e.fragment.name === 'TokenDefaultKycStatus')[0].args.defaultKycStatus;
      expect(responseCodeTokenDefaultStatus).to.equal(TX_SUCCESS_CODE);
      expect(defaultTokenKYCStatus).to.equal(expectedValue);
    };

    it('should be able to get default KYC status for fungible token', async function() {
      await checkTokenDefaultKYCStatus(mainContractOwner, HTSTokenContractAddress, false);
    });

    it('should be able to get default KYC status for non fungible token', async function() {
      await checkTokenDefaultKYCStatus(mainContractOwner, NftHTSTokenContractAddress, false);
    });

    it('should be able to grant KYC, tranfer hts tokens and revoke KYC', async function() {
      // check if KYC is revoked
      await checkKyc(mainContractOwner, HTSTokenContractAddress, accounts[2].wallet.address, false);
  
      // grant KYC
      const grantKycTx = await mainContractOwner.grantTokenKycPublic(HTSTokenContractAddress, accounts[2].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeGrantKyc = (await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0];
      expect(responseCodeGrantKyc).to.equal(TX_SUCCESS_CODE);
  
      // check if KYC is granted
      await checkKyc(mainContractOwner, HTSTokenContractAddress, accounts[2].wallet.address, true);

      // transfer hts
      const amount = BigInt(10);
      const balanceBefore = await HTSTokenContract.balanceOf(accounts[2].wallet.address);
      await mainContract.connect(accounts[0].wallet).cryptoTransferTokenPublic(accounts[2].wallet.address, HTSTokenContractAddress, amount);
      await new Promise(r => setTimeout(r, 2000));
      const balanceAfter = await HTSTokenContract.balanceOf(accounts[2].wallet.address);
  
      expect(balanceBefore + amount).to.equal(balanceAfter);

      // revoke KYC
      const revokeKycTx = await mainContractOwner.revokeTokenKycPublic(HTSTokenContractAddress, accounts[2].wallet.address, { gasLimit: 1_000_000 });
      const responseCodeRevokeKyc = (await revokeKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0];
      expect(responseCodeRevokeKyc).to.equal(TX_SUCCESS_CODE);
  
      // check if KYC is revoked
      await checkKyc(mainContractOwner, HTSTokenContractAddress, accounts[2].wallet.address, false);
    });
  });

  describe('HTS Precompile Custom Fees Tests', async function() {
    it('should be able to get a custom token fees', async function() {
      const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[0].wallet);
  
      const tx = (await mainContract.getTokenCustomFeesPublic(HTSTokenWithCustomFeesContractAddress));
      const { fixedFees, fractionalFees } = (await tx.wait()).logs.filter(e => e.fragment.name === 'TokenCustomFees')[0].args;
  
      expect(fixedFees[0].amount).to.equal(BigInt(1));
      expect(fixedFees[0].tokenId).to.equal(HTSTokenContractAddress);
      expect(fixedFees[0].useHbarsForPayment).to.equal(false);
      expect(fixedFees[0].useCurrentTokenForPayment).to.equal(false);
  
      expect(fractionalFees[0].numerator).to.equal(BigInt(4));
      expect(fractionalFees[0].denominator).to.equal(BigInt(5));
      expect(fractionalFees[0].minimumAmount).to.equal(BigInt(10));
      expect(fractionalFees[0].maximumAmount).to.equal(BigInt(30));
      expect(fractionalFees[0].netOfTransfers).to.equal(false);
    });
  });

  describe('HTS Precompile Delete Token Tests', async function() {
    it('should be able to delete a token', async function() {
      const createdTokenAddress = await createHTSToken();
  
      const txBefore = (await mainContract.getTokenInfoPublic(createdTokenAddress, { gasLimit: 1000000 }));
      const tokenInfoBefore = (await txBefore.wait()).logs.filter(e => e.fragment.name === 'TokenInfo')[0].args.tokenInfo;
  
      const tx = await mainContract.deleteTokenPublic(createdTokenAddress);
      const responseCode = (await tx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0];
      expect(responseCode).to.equal(TX_SUCCESS_CODE);
  
      const txAfter = (await mainContract.getTokenInfoPublic(createdTokenAddress, { gasLimit: 1000000 }));
      const tokenInfoAfter = (await txAfter.wait()).logs.filter(e => e.fragment.name === 'TokenInfo')[0].args.tokenInfo;
  
      expect(tokenInfoBefore.deleted).to.equal(false);
      expect(tokenInfoAfter.deleted).to.equal(true);
    });
  });

  describe('CryptoTransfer Tests', async function() {
    let NftSerialNumber;
    let NftSerialNumber2;

    async function setKyc(tokenAddress) {
      const grantKycTx = await mainContractOwner.grantTokenKycPublic(tokenAddress, accounts[0].wallet.address, { gasLimit: 1_000_000 });
      expect((await grantKycTx.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      const grantKycTx1 = await mainContractOwner.grantTokenKycPublic(tokenAddress, accounts[1].wallet.address, { gasLimit: 1_000_000 });
      expect((await grantKycTx1.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      const grantKycTx2 = await mainContractOwner.grantTokenKycPublic(tokenAddress, accounts[2].wallet.address, { gasLimit: 1_000_000 });
      expect((await grantKycTx2.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
    }

    it('should be able to transfer fungible tokens', async function() {
      await setKyc(HTSTokenContractAddress);

      // setup the transfer
      const tokenTransferList = [{
        token: `${HTSTokenContractAddress}`,
        transfers: [
          {
            accountID: `${accounts[1].wallet.address}`,
            amount: 4,
          },
          {
            accountID: `${accounts[2].wallet.address}`,
            amount: 6,
          },
          {
            accountID: `${accounts[0].wallet.address}`,
            amount: -10,
          },
        ],
        nftTransfers: [],
      }];
      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      expect((await txXfer.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
    });

    it('should be able to transfer non-fungible tokens', async function() {
      await setKyc(NftHTSTokenContractAddress);
      // Mint an NFT
      const txMint = await mainContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x03', '0x04'], { gasLimit: 1_000_000 });
      expect((await txMint.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.be.equal(TX_SUCCESS_CODE);
      const serialNumbers = (await txMint.wait()).logs.filter(e => e.fragment.name === 'MintedToken')[0].args[1];
      NftSerialNumber = Number(serialNumbers[0]);
      NftSerialNumber2 = Number(serialNumbers[1]);

      // setup the transfer
      const tokenTransferList = [{
        token: `${NftHTSTokenContractAddress}`,
        transfers: [],
        nftTransfers: [{
          senderAccountID: `${accounts[0].wallet.address}`,
          receiverAccountID: `${accounts[1].wallet.address}`,
          serialNumber: NftSerialNumber,
        },
        {
          senderAccountID: `${accounts[0].wallet.address}`,
          receiverAccountID: `${accounts[2].wallet.address}`,
          serialNumber: NftSerialNumber2,
        }],
      }];
      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      expect((await txXfer.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
    });

    it('should be able to transfer both fungible and non-fungible tokens in single cryptoTransfer', async function() {
      // Mint an NFT
      const txMint = await mainContract.mintTokenPublic(NftHTSTokenContractAddress, 0, ['0x05'], { gasLimit: 1_000_000 });
      expect((await txMint.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.be.equal(TX_SUCCESS_CODE);
      const { serialNumbers } = (await txMint.wait()).logs.filter(e => e.fragment.name === 'MintedToken')[0].args;
      const NftSerialNumber = serialNumbers[0];

      // setup the transfer
      const tokenTransferList = [{
        token: `${NftHTSTokenContractAddress}`,
        transfers: [],
        nftTransfers: [{
          senderAccountID: `${accounts[0].wallet.address}`,
          receiverAccountID: `${accounts[1].wallet.address}`,
          serialNumber: NftSerialNumber,
        }],
      },
      {
        token: `${HTSTokenContractAddress}`,
        transfers: [
          {
            accountID: `${accounts[1].wallet.address}`,
            amount: 10,
          },
          {
            accountID: `${accounts[0].wallet.address}`,
            amount: -10,
          },
        ],
        nftTransfers: [],
      }];
      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      expect((await txXfer.wait()).logs.filter(e => e.fragment.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);
    });

    it('should fail to swap approved fungible tokens', async function() {
      const txApproval1 = await mainContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, true, { gasLimit: 1_000_000 });
      expect((await txApproval1.wait()).logs.filter(e => e?.fragment?.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      const txApproval2 = await mainContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[2].wallet.address, true, { gasLimit: 1_000_000 });
      expect((await txApproval2.wait()).logs.filter(e => e?.fragment?.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      // setup the transfer
      const tokenTransferList = [{
        token: `${HTSTokenContractAddress}`,
        transfers: [
          {
            accountID: `${accounts[1].wallet.address}`,
            amount: 2,
          },
          {
            accountID: `${accounts[2].wallet.address}`,
            amount: -2,
          },
          {
            accountID: `${accounts[1].wallet.address}`,
            amount: -2,
          },
          {
            accountID: `${accounts[2].wallet.address}`,
            amount: 2,
          },
        ],
        nftTransfers: [],
      }];

      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      await Assertions.expectRevert(txXfer, 'CALL_EXCEPTION');
    });

    it('should fail to swap approved non-fungible tokens', async function() {
      const txApprove1 = await mainContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[1].wallet.address, true, { gasLimit: 1_000_000 });
      expect((await txApprove1.wait()).logs.filter(e => e?.fragment?.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      const txApprove2 = await mainContract.setApprovalForAllPublic(NftHTSTokenContractAddress, accounts[2].wallet.address, true, { gasLimit: 1_000_000 });
      expect((await txApprove2.wait()).logs.filter(e => e?.fragment?.name === 'ResponseCode')[0].args[0]).to.equal(TX_SUCCESS_CODE);

      const tokenTransferList = [{
        token: `${NftHTSTokenContractAddress}`,
        transfers: [],
        nftTransfers: [{
          senderAccountID: `${accounts[1].wallet.address}`,
          receiverAccountID: `${accounts[2].wallet.address}`,
          serialNumber: NftSerialNumber,
        },
        {
          senderAccountID: `${accounts[2].wallet.address}`,
          receiverAccountID: `${accounts[1].wallet.address}`,
          serialNumber: NftSerialNumber2,
        }],
      }];

      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      await Assertions.expectRevert(txXfer, 'CALL_EXCEPTION');
    });

    it('should fail to transfer fungible and non-fungible tokens in a single tokenTransferList', async function() {
      // setup the transfer
      const xferAmount = 10;
      const tokenTransferList = [{
        token: `${NftHTSTokenContractAddress}`,
        transfers: [
          {
            accountID: `${accounts[1].wallet.address}`,
            amount: `${xferAmount}`,
          },
          {
            accountID: `${accounts[0].wallet.address}`,
            amount: `-${xferAmount}`,
          },
        ],
        nftTransfers: [{
          senderAccountID: `${accounts[0].wallet.address}`,
          receiverAccountID: `${accounts[1].wallet.address}`,
          serialNumber: NftSerialNumber,
        }],
      }];

      const txXfer = await mainContract.cryptoTransferPublic(tokenTransferList);
      await Assertions.expectRevert(txXfer, 'CALL_EXCEPTION');
    });
  });
});
