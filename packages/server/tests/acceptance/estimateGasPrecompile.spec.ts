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

import { ethers } from 'ethers';
import { expect } from 'chai';
import { Utils } from '../helpers/utils';
import EstimatePrecompileContractJson from '../contracts/EstimatePrecompileContract.json';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import { AliasAccount } from '../clients/servicesClient';
import constants from '../../../../packages/relay/src/lib/constants';
import Constants from '../../tests/helpers/constants';
import RelayCalls from '../../../../packages/server/tests/helpers/constants';
import { assert } from 'console';
import ERC721MockJson from '../contracts/ERC721Mock.json';

describe.only('EstimatePrecompileContract tests', function () {
  const signers: AliasAccount[] = [];
  const prefix = '0x';
  const SERVER_ERROR = 'SERVER_ERROR';
  const CALL_EXCEPTION = 'CALL_EXCEPTION';
  const UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION';
  let contract: ethers.Contract;
  let randomAddress: string;
  let contractReceipt;
  let EstimatePrecompileContractAddress;
  let ERC20Mock;
  let requestId;
  let tokenAddress;
  let nftAddress;
  let NftSerialNumber;
  let tokenContract;
  let mainContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let HTSTokenContract;
  let mainContract;
  let mainContractOwner;
  let mainContractReceiverWalletFirst;
  let estimateContractSigner0;
  let estimateContractSigner1;
  let estimateContractSigner2;
  let estimateContract;

  const TX_SUCCESS_CODE = BigInt(22);
  const accounts: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;

  async function createFungibleToken() {
    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    const tx = await estimateContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10_000_000,
    });

    const tokenAddress = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];
    return tokenAddress;
  }

  async function createNft() {
    const estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    const tx = await estimateContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10_000_000,
    });
    const tokenAddress = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];

    return tokenAddress;
  }

  async function mintNFT() {
    // Mint an NFT
    const tx = await estimateContract.mintTokenExternal(nftAddress, 0, ['0x02'], Constants.GAS.LIMIT_1_000_000);

    const serialNumbers = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.MintedToken,
    )[0].args[0];
    NftSerialNumber = Number(serialNumbers[0]);
    expect(NftSerialNumber).to.be.greaterThan(0);
    return NftSerialNumber;
  }

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    contractReceipt = await servicesNode.deployContract(EstimatePrecompileContractJson, 5_000_000);
    EstimatePrecompileContractAddress = contractReceipt.contractId.toSolidityAddress();

    //  const contractDeploy = await Utils.deployContractWithEthers([], EstimatePrecompileContractJson, signers[0].wallet, relay);
    //EstimatePrecompileContractAddress = contractDeploy.target.replace('0x', '');
    contract = new ethers.Contract(
      // Utils.add0xPrefix(contractDeploy.target),
      '0x' + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      signers[0].wallet,
    );

    requestId = Utils.generateRequestId();
    const contractMirror = await mirrorNode.get(`/contracts/${EstimatePrecompileContractAddress}`, requestId);

    accounts[0] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      200,
      relay.provider,
      requestId,
    );
    accounts[1] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      30,
      relay.provider,
      requestId,
    );
    accounts[2] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      30,
      relay.provider,
      requestId,
    );

    contract = new ethers.Contract(
      '0x' + EstimatePrecompileContractAddress,
      // Utils.add0xPrefix(contractDeploy.target),
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    // Create token and nft contracts
    tokenAddress = await createFungibleToken();
    nftAddress = await createNft();
    tokenContract = new ethers.Contract(tokenAddress, EstimatePrecompileContractJson.abi, accounts[0].wallet);

    // Associate token and nft to accounts
    /*estimateContractSigner0 = new ethers.Contract("0x" + EstimatePrecompileContractAddress, EstimatePrecompileContractJson.abi, accounts[0].wallet);
        console.log("This is estimateContractSigner0" + estimateContractSigner0)
        const tx1 = await estimateContractSigner0.associateTokenExternal(
            "0x" + EstimatePrecompileContractAddress,
            tokenAddress,
            Constants.GAS.LIMIT_1_000_000,
        );
        expect(
            (await tx1.wait()).logs.filter((e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args[0]
        ).to.equal(TX_SUCCESS_CODE);
        console.log("This is tx1 " + tx1);
*/
    estimateContractSigner1 = new ethers.Contract(
      '0x' + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[1].wallet,
    );
    const tx1_ft = await estimateContractSigner1.associateTokenExternal(
      accounts[1].wallet.address,
      tokenAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    estimateContractSigner2 = new ethers.Contract(
      '0x' + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[2].wallet,
    );
    const tx2_ft = await estimateContractSigner2.associateTokenExternal(
      accounts[2].wallet.address,
      tokenAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    estimateContractSigner1 = new ethers.Contract(
      '0x' + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[1].wallet,
    );
    const t1_nft = await estimateContractSigner1.associateTokenExternal(
      accounts[1].wallet.address,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    estimateContractSigner2 = new ethers.Contract(
      '0x' + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[2].wallet,
    );
    const tx2_nft = await estimateContractSigner2.associateTokenExternal(
      accounts[2].wallet.address,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    await new Promise((r) => setTimeout(r, 2500));
    //NFT
    await contract.grantTokenKycExternal(nftAddress, accounts[0].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[1].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[2].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, '0x' + EstimatePrecompileContractAddress, { gasLimit: 500_000 });

    //fungible
    await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[1].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[2].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, '0x' + EstimatePrecompileContractAddress, { gasLimit: 500_000 });
    /*
        console.log("This is tx2 " + tx2);
        expect(
            (await tx2.wait()).logs.filter((e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args[0]
        ).to.equal(TX_SUCCESS_CODE);

        estimateContractSigner0 = new ethers.Contract("0x" + EstimatePrecompileContractAddress, EstimatePrecompileContractJson.abi, accounts[0].wallet);
        const tx3 = await estimateContractSigner0.associateTokenExternal(
            "0x" + EstimatePrecompileContractAddress,
            nftAddress,
            Constants.GAS.LIMIT_1_000_000,
        );
        console.log("This is tx3 " + tx3);
        expect(
            (await tx3.wait()).logs.filter((e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args[0]
        ).to.equal(TX_SUCCESS_CODE);

        estimateContractSigner1 = new ethers.Contract("0x" + EstimatePrecompileContractAddress, EstimatePrecompileContractJson.abi, accounts[1].wallet);
        const tx4 = await estimateContractSigner1.associateTokenExternal(
            accounts[1].wallet.address,
            nftAddress,
            Constants.GAS.LIMIT_1_000_000,
        );
        console.log("This is tx4 " + tx4);
        expect(
            (await tx4.wait()).logs.filter((e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args[0]
        ).to.equal(TX_SUCCESS_CODE); */
  });
  const baseGasCheck = (estimatedGasValue, expectedValue: number) => {
    // handle deviation of 20%
    expect(Number(estimatedGasValue)).to.be.lessThan(expectedValue * 1.4);
  };

  it('test', async function () {
    expect(true).to.be.true;
  });

  //EGP-001
  it('should call estimateGas with associate function for fungible token', async function () {
    console.log('this is estimate pr contract: ' + EstimatePrecompileContractAddress);
    console.log('this is signer0 address: ' + accounts[0].wallet.address);
    console.log('this is signer1 address: ' + accounts[1].wallet.address);
    console.log('this is token address: ' + tokenAddress);
    console.log('this is nft address: ' + nftAddress);
    console.log('this is the estimate pr contract: ' + EstimatePrecompileContractAddress);
    const tx = await contract.associateTokenExternal.populateTransaction(signers[0].address, tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-002
  it('should call estimateGas with associate function for NFT', async function () {
    const tx = await contract.associateTokenExternal.populateTransaction(signers[0].address, nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-003
  it('should call estimateGas with dissociate token function without association for fungible token - negative', async function () {
    const tx = await contract.dissociateTokenExternal.populateTransaction(
      prefix + EstimatePrecompileContractAddress,
      tokenAddress,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-004
  it('should call estimateGas with dissociate token function without association for NFT - negative', async function () {
    const tx = await contract.dissociateTokenExternal.populateTransaction(
      prefix + EstimatePrecompileContractAddress,
      nftAddress,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-005
  it('should call estimateGas with nested associate function that executes it twice for fungible token - negative', async function () {
    const tx = await contract.nestedAssociateTokenExternal.populateTransaction(
      prefix + EstimatePrecompileContractAddress,
      tokenAddress,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-006
  it('should call estimateGas with nested associate function that executes it twice for NFT - negative', async function () {
    const tx = await contract.nestedAssociateTokenExternal.populateTransaction(
      prefix + EstimatePrecompileContractAddress,
      nftAddress,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-007
  it('should call estimateGas with approve function without association - negative', async function () {
    let amount = 1;
    const tx = await contract.approveExternal.populateTransaction(tokenAddress, accounts[0].wallet.address, amount);
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-008
  it('should call estimateGas with approveNFT function without association - negative', async function () {
    const tx = await contract.approveNFTExternal.populateTransaction(nftAddress, accounts[1].wallet.address, 1);
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-009
  it('should call estimateGas with dissociate token function for fungible token', async function () {
    // Associate fungible token to account
    estimateContractSigner0 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    await estimateContractSigner0.associateTokenExternal(
      prefix + EstimatePrecompileContractAddress,
      tokenAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    const tx = await contract.dissociateTokenExternal.populateTransaction(estimateContractSigner0, tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 785119);
  });

  //EGP-010
  it('should call estimateGas with dissociate token function for NFT', async function () {
    // Associate NFT token to account
    estimateContractSigner0 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    await estimateContractSigner0.associateTokenExternal(
      prefix + EstimatePrecompileContractAddress,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    const tx = await contract.dissociateTokenExternal.populateTransaction(estimateContractSigner0, nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 785119);
  });

  //EGP-011
  it('should call estimateGas with dissociate and associate nested function for fungible token', async function () {
    const tx = await contract.dissociateAndAssociateTokenExternal.populateTransaction(signers[0].address, tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 1540734);
  });

  //EGP-012
  it('should call estimateGas with dissociate and associate nested function for NFT', async function () {
    const tx = await contract.dissociateAndAssociateTokenExternal.populateTransaction(signers[0].address, nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 1540734);
  });

  //EGP-013
  it('should call estimateGas with setApprovalForAll function without association - negative', async function () {
    const tx = await contract.setApprovalForAllExternal.populateTransaction(
      accounts[1].wallet.address,
      tokenAddress,
      true,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-014
  it('should call estimateGas with approve function', async function () {
    const amount = 1;
    const tx = await contract.approveExternal.populateTransaction(tokenAddress, accounts[1].wallet.address, amount);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-015
  it('should call estimateGas with approveNFT function', async function () {
    const nftSerial = 1;
    // Associate NFT to account
    estimateContractSigner0 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[1].wallet,
    );
    estimateContractSigner0.associateTokenExternal(
      prefix + EstimatePrecompileContractAddress,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );

    const tx = await contract.approveNFTExternal.populateTransaction(accounts[0].wallet.address, nftAddress, nftSerial);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-016
  xit('should call estimateGas with setApprovalForAll function', async function () {
    // e31b839c

    const tx = await contract.setApprovalForAllExternal.populateTransaction(
      nftAddress,
      accounts[1].wallet.address,
      true,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-017 //temp disabled due to spam in the log
  xit('should call estimateGas with transferFromNFT function', async function () {
    // 9bc4d35

    const nftSerial = await mintNFT();
    const NFTokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const appp2 = await NFTokenContract.setApprovalForAll(contract.target, nftSerial, { gasLimit: 5_000_000 });
    await appp2.wait();

    const tx = await contract.transferFromNFTExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-018
  it('should call estimateGas with transferFrom function without approval - negative', async function () {
    const tx = await contract.transferFromExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
      1,
    );
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-019 //Excluded due to a bug
  it.only('should call estimateGas with transferFrom function', async function () {
    let amount = 1;
    let account0Wallet = await mirrorNode.get(`/accounts/${accounts[0].wallet.address}`, requestId);
    let account1Wallet = await mirrorNode.get(`/accounts/${accounts[1].wallet.address}`, requestId);

    let account0LongZero = Utils.idToEvmAddress(account0Wallet.account);
    console.log('This is account0LongZero:' + account0LongZero);
    let account1LongZero = Utils.idToEvmAddress(account1Wallet.account);
    console.log('This is account1LongZero:' + account1LongZero);

    const ERC20Contract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    console.log(await ERC20Contract.balanceOf(contract.target));
    console.log(await ERC20Contract.balanceOf(accounts[0].wallet.address));
    console.log(await ERC20Contract.balanceOf(accounts[1].wallet.address));
    //which has ballance - from this
    //to contract.target
    const erc20Accounts0 = ERC20Contract.connect(accounts[0].wallet);
    // @ts-ignore
    const tx1 = await erc20Accounts0.approve(contract.target, 2);
    await tx1.wait();

    const allowance = await ERC20Contract.allowance(accounts[0].wallet.address, contract.target);
    console.log(allowance);
    await new Promise((r) => setTimeout(r, 5000));
    //then this approveExternal
    // await contract.approveExternal(tokenAddress, accounts[1].wallet.address, amount);
    console.log(await ERC20Contract.balanceOf(contract.target));
    console.log(await ERC20Contract.balanceOf(accounts[0].wallet.address));
    console.log(await ERC20Contract.balanceOf(accounts[1].wallet.address));

    await new Promise((r) => setTimeout(r, 5000));
    console.log(await ERC20Contract.balanceOf(contract.target));
    console.log(await ERC20Contract.balanceOf(accounts[0].wallet.address));
    console.log(await ERC20Contract.balanceOf(accounts[1].wallet.address));

    const tx2 = await contract.transferFromExternal.populateTransaction(
      tokenAddress,
      account0LongZero,
      account1LongZero,
      amount,
    );
    console.log('This is tx2 : ' + tx2);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx2]);
    console.log(estimateGasResponse);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-020
  it('should call estimateGas with transferFrom function with more than the approved allowance - negative', async function () {
    //approved 1 in the previous test so amount defined is higher
    let amount = 10;

    const tx = await contract.transferFromExternal.populateTransaction(
      tokenAddress,
      contract.target,
      accounts[0].wallet.address,
      amount,
    );
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-021
  it('should call estimateGas with transferFromNFT with invalid serial number - negative', async function () {
    let wrongNFTSerial = 10;

    const tx = await contract.transferFromNFTExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
      wrongNFTSerial,
    );
    negativeScenarioVerification(tx, SERVER_ERROR);
  });

  //EGP-022
  it('should call estimateGas with transferToken function', async function () {
    console.log('this is estimate pr contract: ' + EstimatePrecompileContractAddress);
    console.log('this is signer0 address: ' + accounts[0].wallet.address);
    console.log('this is signer1 address: ' + accounts[1].wallet.address);
    console.log('this is token address: ' + tokenAddress);
    console.log('this is nft address: ' + nftAddress);
    let amount = 1;
    const tx = await contract.transferTokenExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
      amount,
    );
    console.log('data ' + tx);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 43265);
  });

  async function negativeScenarioVerification(tx, errorMessage: string) {
    let failed = false;
    let estimateGasResponse;
    try {
      estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    } catch (e) {
      expect(e.code).to.eq(errorMessage);
      failed = true;
    }
    expect(failed).to.be.true;
    return estimateGasResponse;
  }
});
