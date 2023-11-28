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

import { encodeBytes32String, ethers } from 'ethers';
import { expect } from 'chai';
import { Utils } from '../helpers/utils';
import { AliasAccount } from '../clients/servicesClient';
import EstimatePrecompileContractJson from '../contracts/EstimatePrecompileContract.json';
import ERC20MockJson from '../contracts/ERC20Mock.json';
import Constants from '../../tests/helpers/constants';
import RelayCalls from '../../../../packages/server/tests/helpers/constants';
import ERC721MockJson from '../contracts/ERC721Mock.json';
import { maxGasLimit } from '@hashgraph/json-rpc-relay/tests/helpers';
import { create } from 'ts-node';

describe('EstimatePrecompileContract tests', function () {
  const signers: AliasAccount[] = [];
  const prefix = '0x';
  const CALL_EXCEPTION = 'CALL_EXCEPTION';
  let contract: ethers.Contract;
  let contractAccount1: ethers.Contract;
  //  let contract1: ethers.Contract;

  let contractReceipt;
  let EstimatePrecompileContractAddress;
  let requestId;
  let tokenAddress;
  let nftAddress;
  let NftSerialNumber;
  let estimateContractSigner0;
  let estimateContractSigner1;
  let estimateContractSigner2;
  let estimateContractSigner3;
  let estimateContractSigner4;
  let estimateContract;
  let lowerPercentBound = 5;
  let upperPercentBound = 30;

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
    signers[1] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    contractReceipt = await servicesNode.deployContract(EstimatePrecompileContractJson, 5_000_000);
    EstimatePrecompileContractAddress = contractReceipt.contractId.toSolidityAddress();

    contract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
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
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    accounts[3] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      30,
      relay.provider,
      requestId,
    );

    accounts[4] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      30,
      relay.provider,
      requestId,
    );

    // Create contract signers
    tokenAddress = await createFungibleToken();
    nftAddress = await createNft();

    estimateContractSigner0 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    estimateContractSigner1 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[1].wallet,
    );

    estimateContractSigner2 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[2].wallet,
    );

    estimateContractSigner3 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[3].wallet,
    );

    estimateContractSigner4 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[4].wallet,
    );

    //Associating accounts[2] and accounts[3] with fungible token and NFT
    const tx2_ft = await estimateContractSigner2.associateTokenExternal(
      accounts[2].wallet.address,
      tokenAddress,
      Constants.GAS.LIMIT_1_000_000,
    );
    await tx2_ft.wait();

    const tx2_nft = await estimateContractSigner2.associateTokenExternal(
      accounts[2].wallet.address,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );
    await tx2_nft.wait();

    const tx3_ft = await estimateContractSigner3.associateTokenExternal(
      accounts[3].wallet.address,
      tokenAddress,
      Constants.GAS.LIMIT_1_000_000,
    );
    await tx3_ft.wait();

    const tx3_nft = await estimateContractSigner3.associateTokenExternal(
      accounts[3].wallet.address,
      nftAddress,
      Constants.GAS.LIMIT_1_000_000,
    );
    await tx3_nft.wait();

    //NFT
    await contract.grantTokenKycExternal(nftAddress, accounts[0].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[1].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[2].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[3].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, accounts[4].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(nftAddress, prefix + EstimatePrecompileContractAddress, { gasLimit: 500_000 });

    //Fungible
    await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[1].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[2].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[3].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[4].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, prefix + EstimatePrecompileContractAddress, {
      gasLimit: 500_000,
    });
  });

  const baseGasCheck = (estimatedGasValue, expectedValue: number) => {
    // handle deviation of 20%
    expect(Number(estimatedGasValue)).to.be.lessThan(expectedValue * 1.4);
  };

  const isWithinDeviation = (
    actualGasUsed: bigint,
    expectedGasUsed: number,
    lowerPercentBound: number,
    upperPercentBound: number,
  ) => {
    let lowerDeviation = (Number(actualGasUsed) * lowerPercentBound) / 100;
    let upperDeviation = (Number(actualGasUsed) * upperPercentBound) / 100;
    let lowerBound = Number(actualGasUsed) + lowerDeviation;
    let upperBound = Number(actualGasUsed) + upperDeviation;
    expect(Number(expectedGasUsed)).to.be.within(
      lowerBound,
      upperBound,
      'expectedGasUsed is not within the deviation of ' + lowerBound + ' to ' + upperBound,
    );
  };

  //EGP-001
  it('should call estimateGas with associate function for fungible token', async function () {
    const tx = await estimateContractSigner1.associateTokenExternal.populateTransaction(
      accounts[1].wallet.address,
      tokenAddress,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const gasResult = await associateAcc(estimateContractSigner1, accounts[1].wallet.address, tokenAddress);
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-002
  it('should call estimateGas with associate function for NFT', async function () {
    const tx = await estimateContractSigner1.associateTokenExternal.populateTransaction(
      accounts[1].wallet.address,
      nftAddress,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const gasResult = await associateAcc(estimateContractSigner1, accounts[1].wallet.address, nftAddress);
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-003
  it('should call estimateGas with dissociate token function without association for fungible token - negative', async function () {
    const tx = await contract.dissociateTokenExternal.populateTransaction(accounts[0].wallet.address, tokenAddress);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-004
  it('should call estimateGas with dissociate token function without association for NFT - negative', async function () {
    const tx = await contract.dissociateTokenExternal.populateTransaction(accounts[0].wallet.address, nftAddress);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-005
  it('should call estimateGas with nested associate function that executes it twice for fungible token - negative', async function () {
    //should associate
    const tx = await contract.nestedAssociateTokenExternal.populateTransaction(
      accounts[0].wallet.address,
      tokenAddress,
    );
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-006
  it('should call estimateGas with nested associate function that executes it twice for NFT - negative', async function () {
    const tx = await contract.nestedAssociateTokenExternal.populateTransaction(accounts[0].wallet.address, nftAddress);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-007
  it('should call estimateGas with approve function without association - negative', async function () {
    let amount = 1;
    const tx = await contract.approveExternal.populateTransaction(tokenAddress, accounts[0].wallet.address, amount);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-008
  it('should call estimateGas with approveNFT function without association - negative', async function () {
    const nftSerial = await mintNFT();
    const tx = await contract.approveNFTExternal.populateTransaction(nftAddress, accounts[0].wallet.address, nftSerial);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-009
  it('should call estimateGas with dissociate token function for fungible token', async function () {
    const tx = await estimateContractSigner1.dissociateTokenExternal.populateTransaction(
      accounts[1].wallet.address,
      tokenAddress,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const gasResult = await dissociateAcc(estimateContractSigner1, accounts[1].wallet.address, tokenAddress);
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-010
  it('should call estimateGas with dissociate token function for NFT', async function () {
    const tx = await estimateContractSigner1.dissociateTokenExternal.populateTransaction(
      accounts[1].wallet.address,
      nftAddress,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const gasResult = await dissociateAcc(estimateContractSigner1, accounts[1].wallet.address, nftAddress);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-011
  it('should call estimateGas with dissociate and associate nested function for fungible token', async function () {
    const tx = await contract.dissociateAndAssociateTokenExternal.populateTransaction(
      accounts[3].wallet.address,
      tokenAddress,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await contract.dissociateAndAssociateTokenExternal(accounts[3].wallet.address, tokenAddress);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-012
  it('should call estimateGas with dissociate and associate nested function for NFT', async function () {
    const tx = await contract.dissociateAndAssociateTokenExternal.populateTransaction(
      accounts[3].wallet.address,
      nftAddress,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await contract.dissociateAndAssociateTokenExternal(accounts[3].wallet.address, nftAddress);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-013
  it('should call estimateGas with setApprovalForAll function without association - negative', async function () {
    const tx = await contract.setApprovalForAllExternal.populateTransaction(
      tokenAddress,
      accounts[1].wallet.address,
      true,
    );
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-014
  it('should call estimateGas with approve function', async function () {
    const amount = 10;
    let spender = prefix + EstimatePrecompileContractAddress;

    await associateAcc(estimateContractSigner1, spender, tokenAddress);
    const gasResult = await approveAcc(estimateContractSigner0, tokenAddress, spender, amount);

    const tx = await estimateContractSigner0.approveExternal.populateTransaction(tokenAddress, spender, amount);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-016
  it('should call estimateGas with setApprovalForAll function', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    await associateAcc(estimateContractSigner1, spender, nftAddress);

    const txResult = await estimateContractSigner0.setApprovalForAllExternal(
      nftAddress,
      accounts[1].wallet.address,
      true,
    );
    const gasResult = await txResult.wait();

    const tx = await estimateContractSigner0.setApprovalForAllExternal.populateTransaction(
      nftAddress,
      accounts[1].wallet.address,
      true,
    );
    await new Promise((r) => setTimeout(r, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
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

  //EGP-019 //The test is excluded due to a bug in the Mirror-node https://github.com/hashgraph/hedera-mirror-node/issues/7192
  it.skip('should call estimateGas with transferFrom function', async function () {
    let amount = 1;
    let account0Wallet = await mirrorNode.get(`/accounts/${accounts[0].wallet.address}`, requestId);
    let account1Wallet = await mirrorNode.get(`/accounts/${accounts[1].wallet.address}`, requestId);

    let account0LongZero = Utils.idToEvmAddress(account0Wallet.account);
    let account1LongZero = Utils.idToEvmAddress(account1Wallet.account);

    const ERC20Contract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

    const erc20Accounts0 = ERC20Contract.connect(accounts[0].wallet);
    // @ts-ignore
    const tx1 = await erc20Accounts0.approve(contract.target, 2);
    await tx1.wait();

    const allowance = await ERC20Contract.allowance(accounts[0].wallet.address, contract.target);
    await new Promise((r) => setTimeout(r, 5000));
    await contract.approveExternal(tokenAddress, accounts[1].wallet.address, amount);

    await new Promise((r) => setTimeout(r, 5000));
    const tx2 = await contract.transferFromExternal.populateTransaction(
      tokenAddress,
      account0LongZero,
      account1LongZero,
      amount,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx2]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //EGP-020
  it('should call estimateGas with transferFrom function with more than the approved allowance - negative', async function () {
    let amount = 100;

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
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-022
  it('should call estimateGas with transferToken function', async function () {
    let amount = 1;

    const tx = await contract.transferTokenExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      amount,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.transferTokenExternal(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      amount,
    );
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-023
  it('should call estimateGas with transferNFT function', async function () {
    let nftSerial = await mintNFT();

    const tx = await contract.transferNFTExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      nftSerial,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await contract.transferNFTExternal(
      nftAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      nftSerial,
    );
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-029
  it('should call estimateGas with associateTokens function for fungible token', async function () {
    await new Promise((r) => setTimeout(r, 5000));
    const tokens: String[] = [tokenAddress];

    const tx = await estimateContractSigner4.associateTokensExternal.populateTransaction(
      accounts[4].wallet.address,
      tokens,
    );
    await new Promise((r) => setTimeout(r, 5000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner4.associateTokensExternal(accounts[4].wallet.address, tokens);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-030
  it('should call estimateGas with associateTokens function for NFT', async function () {
    const tokens: String[] = [nftAddress];

    const tx = await estimateContractSigner1.associateTokensExternal.populateTransaction(
      accounts[1].wallet.address,
      tokens,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner1.associateTokensExternal(accounts[1].wallet.address, tokens);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  // EGP-031
  it('should call estimateGas with dissociateTokens function for fungible token', async function () {
    const tokens: String[] = [tokenAddress];

    const tx = await estimateContractSigner4.dissociateTokensExternal.populateTransaction(
      accounts[4].wallet.address,
      tokens,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner4.dissociateTokensExternal(accounts[4].wallet.address, tokens);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-032
  it('should call estimateGas with dissociateTokens function for NFT', async function () {
    const tokens: String[] = [nftAddress];

    const tx = await estimateContractSigner1.dissociateTokensExternal.populateTransaction(
      accounts[1].wallet.address,
      tokens,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner1.dissociateTokensExternal(accounts[1].wallet.address, tokens);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-033
  it('should call estimateGas with transferTokens function for fungible token', async function () {
    const amounts: Number[] = [-10, 10];
    const tokens: String[] = [tokenAddress];
    const transferAccounts: String[] = [accounts[0].wallet.address, accounts[2].wallet.address];

    const tx = await estimateContractSigner0.transferTokensExternal.populateTransaction(
      tokenAddress,
      transferAccounts,
      amounts,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractSigner0.transferTokensExternal(tokenAddress, transferAccounts, amounts);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-034
  it('should call estimateGas with transferNFTs function', async function () {
    let nftSerial = await mintNFT();
    let nftSerial2 = await mintNFT();
    const serialNumbers: Number[] = [nftSerial, nftSerial2];
    const receiverAccounts: String[] = [accounts[2].wallet.address, accounts[3].wallet.address];
    const senderAccounts: String[] = [accounts[0].wallet.address];

    const tx = await contract.transferNFTsExternal.populateTransaction(
      nftAddress,
      senderAccounts,
      receiverAccounts,
      serialNumbers,
    );

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.transferNFTsExternal(nftAddress, senderAccounts, receiverAccounts, serialNumbers);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-038
  it('should call estimateGas with mintToken function for fungible token', async function () {
    const txResult = await contract.mintTokenExternal(tokenAddress, 0, ['0x02']);
    const gasResult = await txResult.wait();

    const tx = await contract.mintTokenExternal.populateTransaction(tokenAddress, 0, ['0x02']);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-039
  it('should call estimateGas with mintToken function for NFT', async function () {
    const txResult = await contract.mintTokenExternal(nftAddress, 0, ['0x02']);
    const gasResult = await txResult.wait();

    const tx = await contract.mintTokenExternal.populateTransaction(nftAddress, 0, ['0x02']);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-040
  it('should call estimateGas with burnToken function for fungible token', async function () {
    const txResult = await contract.burnTokenExternal(tokenAddress, 0, ['0x02']);
    const gasResult = await txResult.wait();

    const tx = await contract.burnTokenExternal.populateTransaction(tokenAddress, 0, ['0x02']);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-042
  it('should call estimateGas with burnToken function for NFT', async function () {
    const nftSerial = await mintNFT();
    const serialNumbers: Number[] = [nftSerial];
    const tx = await contract.burnTokenExternal.populateTransaction(nftAddress, 0, serialNumbers);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await contract.burnTokenExternal(nftAddress, 0, serialNumbers);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-051
  it('should call estimateGas with grantTokenKycExternal function for fungible token', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(tokenAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-052
  it('should call estimateGas with grantTokenKycExternal function for NFT', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(nftAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(nftAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-053
  it('should call estimateGas with revokeTokenKycExternal function for fungible token', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(tokenAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-054
  it('should call estimateGas with revokeTokenKycExternal function for NFT', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(nftAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(nftAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-055
  it('should call estimateGas with Grant and Revoke KYC nested function', async function () {
    const tx = await contract.nestedGrantAndRevokeTokenKYCExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.nestedGrantAndRevokeTokenKYCExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-056
  it('should call estimateGas with Freeze function for fungible token', async function () {
    const tx = await contract.freezeTokenExternal.populateTransaction(tokenAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.freezeTokenExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-057
  it('should call estimateGas with Freeze function for NFT', async function () {
    const tx = await contract.freezeTokenExternal.populateTransaction(nftAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.freezeTokenExternal(nftAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-058
  it('should call estimateGas with Unfreeze function for fungible token', async function () {
    const tx = await contract.unfreezeTokenExternal.populateTransaction(tokenAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.unfreezeTokenExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-059
  it('should call estimateGas with Unfreeze function for NFT', async function () {
    const tx = await contract.unfreezeTokenExternal.populateTransaction(nftAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.unfreezeTokenExternal(nftAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-060
  it('should call estimateGas with Nested Freeze and Unfreeze function for fungible token', async function () {
    const tx = await contract.nestedFreezeUnfreezeTokenExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.nestedFreezeUnfreezeTokenExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-061
  it('should call estimateGas with nested Freeze and Unfreeze function for NFT', async function () {
    const tx = await contract.nestedFreezeUnfreezeTokenExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.nestedFreezeUnfreezeTokenExternal(nftAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-062
  it('should call estimateGas with delete function for fungible token', async function () {
    const tx = await contract.deleteTokenExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.deleteTokenExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-063
  it('should call estimateGas with delete function for NFT', async function () {
    const tx = await contract.deleteTokenExternal.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.deleteTokenExternal(nftAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
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

  async function associateAcc(contractSigner, account, token) {
    const txResult = await contractSigner.associateTokenExternal(account, token);
    const gasResult = await txResult.wait();
    return gasResult;
  }

  async function dissociateAcc(contractSigner, account, token) {
    const txResult = await contractSigner.dissociateTokenExternal(account, token);
    const gasResult = await txResult.wait();
    return gasResult;
  }

  async function approveAcc(contractSigner, token, spender, amount) {
    const txResult = await contractSigner.approveExternal(token, spender, amount);
    const gasResult = await txResult.wait();
    return gasResult;
  }
});
