/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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
import ERCTestContractJson from '../contracts/ERCTestContract.json';
import PrecompileTestContractJson from '../contracts/PrecompileTestContract.json';

describe.only('EstimatePrecompileContract tests', function () {
  const signers: AliasAccount[] = [];
  const prefix = '0x';
  const CALL_EXCEPTION = 'CALL_EXCEPTION';
  let contract: ethers.Contract;
  let contractAccount1: ethers.Contract;

  let contractReceipt;
  let EstimatePrecompileContractAddress;
  let requestId;
  let tokenAddress;
  let nftAddress;
  let nftSerialNumber;
  let estimateContractSigner0;
  let estimateContractSigner1;
  let estimateContractSigner2;
  let estimateContractSigner3;
  let estimateContractSigner4;
  let nftTokenContract;
  let tokenContract;
  let precompileTestContract;
  let estimateContract;
  let lowerPercentBound = 5;
  let upperPercentBound = 30;
  let ERCcontractReceipt;
  let ERCEstimatePrecompileContractAddress;
  let ERCContract: ethers.Contract;
  let estimateContractAc0;
  let PrecompileContractReceipt;
  let PrecompileContractAddress;

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
    nftSerialNumber = Number(serialNumbers[0]);
    expect(nftSerialNumber).to.be.greaterThan(0);
    return nftSerialNumber;
  }

  before(async function () {
    signers[0] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());
    signers[1] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    contractReceipt = await servicesNode.deployContract(
      EstimatePrecompileContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    EstimatePrecompileContractAddress = contractReceipt.contractId.toSolidityAddress();

    ERCcontractReceipt = await servicesNode.deployContract(
      ERCTestContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    ERCEstimatePrecompileContractAddress = ERCcontractReceipt.contractId.toSolidityAddress();

    PrecompileContractReceipt = await servicesNode.deployContract(
      PrecompileTestContractJson,
      Constants.GAS_AS_NUMBER.LIMIT_5_000_000,
    );
    PrecompileContractAddress = PrecompileContractReceipt.contractId.toSolidityAddress();

    contract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      signers[0].wallet,
    );

    //ERC Contract
    ERCContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      ERCTestContractJson.abi,
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

    tokenAddress = await createFungibleToken();
    nftAddress = await createNft();

    // Create contracts with signers
    estimateContractAc0 = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

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

    nftTokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);

    tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

    precompileTestContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
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
    await contract.grantTokenKycExternal(nftAddress, accounts[0].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(nftAddress, accounts[1].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(nftAddress, accounts[2].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(nftAddress, accounts[3].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(nftAddress, accounts[4].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(
      nftAddress,
      prefix + EstimatePrecompileContractAddress,
      Constants.GAS.LIMIT_500_000,
    );

    //Fungible
    await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(tokenAddress, accounts[1].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(tokenAddress, accounts[2].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(tokenAddress, accounts[3].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(tokenAddress, accounts[4].wallet.address, Constants.GAS.LIMIT_500_000);
    await contract.grantTokenKycExternal(tokenAddress, prefix + EstimatePrecompileContractAddress, {
      gasLimit: 500_000,
    });
  });

  const baseGasCheck = (estimatedGasValue, expectedValue: number) => {
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

  const isEqualWithDeviation = (actualGasUsed: bigint, expectedGasUsed: number, percentDeviation: number) => {
    let deviation = (Number(actualGasUsed) * percentDeviation) / 100;
    let lowerBound = Number(actualGasUsed) - deviation;
    let upperBound = Number(actualGasUsed) + deviation;
    expect(Number(expectedGasUsed)).to.be.within(
      lowerBound,
      upperBound,
      'expectedGasUsed is not within the deviation of ' + lowerBound + ' to ' + upperBound,
    );
  };

  //EGP-125
  it('should call estimateGas with transferRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    let precompiletTestContractAssociate = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const associateTx = await precompiletTestContractAssociate.associateTokenExternal(spender, tokenAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();
    const grantTokenKYCTx = await estimateContractSigner0.grantTokenKycExternal(tokenAddress, spender, {
      gasLimit: 1_000_000,
    });
    await grantTokenKYCTx.wait();

    const approveTx = await tokenContract.approve(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await approveTx.wait();

    const transferTx = await tokenContract.transfer(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await transferTx.wait();

    const tx = await precompileTestContract.transferRedirect.populateTransaction(
      tokenAddress,
      accounts[2].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_TRANSFER),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP 126
  it('should call estimateGas with transferFromRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    const nftApproveTx = await tokenContract.approve(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await nftApproveTx.wait();

    const tx = await precompileTestContract.transferFromRedirect.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[3].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_TRANSFER_FROM),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-127
  it('should call estimateGas with approveRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    const grantTokenKYCTx = await estimateContractSigner0.grantTokenKycExternal(tokenAddress, spender, {
      gasLimit: 1_000_000,
    });
    await grantTokenKYCTx.wait();
    const approveTx = await tokenContract.approve(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await approveTx.wait();
    const transferTx = await tokenContract.transfer(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await transferTx.wait();

    const associateTx = await estimateContractSigner4.associateTokenExternal(accounts[4].wallet.address, tokenAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();

    const tx = await precompileTestContract.approveRedirect.populateTransaction(
      tokenAddress,
      accounts[4].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const disociateResult = await estimateContractSigner4.dissociateTokenExternal(
      accounts[4].wallet.address,
      tokenAddress,
      {
        gasLimit: 1_000_000,
      },
    );
    await disociateResult.wait();

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_APPROVE),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-128
  it('should call estimateGas with redirect transferFromNFT function', async function () {
    let spender = prefix + PrecompileContractAddress;
    const nftSerial = await mintNFT();

    const txResult = await estimateContractSigner4.associateTokenExternal(accounts[4].wallet.address, nftAddress, {
      gasLimit: 1_000_000,
    });
    await txResult.wait();
    const grantTokenKYCTx = await estimateContractSigner0.grantTokenKycExternal(
      nftAddress,
      accounts[4].wallet.address,
      {
        gasLimit: 1_000_000,
      },
    );
    await grantTokenKYCTx.wait();
    const nftApproveTx = await nftTokenContract.approve(
      accounts[4].wallet.address,
      nftSerial,
      Constants.GAS.LIMIT_1_000_000,
    );
    await nftApproveTx.wait();
    const nftApprovePrecompileTx = await nftTokenContract.approve(spender, nftSerial, Constants.GAS.LIMIT_1_000_000);
    await nftApprovePrecompileTx.wait();

    const tx = await precompileTestContract.transferFromRedirect.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[4].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const dissociateTxResult = await estimateContractSigner4.dissociateTokenExternal(
      accounts[4].wallet.address,
      nftAddress,
      {
        gasLimit: 1_000_000,
      },
    );
    await dissociateTxResult.wait();
    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_TRANSFER_FROM_NFT),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-001
  it('should call estimateGas with associate function for fungible token', async function () {
    const tx = await estimateContractSigner1.associateTokenExternal.populateTransaction(
      accounts[1].wallet.address,
      tokenAddress,
    );

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
    const tx = await contract.approveExternal.populateTransaction(tokenAddress, accounts[1].wallet.address, amount);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-008
  it('should call estimateGas with approveNFT function without association - negative', async function () {
    const nftSerial = await mintNFT();
    const tx = await contract.approveNFTExternal.populateTransaction(nftAddress, accounts[1].wallet.address, nftSerial);
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

  //EGP-015
  it('should call estimateGas with approveNFT function', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    const nftSerial = await mintNFT();

    //approve EstimatePrecompileContract to use the NFT
    const nftApproveTX = await nftTokenContract.approve(spender, nftSerial, Constants.GAS.LIMIT_1_000_000);
    await nftApproveTX.wait();

    //associate EstimatePrecompileContract to with the NFT
    const accountAssociateTX = await estimateContractSigner0.associateTokenExternal(spender, nftAddress);
    await accountAssociateTX.wait();

    //Grant token KYC for EstimatePrecompileContract
    const grantTokenKYCTX = await estimateContractSigner0.grantTokenKycExternal(nftAddress, spender);
    await grantTokenKYCTX.wait();

    //Transfer the NFT to EstimatePrecompileContract
    const nftTransferTX = await nftTokenContract.transferFrom(accounts[0].wallet.address, spender, nftSerial, {
      gasLimit: 1_000_000,
    });
    await nftTransferTX.wait();

    //Perform approveNFTExternal with EstimatePreocmpileContract
    const txResult = await estimateContractSigner0.approveNFTExternal(
      nftAddress,
      accounts[2].wallet.address,
      nftSerial,
    );
    const gasResult = await txResult.wait();

    const tx = await estimateContractSigner0.approveNFTExternal.populateTransaction(
      nftAddress,
      accounts[2].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-016
  it('should call estimateGas with setApprovalForAll function', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    //await associateAcc(estimateContractSigner1, , nftAddress);

    const txResult = await estimateContractSigner0.setApprovalForAllExternal(
      nftAddress,
      accounts[3].wallet.address,
      true,
    );
    const gasResult = await txResult.wait();

    const tx = await estimateContractSigner0.setApprovalForAllExternal.populateTransaction(
      nftAddress,
      accounts[1].wallet.address,
      true,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-017
  it('should call estimateGas with transferFromNFT function', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    const nftSerial = await mintNFT();

    const nftApproveTX = await nftTokenContract.approve(spender, nftSerial, Constants.GAS.LIMIT_1_000_000);
    await nftApproveTX.wait();

    const grantTokenKYCTX = await estimateContractSigner0.grantTokenKycExternal(nftAddress, spender);
    await grantTokenKYCTX.wait();

    //perform estimate gas for transferFromNFT
    const tx = await estimateContractSigner0.transferFromNFTExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    //perform real transaction for transferFromNFT
    const txResult = await estimateContractSigner0.transferFromNFTExternal(
      nftAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      nftSerial,
    );
    const gasResult = await txResult.wait();

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

    //const ERC20Contract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

    const erc20Accounts0 = tokenContract.connect(accounts[0].wallet);
    // @ts-ignore
    const tx1 = await erc20Accounts0.approve(contract.target, 2);
    await tx1.wait();

    const allowance = await tokenContract.allowance(accounts[0].wallet.address, contract.target);
    await contract.approveExternal(tokenAddress, accounts[1].wallet.address, amount);

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
    const nftSerial = await mintNFT();

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

  //EGP-024
  it('should call estimateGas with approveERC function for fungible token', async function () {
    const txResult = await tokenContract.approve(accounts[1].wallet.address, 10);
    const gasResult = await txResult.wait();
    const tx = await tokenContract.approve.populateTransaction(accounts[1].wallet.address, 10);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-025
  it('should call estimateGas with approveERC function without approval for fungible token', async function () {
    const tokenContract = new ethers.Contract(
      prefix + ERCcontractReceipt.contractId.toSolidityAddress(),
      ERCTestContractJson.abi,
      accounts[1].wallet,
    );

    const tx = await tokenContract.transferFrom.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      10,
    );
    negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-026
  it('Should call estimateGas with ERC transferFrom function for fungible token', async function () {
    const tokenContract1 = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[1].wallet);

    const txResultApprove = await tokenContract.approve(accounts[1].wallet.address, 10);
    await txResultApprove.wait();

    const tx = await tokenContract1.transferFrom.populateTransaction(
      accounts[0].wallet.address,
      accounts[3].wallet.address,
      9,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.ERC_TRANSFER_FROM),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-027 - Possible BUG - the estimateGas should revert the transaction but it returns a result
  it.skip('Should call estimateGas with ERC transferFrom function with more than the approved allowance for fungible token', async function () {
    // const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    const tokenContract1 = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[1].wallet);
    const txResultApprove = await tokenContract.approve(accounts[1].wallet.address, 10);
    await txResultApprove.wait();

    const allowance = await tokenContract.allowance(accounts[0].wallet.address, accounts[1].wallet.address);
    console.log(allowance);

    // const txResult = await tokenContract1.transferFrom(accounts[0].wallet.address, accounts[3].wallet.address, 50, {gasLimit: 1_000_000});
    // const gasResult = await txResult.wait();

    const tx = await tokenContract1.transferFrom.populateTransaction(
      accounts[0].wallet.address,
      accounts[3].wallet.address,
      50,
      Constants.GAS.LIMIT_1_000_000,
    );
    //tx.from = accounts[1].wallet.address;
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(39511n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-028
  it('Should call estimateGas with ERC transfer function for fungible token', async function () {
    const txResult = await tokenContract.transfer(accounts[2].wallet.address, 10);
    const gasResult = await txResult.wait();

    const tx = await tokenContract.transfer.populateTransaction(accounts[2].wallet.address, 10);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-029
  it('Should call estimateGas with ERC getApproved function for NFT', async function () {
    const nftSerial = await mintNFT();
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[1].wallet);

    const txResult = await tokenContract.getApproved(nftSerial);

    const tx = await tokenContract.getApproved.populateTransaction(nftSerial);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_GET_APPROVED_NFT), estimateGasResponse, lowerPercentBound);
  });

  // //EGP-030
  it('Should call estimateGas with ERC isApprovedForAll', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC721MockJson.abi, accounts[0].wallet);

    const txResult = await tokenContract.isApprovedForAll(accounts[0].wallet.address, accounts[1].wallet.address);

    const tx = await tokenContract.isApprovedForAll.populateTransaction(
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_IS_APPROVED_FOR_ALL), estimateGasResponse, lowerPercentBound);
  });

  // EGP-031
  it('should call estimateGas with dissociateTokens function for fungible token', async function () {
    const tokens: String[] = [tokenAddress];
    await associateAcc(estimateContractSigner4, accounts[4].wallet.address, tokenAddress);

    const tx = await estimateContractSigner4.dissociateTokensExternal.populateTransaction(
      accounts[4].wallet.address,
      tokens,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner4.dissociateTokensExternal(accounts[4].wallet.address, tokens);
    const gasResult = await txResult.wait();
    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-032
  it('should call estimateGas with dissociateTokens function for NFT', async function () {
    const tokens: String[] = [nftAddress];
    await associateAcc(estimateContractSigner4, accounts[4].wallet.address, nftAddress);

    const tx = await estimateContractSigner4.dissociateTokensExternal.populateTransaction(
      accounts[4].wallet.address,
      tokens,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const txResult = await estimateContractSigner4.dissociateTokensExternal(accounts[4].wallet.address, tokens);
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
    const nftSerial = await mintNFT();
    const nftSerial2 = await mintNFT();
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

  //EGP-035
  it('should call estimateGas with cryptoTransfer function for hbars', async function () {
    const cryptoTransfers = {
      transfers: [
        {
          accountID: accounts[0].wallet.address,
          amount: -10_000,
          isApproval: false,
        },
        {
          accountID: accounts[1].wallet.address,
          amount: 10_000,
          isApproval: false,
        },
      ],
    };
    const tokenTransferList = [];

    const tx = await estimateContractAc0.cryptoTransferExternal.populateTransaction(cryptoTransfers, tokenTransferList);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.cryptoTransferExternal(cryptoTransfers, tokenTransferList);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-036
  it('should call estimateGas with cryptoTransfer function for NFT', async function () {
    const nftSerial = await mintNFT();

    const cryptoTransfers = {
      transfers: [],
    };

    let tokenTransferList = [
      {
        token: nftAddress,
        transfers: [],
        nftTransfers: [
          {
            senderAccountID: accounts[0].wallet.address,
            receiverAccountID: accounts[2].wallet.address,
            serialNumber: nftSerial,
            isApproval: false,
          },
        ],
      },
    ];

    const tx = await estimateContractAc0.cryptoTransferExternal.populateTransaction(cryptoTransfers, tokenTransferList);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.cryptoTransferExternal(cryptoTransfers, tokenTransferList);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-037
  it('should call estimateGas with cryptoTransfer function for fungible token', async function () {
    const cryptoTransfers = {
      transfers: [],
    };

    let tokenTransferList = [
      {
        token: tokenAddress,
        transfers: [
          {
            accountID: accounts[2].wallet.address,
            amount: 10,
            isApproval: false,
          },
          {
            accountID: accounts[0].wallet.address,
            amount: -10,
            isApproval: false,
          },
        ],
        nftTransfers: [],
      },
    ];

    const tx = await estimateContractAc0.cryptoTransferExternal.populateTransaction(cryptoTransfers, tokenTransferList);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.cryptoTransferExternal(cryptoTransfers, tokenTransferList);
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

  //EGP-043 - The test is excluded due to an issue in mirror node
  it.skip('should call estimateGas with createFungible token function', async function () {
    let estimateContractTokenCreate = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    const gasOptions = await Utils.gasOptions(requestId, 15_000_000);
    let gasLimit = gasOptions.gasLimit;
    let gasPrice = gasOptions.gasPrice;

    const tx = await estimateContractTokenCreate.createFungibleTokenPublic.populateTransaction(
      accounts[0].wallet.address,
      {},
    );

    console.log('Gas Limit is ' + tx.gasLimit);
    console.log('Gas Price is ' + tx.gasPrice);

    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txNewToken = await estimateContractTokenCreate.createFungibleTokenPublic(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    const newTokenAddress = (await txNewToken.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];
    console.log(newTokenAddress);

    //isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);

    //const result = await newMirrorNodeCleint.getNetworkExchangeRate();
    //const result = await newMirrorNodeCleint.getNetworkExchangeRate();
    // let mock = new MockAdapter(instance);
    // console.log("OPOPOP")
    // const exchangerate = {
    //   current_rate: {
    //     cent_equivalent: 596987,
    //     expiration_time: 1649689200,
    //     hbar_equivalent: 30000,
    //   },
    //   next_rate: {
    //     cent_equivalent: 596987,
    //     expiration_time: 1649689200,
    //     hbar_equivalent: 30000,
    //   },
    //   timestamp: '1586567700.453054000',
    // };

    // mock.onGet(`network/exchangerate`).reply(200, exchangerate);
    // const currentTimestamp: number = new Date().getTime();
    // console.log(currentTimestamp);
    // const currentUnixTimestampWithFractional: number = Date.now() / 1000;
    // const timestampString: string = currentTimestamp.toString();
    // console.log(currentUnixTimestampWithFractional);

    //const result = await newMirrorNodeCleint.getNetworkExchangeRate(timestampString);
    let account2Wallet = await mirrorNode.get(`/accounts/${accounts[2].wallet.address}`, requestId);
    let account2LongZero = Utils.idToEvmAddress(account2Wallet.account);

    console.log(account2LongZero);
    let NewestimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[2].wallet,
    );

    // let newCallerContract = new ethers.Contract(
    //   prefix + CallerContractAddress,
    //   CallerConractJson.abi,
    //   accounts[0].wallet,
    // );

    // const msgValue = await newCallerContract.msgValue({value: '10000000000'});
    // console.log(await msgValue.wait());

    // let txMsg = await newCallerContract.msgValue.populateTransaction({value: '10000000000'});
    // txMsg.value = BigInt(10000000000)
    // const msgEstimate = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [{
    //   data: txMsg.data,
    //   to: txMsg.to,
    //   value: '10000000000'
    // }]);

    // const tx2s = await NewestimateContract.createFungibleTokenPublic(
    //   accounts[2].wallet.address, {
    //   value: BigInt('10000000000000000000'),
    //   //gasLimit: 10_000_000,
    // });
    // console.log(await tx2s.wait());
    // //@ts-ignore
    // accounts[4].wallet = accounts[4].wallet.connect(relay.provider);
    // const tx2 = await accounts[4].wallet.sendTransaction({
    //   to: contract2.target.toString(),
    //   value: '50000000000000000000',
    // });
    // await tx2.wait();

    // const tx = await contract2.createFungibleTokenPublic.populateTransaction(accounts[4].wallet.address, {
    //   value: '5000000000',
    //   //gasLimit: 10_000_000,
    // });
    // tx.from = accounts[4].wallet.address;
    // const estimateGasResponse2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    //tx.from = accounts[0].wallet.address;

    // console.log(tx);
    //const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    const populate = await NewestimateContract.createFungibleTokenPublic.populateTransaction(
      accounts[0].wallet.address,
      {
        value: '5000000000',
        //gasLimit: 10_000_000,
      },
    );
    populate.from = accounts[2].wallet.address;

    const estimateGasResponse2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [populate]);

    const txs = await NewestimateContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10_000_000,
    });
    await txs.wait();

    // const newTokenAddress = (await txs.wait()).logs.filter(
    //   (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    // )[0].args[0];
    // console.log(newTokenAddress);
  });

  //EGP-051
  it('should call estimateGas with grantTokenKycExternal function for fungible token', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(tokenAddress, accounts[2].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(tokenAddress, accounts[2].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-052
  it('should call estimateGas with grantTokenKycExternal function for NFT', async function () {
    const tx = await contract.grantTokenKycExternal.populateTransaction(nftAddress, accounts[2].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.grantTokenKycExternal(nftAddress, accounts[2].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-053
  it('should call estimateGas with revokeTokenKycExternal function for fungible token', async function () {
    const tx = await contract.revokeTokenKycExternal.populateTransaction(tokenAddress, accounts[2].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.revokeTokenKycExternal(tokenAddress, accounts[2].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-054
  it('should call estimateGas with revokeTokenKycExternal function for NFT', async function () {
    const tx = await contract.revokeTokenKycExternal.populateTransaction(nftAddress, accounts[2].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.revokeTokenKycExternal(nftAddress, accounts[2].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-055
  it('should call estimateGas with Grant and Revoke KYC nested function', async function () {
    const tx = await contract.nestedGrantAndRevokeTokenKYCExternal.populateTransaction(
      tokenAddress,
      accounts[2].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.nestedGrantAndRevokeTokenKYCExternal(tokenAddress, accounts[2].wallet.address);
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

  //EGP-064
  it('should call estimateGas with delete function with invalid token serial', async function () {
    //const invalidTokenSerial = '0x0000000000000000000000000000000000000AAA';
    const tx = await contract.deleteTokenExternal.populateTransaction(Constants.NON_EXISTING_ADDRESS);

    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-065
  it('should call estimateGas with updateTokenExpiryInfo function', async function () {
    const tx = await estimateContractAc0.updateTokenExpiryInfoExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.UPDATE_TOKEN_EXPIRY_INFO),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-066
  it('should call estimateGas with updateTokenInfo function', async function () {
    const tx = await estimateContractAc0.updateTokenInfoExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.UPDATE_TOKEN_INFO),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-067
  it('should call estimateGas with updateTokenKeys function', async function () {
    const tx = await estimateContractAc0.updateTokenKeysExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.UPDATE_TOKEN_KEYS),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-068
  it('should call estimateGas with pause function for fungible token', async function () {
    const tx = await estimateContractAc0.pauseTokenExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.pauseTokenExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-069
  it('should call estimateGas with pause function for NFT', async function () {
    const tx = await estimateContractAc0.pauseTokenExternal.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.pauseTokenExternal(nftAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-70
  it('should call estimateGas with pause function for fungible token', async function () {
    const tx = await estimateContractAc0.unpauseTokenExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.unpauseTokenExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-71
  it('should call estimateGas with pause function for fungible token', async function () {
    const tx = await estimateContractAc0.unpauseTokenExternal.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.unpauseTokenExternal(nftAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-72
  it('should call estimateGas with nested pause and unpause function for fungible token', async function () {
    const tx = await estimateContractAc0.nestedPauseUnpauseTokenExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.nestedPauseUnpauseTokenExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-73
  it('should call estimateGas with nested pause and unpause function for NFT', async function () {
    const tx = await estimateContractAc0.nestedPauseUnpauseTokenExternal.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.nestedPauseUnpauseTokenExternal(nftAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-74
  it('should call estimateGas with getTokenExpiryInfo function', async function () {
    const tx = await estimateContractAc0.getTokenExpiryInfoExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenExpiryInfoExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-75
  it('should call estimateGas with isToken  function', async function () {
    const tx = await estimateContractAc0.isTokenExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.isTokenExternal(tokenAddress);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-76
  it('should call estimateGas with getTokenKey  function for supply', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 16);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 16);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-77
  it('should call estimateGas with getTokenKey  function for KYC', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 2);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 2);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-78
  it('should call estimateGas with getTokenKey  function for freeze', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 4);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 4);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-79
  it('should call estimateGas with getTokenKey  function for admin', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 1);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 1);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-80
  it('should call estimateGas with getTokenKey  function for wipe', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 8);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 8);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-81
  it('should call estimateGas with getTokenKey function for fee', async function () {
    const tx = await estimateContractSigner1.getTokenKeyExternal.populateTransaction(tokenAddress, 32);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractSigner1.getTokenKeyExternal(tokenAddress, 32);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.GET_TOKEN_KEY_FEE),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-82
  it('should call estimateGas with getTokenKey  function for pause', async function () {
    const tx = await estimateContractAc0.getTokenKeyExternal.populateTransaction(tokenAddress, 64);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.getTokenKeyExternal(tokenAddress, 64);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-83
  it('should call estimateGas with allowance function for fungible token', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;

    const approveTx = await tokenContract.approve(spender, 10, Constants.GAS.LIMIT_1_000_000);
    await approveTx.wait();

    const tx = await estimateContractAc0.allowanceExternal.populateTransaction(
      tokenAddress,
      accounts[1].wallet.address,
      spender,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.allowanceExternal(tokenAddress, accounts[3].wallet.address, spender);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-084
  it('should call estimateGas with allowance function for NFT', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;

    const nftSerial = await mintNFT();

    const nftApproveTX = await nftTokenContract.approve(spender, nftSerialNumber, Constants.GAS.LIMIT_1_000_000);
    await nftApproveTX.wait();

    const txResult = await estimateContractSigner0.allowanceExternal(nftAddress, accounts[0].wallet.address, spender);
    const gasResult = await txResult.wait();

    const tx = await estimateContractSigner0.allowanceExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      spender,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-86
  it('should call estimateGas with getApproved function for NFT', async function () {
    const nftSerial = await mintNFT();

    const tx = await estimateContractSigner2.getApprovedExternal.populateTransaction(nftAddress, nftSerial);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractSigner2.getApprovedExternal(nftAddress, nftSerial);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-88
  it('should call estimateGas with isApprovedForAll  function', async function () {
    const tx = await estimateContractAc0.isApprovedForAllExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.isApprovedForAllExternal(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-90
  it('should call estimateGas with ERC name function for fungible token', async function () {
    const tx = await tokenContract.name.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_NAME), estimateGasResponse, lowerPercentBound);
  });

  //EGP-91
  it('should call estimateGas with ERC name function for fungible NFT', async function () {
    const txResult = await nftTokenContract.name();
    const tx = await nftTokenContract.name.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_NAME_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-92
  it('should call estimateGas with ERC symbol function for fungible token', async function () {
    const txResult = await tokenContract.symbol();
    const tx = await tokenContract.symbol.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_SYMBOL), estimateGasResponse, lowerPercentBound);
  });

  //EGP-93
  it('should call estimateGas with ERC symbol function for NFT', async function () {
    const txResult = await nftTokenContract.symbol();
    const tx = await nftTokenContract.symbol.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_SYMBOL_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-94
  it('should call estimateGas with ERC decimals function for fungible token', async function () {
    const txResult = await tokenContract.decimals();
    const tx = await tokenContract.decimals.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_DECIMALS), estimateGasResponse, lowerPercentBound);
  });

  //EGP-95
  it('should call estimateGas with ERC totalSupply function for fungible token', async function () {
    const txResult = await tokenContract.totalSupply();
    const tx = await tokenContract.totalSupply.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_TOTAL_SUPPLY), estimateGasResponse, lowerPercentBound);
  });

  //EGP-96
  it('should call estimateGas with ERC totalSupply function for NFT', async function () {
    const ERCTestContract = new ethers.Contract(
      prefix + ERCcontractReceipt.contractId.toSolidityAddress(),
      ERCTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await ERCTestContract.totalSupplyIERC721(nftAddress);
    const tx = await ERCTestContract.totalSupplyIERC721.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_TOTAL_SUPPLY_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-97
  it('should call estimateGas with ERC balanceOf function for fungible token', async function () {
    const txResult = await tokenContract.balanceOf(accounts[0].wallet.address);
    const tx = await tokenContract.balanceOf.populateTransaction(accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_BALANCE_OF), estimateGasResponse, lowerPercentBound);
  });

  //EGP-98
  it('should call estimateGas with ERC balanceOf function for NFT', async function () {
    const txResult = await nftTokenContract.balanceOf(accounts[0].wallet.address);
    const tx = await nftTokenContract.balanceOf.populateTransaction(accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_BALANCE_OF_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-99
  it('should call estimateGas with ERC ownerOf function for NFT', async function () {
    const txResult = await nftTokenContract.ownerOf(nftAddress);
    const tx = await nftTokenContract.ownerOf.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_OWNER_OF_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-100
  it('should call estimateGas with ERC tokenURI function for NFT', async function () {
    const txResult = await nftTokenContract.tokenURI(nftAddress);
    const tx = await nftTokenContract.tokenURI.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.ERC_TOKEN_URI_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-101
  it('should call estimateGas with  getInformationForFungibleToken function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getInformationForFungibleToken(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getInformationForFungibleToken.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-102
  it('should call estimateGas with  getInformationForFungibleToken function for NFT', async function () {
    const nftSerial = await mintNFT();
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getInformationForNonFungibleToken(nftAddress, nftSerial);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getInformationForNonFungibleToken.populateTransaction(
      nftAddress,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-103
  it('should call estimateGas with  getInformationForToken function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getInformationForToken(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getInformationForToken.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-104
  it('should call estimateGas with  getInformationForToken function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getInformationForToken(nftAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getInformationForToken.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-105
  it('should call estimateGas with  getTokenDefaultFreeze function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getTokenDefaultFreeze(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getTokenDefaultFreeze.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-106
  it('should call estimateGas with  getTokenDefaultFreeze function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getTokenDefaultFreeze(nftAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getTokenDefaultFreeze.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-107
  it('should call estimateGas with  getTokenDefaultKyc function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getTokenDefaultKyc(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getTokenDefaultKyc.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-108
  it('should call estimateGas with  getTokenDefaultKyc function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getTokenDefaultKyc(nftAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getTokenDefaultKyc.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-109
  it('should call estimateGas with  isKyc function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.isKycGranted(tokenAddress, accounts[1].wallet.address);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.isKycGranted.populateTransaction(tokenAddress, accounts[1].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-110
  it('should call estimateGas with  getTokenDefaultKyc function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.isKycGranted(nftAddress, accounts[1].wallet.address);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.isKycGranted.populateTransaction(nftAddress, accounts[1].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-111
  it('should call estimateGas with  isTokenFrozen function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.isTokenFrozen(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.isTokenFrozen.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-112
  it('should call estimateGas with  isTokenFrozen function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.isTokenFrozen(nftAddress, accounts[1].wallet.address);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.isTokenFrozen.populateTransaction(nftAddress, accounts[1].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-113
  it('should call estimateGas with  getTokenType function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getType(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getType.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-114
  it('should call estimateGas with  isTokenFrozen function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getType(nftAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getType.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-115
  it('should call estimateGas with balanceOfRedirect function', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.balanceOfRedirect.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_BALANCE_OF),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-116
  it('should call estimateGas with  nameRedirect function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const tx = await precompileTokenContract.nameRedirect.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_NAME), estimateGasResponse, lowerPercentBound);
  });

  //EGP-117
  it('should call estimateGas with  nameNFTRedirect function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.nameNFTRedirect.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_NAME_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-118
  it('should call estimateGas with  symbolRedirect function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[2].wallet,
    );

    const tx = await precompileTokenContract.symbolRedirect.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_SYMBOL), estimateGasResponse, lowerPercentBound);
  });

  //EGP-119
  it('should call estimateGas with  symbolNFTRedirect function for NFT', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.symbolNFTRedirect.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_SYMBOL_NFT), estimateGasResponse, lowerPercentBound);
  });

  //EGP-120
  it('should call estimateGas with decimals redirect function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.decimalsRedirect.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_DECIMALS), estimateGasResponse, lowerPercentBound);
  });

  //EGP-121
  it('should call estimateGas with  allowance redirect function', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.allowanceRedirect.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_ALLOWANCE), estimateGasResponse, lowerPercentBound);
  });

  //EGP-122
  it('should call estimateGas with  getOwnerOf redirect function', async function () {
    const nftSerial = await mintNFT();
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.getOwnerOfRedirect.populateTransaction(nftAddress, nftSerial);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_GET_OWNER_OF), estimateGasResponse, lowerPercentBound);
  });

  //EGP-123
  it('should call estimateGas with  tokenURIRedirect function', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.tokenURIRedirect.populateTransaction(nftAddress, 1);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_TOKEN_URI), estimateGasResponse, lowerPercentBound);
  });

  //EGP-124
  it('should call estimateGas with isApprovedForAll redirect function', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.isApprovedForAllRedirect.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(BigInt(ACTUAL_GAS_USED.REDIRECT_IS_APPROVED_FOR_ALL), estimateGasResponse, lowerPercentBound);
  });

  //EGP-129
  it('should call estimateGas with setApprovalForAll redirect function', async function () {
    let spender = prefix + PrecompileContractAddress;
    const nftSerial = await mintNFT();

    let precompileTestContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    let precompiletTestContractAssociate = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const associateTx = await precompiletTestContractAssociate.associateTokenExternal(spender, nftAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();
    const grantTokenKYCTx = await estimateContractSigner0.grantTokenKycExternal(nftAddress, spender, {
      gasLimit: 1_000_000,
    });
    await grantTokenKYCTx.wait();
    const approveTx = await nftTokenContract.approve(spender, nftSerial, Constants.GAS.LIMIT_1_000_000);
    await approveTx.wait();
    const transferTx = await nftTokenContract.transferFrom(accounts[0].wallet.address, spender, nftSerial, {
      gasLimit: 1_000_000,
    });
    await transferTx.wait();

    const tx = await precompileTestContract.setApprovalForAllRedirect.populateTransaction(
      nftAddress,
      accounts[2].wallet.address,
      true,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(
      BigInt(ACTUAL_GAS_USED.REDIRECT_SET_APPROVAL_FOR_ALL),
      estimateGasResponse,
      lowerPercentBound,
      upperPercentBound,
    );
  });

  //EGP-130
  it('should call estimateGas with tinycentsToTinybars ', async function () {
    const txResult = await contract.tinycentsToTinybars(100);
    const gasResult = await txResult.wait();

    const tx = await contract.tinycentsToTinybars.populateTransaction(100);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-131
  it('should call estimateGas with tinybarsToTinycents ', async function () {
    const txResult = await contract.tinybarsToTinycents(100);
    const gasResult = await txResult.wait();

    const tx = await contract.tinybarsToTinycents.populateTransaction(100);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

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

  enum ACTUAL_GAS_USED {
    REDIRECT_TRANSFER = 47048,
    REDIRECT_TRANSFER_FROM = 47350,
    REDIRECT_APPROVE = 737257,
    REDIRECT_TRANSFER_FROM_NFT = 61457,
    REDIRECT_BALANCE_OF = 32806,
    REDIRECT_NAME = 37312,
    REDIRECT_NAME_NFT = 37268,
    REDIRECT_SYMBOL = 37312,
    REDIRECT_SYMBOL_NFT = 37334,
    REDIRECT_DECIMALS = 36065,
    REDIRECT_ALLOWANCE = 36836,
    REDIRECT_GET_OWNER_OF = 36382,
    REDIRECT_TOKEN_URI = 37035,
    REDIRECT_IS_APPROVED_FOR_ALL = 36858,
    REDIRECT_SET_APPROVAL_FOR_ALL = 737243,
    ERC_TRANSFER_FROM = 39511,
    ERC_GET_APPROVED_NFT = 27393,
    ERC_IS_APPROVED_FOR_ALL = 27511,
    UPDATE_TOKEN_EXPIRY_INFO = 39631,
    UPDATE_TOKEN_INFO = 74920,
    UPDATE_TOKEN_KEYS = 60427,
    GET_TOKEN_KEY_FEE = 27024,
    ERC_NAME = 27508,
    ERC_NAME_NFT = 27508,
    ERC_SYMBOL = 27508,
    ERC_SYMBOL_NFT = 27508,
    ERC_DECIMALS = 27508,
    ERC_TOTAL_SUPPLY = 27508,
    ERC_TOTAL_SUPPLY_NFT = 30865,
    ERC_BALANCE_OF = 27508,
    ERC_BALANCE_OF_NFT = 27508,
    ERC_OWNER_OF_NFT = 27508,
    ERC_TOKEN_URI_NFT = 27508,
  }
});
