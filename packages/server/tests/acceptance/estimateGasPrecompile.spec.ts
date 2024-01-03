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
import CallerConractJson from '../contracts/Caller.json';
import PrecompileTestContractJson from '../contracts/PrecompileTestContract.json';
import { maxGasLimit } from '@hashgraph/json-rpc-relay/tests/helpers';
import ERCTestContractJson from '../contracts/ERCTestContract.json';
import { create } from 'ts-node';
import { idText } from 'typescript';
import { MirrorNodeClient } from '@hashgraph/json-rpc-relay/src/lib/clients';
import axios from 'axios';
import { CacheService } from '@hashgraph/json-rpc-relay/src/lib/services/cacheService/cacheService';
import pino from 'pino';
import { Registry } from 'prom-client';
import MockAdapter from 'axios-mock-adapter';
const logger = pino();

describe.only('EstimatePrecompileContract tests', function () {
  // const utils = require('../utils')
  let instance = axios.create({
    baseURL: 'https://localhost:5551/api/v1',
    responseType: 'json' as const,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 20 * 1000,
  });
  const registry = new Registry();

  const signers: AliasAccount[] = [];
  const prefix = '0x';
  const CALL_EXCEPTION = 'CALL_EXCEPTION';
  let contract: ethers.Contract;
  let contractAccount1: ethers.Contract;
  let ERCContract: ethers.Contract;
  let contractReceipt;
  let ERCcontractReceipt;
  let EstimatePrecompileContractAddress;
  let ERCEstimatePrecompileContractAddress;
  let PrecompileContractAddress;
  let PrecompileContractReceipt;
  let tokenTransferContract;
  let erc20Contract;
  let requestId;
  let requestId2;
  let tokenAddress;
  let ERCTokenAddress;
  let contract2;
  let nftAddress;
  let NftSerialNumber;
  let estimateContractAc0;
  let estimateContractSigner0;
  let estimateContractSigner1;
  let estimateContractSigner2;
  let estimateContractSigner3;
  let estimateContractSigner4;
  let estimateContract;
  let lowerPercentBound = 5;
  let upperPercentBound = 30;
  let mirrorNodeClient;
  let CallerContractAddress;
  let callerContract;
  let newMirrorNodeCleint: MirrorNodeClient;
  const accounts: AliasAccount[] = [];
  const { servicesNode, mirrorNode, relay }: any = global;

  newMirrorNodeCleint = new MirrorNodeClient(
    'http://127.0.0.1:5551',
    logger.child({ name: `mirror-node` }),
    registry,
    new CacheService(logger.child({ name: `cache` }), registry),
    instance,
  );

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

  async function createHTSToken() {
    const mainContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );
    const gasOptions = await Utils.gasOptions(requestId, 15_000_000);
    const tx = await mainContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      ...gasOptions,
    });
    const { ERCTokenAddress } = (await tx.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args;

    return ERCTokenAddress;
  }

  before(async function () {
    //Checks
    // tokenTransferContract = await utils.deployTokenTransferContract()
    // erc20Contract = await utils.deployERC20Contract()

    signers[0] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());
    signers[1] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());
    signers[2] = await servicesNode.createAliasAccount(150, relay.provider, Utils.generateRequestId());

    contractReceipt = await servicesNode.deployContract(EstimatePrecompileContractJson, 5_000_000);
    EstimatePrecompileContractAddress = contractReceipt.contractId.toSolidityAddress();

    const test = await Utils.deployContractWithEthers([], EstimatePrecompileContractJson, signers[0].wallet, relay),
      callerContract = await servicesNode.deployContract(CallerConractJson, 5_000_000);
    CallerContractAddress = callerContract.contractId.toSolidityAddress();

    ERCcontractReceipt = await servicesNode.deployContract(ERCTestContractJson, 5_000_000);
    ERCEstimatePrecompileContractAddress = ERCcontractReceipt.contractId.toSolidityAddress();

    PrecompileContractReceipt = await servicesNode.deployContract(PrecompileTestContractJson, 5_000_000);
    PrecompileContractAddress = PrecompileContractReceipt.contractId.toSolidityAddress();

    contract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      signers[0].wallet,
    );

    contract2 = new ethers.Contract(test.target.toString(), EstimatePrecompileContractJson.abi, signers[0].wallet);

    const contractTEST = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      signers[1].wallet,
    );

    //ERC Contract
    ERCContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      ERCTestContractJson.abi,
      signers[0].wallet,
    );

    requestId = Utils.generateRequestId();
    //requestId2 = Utils.generateRequestId();
    const contractMirror = await mirrorNode.get(`/contracts/${EstimatePrecompileContractAddress}`, requestId);
    const contract2Mirror = await mirrorNode.get(`/contracts/${PrecompileContractAddress}`, requestId);
    const contract2NEWMirror = await mirrorNode.get(`/contracts/${contract2.target}`, requestId);

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
      150,
      relay.provider,
      requestId,
    );

    contract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    //трябва рефакторирам метода да приема повече контракт кей-ове за контрактите които ще се ползват
    accounts[3] = await servicesNode.createAccountWithContractIdKey(
      contractMirror.contract_id,
      30,
      relay.provider,
      requestId,
    );

    let contract2IdKey: String = '0.0.' + PrecompileContractReceipt.contractId.num.low;
    // let contract2IdKeyString = contract2IdKey.toString
    console.log(contract2IdKey);

    accounts[4] = await servicesNode.createAccountWithContractIdKeys(
      contract2NEWMirror.contract_id,
      300,
      relay.provider,
      requestId,
    );

    // Create contract signers
    tokenAddress = await createFungibleToken();
    nftAddress = await createNft();

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
    await contract.grantTokenKycExternal(nftAddress, prefix + PrecompileContractAddress, { gasLimit: 500_000 });
    //Fungible
    await contract.grantTokenKycExternal(tokenAddress, accounts[0].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[1].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[2].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[3].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, accounts[4].wallet.address, { gasLimit: 500_000 });
    await contract.grantTokenKycExternal(tokenAddress, prefix + EstimatePrecompileContractAddress, {
      gasLimit: 500_000,
    });
    await contract.grantTokenKycExternal(tokenAddress, prefix + PrecompileContractAddress, {
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

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    //approve EstimatePrecompileContract to use the NFT
    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    const nftApproveTX = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    await nftApproveTX.wait();
    //associate EstimatePrecompileContract to with the NFT
    const accountAssociateTX = await estimateContract.associateTokenExternal(spender, nftAddress);
    await accountAssociateTX.wait();
    //Grant token KYC for EstimatePrecompileContract
    const grantTokenKYCTX = await estimateContract.grantTokenKycExternal(nftAddress, spender);
    await grantTokenKYCTX.wait();
    //Transfer the NFT to EstimatePrecompileContract
    const nftTransferTX = await NFTtokenContract.transferFrom(accounts[0].wallet.address, spender, nftSerial, {
      gasLimit: 1_000_000,
    });
    await nftTransferTX.wait();
    //Perform approveNFTExternal with EstimatePreocmpileContract
    const txResult = await estimateContract.approveNFTExternal(nftAddress, accounts[2].wallet.address, nftSerial);
    const gasResult = await txResult.wait();

    const tx = await estimateContract.approveNFTExternal.populateTransaction(
      nftAddress,
      accounts[2].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  // it('should call estimateGas with approveNFT function', async function () {
  //   const nftSerial = await mintNFT();
  //   let spender = prefix + EstimatePrecompileContractAddress;

  //   await associateAcc(estimateContractSigner1, spender, nftAddress);
  //   const tx = await estimateContractSigner1.approveNFTExternal.populateTransaction(nftAddress, spender, nftSerial);
  //   const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

  //   // const gasResult = await approveAcc(estimateContractSigner0, tokenAddress, accounts[1].wallet.address, nftSerial);
  //   const txResult = await estimateContractAc0.approveNFTExternal(nftAddress, spender, nftSerial);
  //   await txResult.wait();

  //   isWithinDeviation(400000n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  // });

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

  //EGP-017
  it('should call estimateGas with transferFromNFT function', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    const nftSerial = await mintNFT();

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    //approve EstimatePrecompileContract to use the NFT
    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    const nftApproveTX = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    await nftApproveTX.wait();
    //associate EstimatePrecompileContract to with the NFT
    const accountAssociateTX = await estimateContract.associateTokenExternal(spender, nftAddress);
    await accountAssociateTX.wait();
    //Grant token KYC for EstimatePrecompileContract
    const grantTokenKYCTX = await estimateContract.grantTokenKycExternal(nftAddress, spender);
    await grantTokenKYCTX.wait();
    //perform estimate gas for transferFromNFT
    const tx = await estimateContract.transferFromNFTExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    //perform real transaction for transferFromNFT
    const txResult = await estimateContract.transferFromNFTExternal(
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

  //EGP-024
  it('should call estimateGas with approveERC function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

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
    // const txResult = await tokenContract.transferFrom(tokenAddress, accounts[0].wallet.address, accounts[2].wallet.address, 10);
    // const gasResult = await txResult.wait();
    const tx = await tokenContract.transferFrom.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[2].wallet.address,
      10,
    );
    negativeScenarioVerification(tx, CALL_EXCEPTION);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  //EGP-026
  it('Should call estimateGas with ERC transferFrom function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    const tokenContract1 = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[1].wallet);
    //approve to be removed when the tests are run together, because the account is approved in the previous one
    const txResultApprove = await tokenContract.approve(accounts[1].wallet.address, 10);
    await txResultApprove.wait();

    // const allowance = await tokenContract.allowance(accounts[0].wallet.address, accounts[1].wallet.address);
    // console.log(allowance);

    // const txResult = await tokenContract1.transferFrom(accounts[0].wallet.address, accounts[3].wallet.address, 9, {gasLimit: 1_000_000});
    // const gasResult = await txResult.wait();

    const tx = await tokenContract1.transferFrom.populateTransaction(
      accounts[0].wallet.address,
      accounts[3].wallet.address,
      9,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(39511n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-027 - Possible BUG - the estimateGas returns a result but it shouldn't
  it('Should call estimateGas with ERC transferFrom function with more than the approved allowance for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
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
      { gasLimit: 1_000_000 },
    );
    //tx.from = accounts[1].wallet.address;
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(39511n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-027 TEST TEST- Possible BUG - the estimateGas returns a result but it shouldn't
  it('Should call estimateGas with ERC transferFrom function with more than the approved allowance for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    const tokenContract1 = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[1].wallet);
    const txResultApprove = await tokenContract.approve(tokenContract1, 10);
    await txResultApprove.wait();
    // const allowance = await tokenContract.allowance(accounts[0].wallet.address, accounts[1].wallet.address);
    console.log('my accounts:');
    console.log(accounts[0].address);
    console.log(accounts[1].address);
    // const txResult = await tokenContract1.transferFrom(accounts[0].wallet.address, accounts[3].wallet.address, 50, { gasLimit: 1_000_000 });
    // const gasResult = await txResult.wait();
    const tx = await tokenContract1.transferFrom.populateTransaction(
      accounts[0].wallet.address,
      accounts[3].wallet.address,
      9,
    );
    //tx.from = accounts[1].address;
    console.log('Here is the txn', tx);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    console.log('returned gas:', estimateGasResponse);
    // isWithinDeviation(39511n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-028
  it('Should call estimateGas with ERC transfer function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    // const tokenContract1 = new ethers.Contract(accounts[0].wallet.address, ERC20MockJson.abi, accounts[1].wallet);

    const txResult = await tokenContract.transfer(accounts[2].wallet.address, 10);
    const gasResult = await txResult.wait();

    const tx = await tokenContract.transfer.populateTransaction(accounts[2].wallet.address, 10);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-029
  it('Should call estimateGas with ERC transfer function for NFT', async function () {
    NftSerialNumber = await mintNFT();
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[1].wallet);
    // const tokenContract1 = new ethers.Contract(accounts[0].wallet.address, ERC20MockJson.abi, accounts[1].wallet);

    const txResult = await tokenContract.getApproved(NftSerialNumber);
    const gasResult = await txResult.wait();

    const tx = await tokenContract.getApproved.populateTransaction(NftSerialNumber);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  // //EGP-030
  it('Should call estimateGas with ERC isApprovedForAll', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC721MockJson.abi, accounts[0].wallet);
    // const tokenContract1 = new ethers.Contract(accounts[0].wallet.address, ERC20MockJson.abi, accounts[1].wallet);

    const txResult = await tokenContract.isApprovedForAll(accounts[0].wallet.address, accounts[1].wallet.address);

    const tx = await tokenContract.isApprovedForAll.populateTransaction(
      accounts[0].wallet.address,
      accounts[1].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27511n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-024
  it('should call estimateGas with ERC approve function', async function () {
    // const ERC20Contract0 = new ethers.Contract(tokenAddress, ERCTestContractJson.abi, accounts[0].wallet);
    // const txs = await ERC20Contract0.name.populateTransaction(tokenAddress);
    // const estimateGasResponse2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [txs]);

    // const txResult = await ERC20Contract0.name(tokenAddress);
    // const gasResult = await txResult.wait();

    const ERC20Contract = new ethers.Contract(
      ERCcontractReceipt.contract_id,
      ERCTestContractJson.abi,
      accounts[0].wallet,
    );

    // const erc20Accounts0 = ERC20Contract.connect(accounts[0].wallet);

    const txs = await ERCContract.name(tokenAddress);
    await txs.wait();

    const estimateGasResponse2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [txs]);

    // const gasResult = await approveAcc(estimateContractSigner0, tokenAddress, spender, amount);

    // const tx = await ERC20Contract0.name(tokenAddress);
    // const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    // isWithinDeviation(gasResult.gasUsed, estimateGasResponse2, lowerPercentBound, upperPercentBound);
  });

  //TESTSTSTS - 1
  it('should call estimateGas with ERC approve function', async function () {
    const NFTokenContract = new ethers.Contract(
      prefix + ERCcontractReceipt.contractId.toSolidityAddress(),
      ERCTestContractJson.abi,
      accounts[0].wallet,
    );

    const appp2 = await NFTokenContract.name(tokenAddress);
    const gasResult = await appp2.wait();

    const tx = await contract.transferFromNFTExternal.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    baseGasCheck(estimateGasResponse, 786166);
  });

  //TESTSTSTS - 2
  it('should call estimateGas with ERC approve function', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const txResult = await tokenContract.name();
    const tx = await tokenContract.name.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    // const appp2 = await NFTokenContract.approve(params.....); - if we want to use approve
    // const gasResult = await appp2.wait();
    //const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
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

  //EGP-043 ----
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
    const tx = await contract.revokeTokenKycExternal.populateTransaction(tokenAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.revokeTokenKycExternal(tokenAddress, accounts[0].wallet.address);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-054
  it('should call estimateGas with revokeTokenKycExternal function for NFT', async function () {
    const tx = await contract.revokeTokenKycExternal.populateTransaction(nftAddress, accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await contract.revokeTokenKycExternal(nftAddress, accounts[0].wallet.address);
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

  //EGP-064
  it('should call estimateGas with delete function with invalid token serial', async function () {
    const invalidTokenSerial = '0x0000000000000000000000000000000000000AAA';
    const tx = await contract.deleteTokenExternal.populateTransaction(invalidTokenSerial);
    // const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    await negativeScenarioVerification(tx, CALL_EXCEPTION);
  });

  //EGP-065
  it('should call estimateGas with updateTokenExpiryInfo function', async function () {
    const tx = await estimateContractAc0.updateTokenExpiryInfoExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(39631n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-066
  it('should call estimateGas with updateTokenInfo function', async function () {
    const tx = await estimateContractAc0.updateTokenInfoExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(74920n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-067
  it('should call estimateGas with updateTokenKeys function', async function () {
    const tx = await estimateContractAc0.updateTokenKeysExternal.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(60427n, estimateGasResponse, lowerPercentBound, upperPercentBound);
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
  it('should call estimateGas with getTokenKey  function for fee', async function () {
    const tx = await estimateContractSigner1.getTokenKeyExternal.populateTransaction(tokenAddress, 32);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractSigner1.getTokenKeyExternal(tokenAddress, 32);
    // const gasResult = await txResult.wait();

    isWithinDeviation(27024n, estimateGasResponse, lowerPercentBound, upperPercentBound);
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
    await associateAcc(contract, spender, tokenAddress);
    await approveAcc(contract, tokenAddress, spender, 10);

    const tx = await estimateContractAc0.allowanceExternal.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      spender,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txResult = await estimateContractAc0.allowanceExternal(tokenAddress, accounts[0].wallet.address, spender);
    const gasResult = await txResult.wait();

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-084
  it('should call estimateGas with allowance function for NFT', async function () {
    let spender = prefix + EstimatePrecompileContractAddress;
    const nftSerial = await mintNFT();

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    //approve EstimatePrecompileContract to use the NFT
    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    const nftApproveTX = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    await nftApproveTX.wait();
    //allowance EstimatePrecompileContract to with the NFT
    const txResult = await estimateContract.allowanceExternal(nftAddress, accounts[0].wallet.address, spender);
    const gasResult = await txResult.wait();

    const tx = await estimateContract.allowanceExternal.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      spender,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(gasResult.gasUsed, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-86
  it('should call estimateGas with getApproved function for NFT', async function () {
    let nftSerial = await mintNFT();

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
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    //const txResult = await tokenContract.name();
    const tx = await tokenContract.name.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-91
  it('should call estimateGas with ERC name function for fungible NFT', async function () {
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.name();
    const tx = await tokenContract.name.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-92
  it('should call estimateGas with ERC symbol function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.symbol();
    const tx = await tokenContract.symbol.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-93
  it('should call estimateGas with ERC symbol function for NFT', async function () {
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.symbol();
    const tx = await tokenContract.symbol.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-94
  it('should call estimateGas with ERC decimals function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.decimals();
    const tx = await tokenContract.decimals.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-95
  it('should call estimateGas with ERC totalSupply function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.totalSupply();
    const tx = await tokenContract.totalSupply.populateTransaction();
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-96
  it('should call estimateGas with ERC totalSupply function for NFT', async function () {
    const ERCTestContract = new ethers.Contract(
      prefix + ERCcontractReceipt.contractId.toSolidityAddress(),
      ERCTestContractJson.abi,
      accounts[0].wallet,
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await ERCTestContract.totalSupplyIERC721(nftAddress);
    const tx = await ERCTestContract.totalSupplyIERC721.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(30865n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-97
  it('should call estimateGas with ERC balanceOf function for fungible token', async function () {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.balanceOf(accounts[0].wallet.address);
    const tx = await tokenContract.balanceOf.populateTransaction(accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-98
  it('should call estimateGas with ERC balanceOf function for NFT', async function () {
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.balanceOf(accounts[0].wallet.address);
    const tx = await tokenContract.balanceOf.populateTransaction(accounts[0].wallet.address);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-99
  it('should call estimateGas with ERC ownerOf function for NFT', async function () {
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.ownerOf(nftAddress);
    const tx = await tokenContract.ownerOf.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-100
  it('should call estimateGas with ERC tokenURI function for NFT', async function () {
    const tokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const txResult = await tokenContract.tokenURI(nftAddress);
    const tx = await tokenContract.tokenURI.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(27508n, estimateGasResponse, lowerPercentBound);
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
  it('should call estimateGas with  getInformationForNonFungibleToken function for NFT', async function () {
    NftSerialNumber = await mintNFT();
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txResult = await precompileTokenContract.getInformationForNonFungibleToken(nftAddress, NftSerialNumber);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.getInformationForNonFungibleToken.populateTransaction(
      nftAddress,
      NftSerialNumber,
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
  it('should call estimateGas with  balanceOfRedirect function', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const txerser = await precompileTokenContract.balanceOfRedirect(tokenAddress, accounts[0].wallet.address);
    await txerser.wait();

    const tx = await precompileTokenContract.balanceOfRedirect.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isWithinDeviation(32806n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-116
  it('should call estimateGas with  nameRedirect function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const txss = await precompileTokenContract.nameRedirect(nftAddress);
    const sdasdsa = await txss.wait();

    const tx = await precompileTokenContract.nameRedirect.populateTransaction(nftAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    isEqualWithDeviation(37312n, estimateGasResponse, lowerPercentBound);
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
    isEqualWithDeviation(37268n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-118
  it('should call estimateGas with  symbolRedirect function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[2].wallet,
    );

    const txResult = await precompileTokenContract.symbolRedirect(tokenAddress);
    const gasResult = await txResult.wait();

    const tx = await precompileTokenContract.symbolRedirect.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(37312n, estimateGasResponse, lowerPercentBound);
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
    isEqualWithDeviation(37334n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-120
  it('should call estimateGas with  decimals function for fungible token', async function () {
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.decimalsRedirect.populateTransaction(tokenAddress);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(36065n, estimateGasResponse, lowerPercentBound);
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
    isEqualWithDeviation(36836n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-122
  it('should call estimateGas with  getOwnerOf redirect function', async function () {
    NftSerialNumber = await mintNFT();
    const precompileTokenContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[0].wallet,
    );

    const tx = await precompileTokenContract.getOwnerOfRedirect.populateTransaction(nftAddress, NftSerialNumber);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isEqualWithDeviation(36382n, estimateGasResponse, lowerPercentBound);
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
    isEqualWithDeviation(37035n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-124
  it('should call estimateGas with  isApprovedForAll function', async function () {
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
    isEqualWithDeviation(36858n, estimateGasResponse, lowerPercentBound);
  });

  //EGP-129 TEST ---
  it.only('Create token', async function () {
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

    let newCallerContract = new ethers.Contract(
      prefix + CallerContractAddress,
      CallerConractJson.abi,
      accounts[0].wallet,
    );

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
    //@ts-ignore
    accounts[4].wallet = accounts[4].wallet.connect(relay.provider);
    const tx2 = await accounts[4].wallet.sendTransaction({
      to: contract2.target.toString(),
      value: '50000000000000000000',
    });
    await tx2.wait();

    const tx = await contract2.createFungibleTokenPublic.populateTransaction(accounts[4].wallet.address, {
      value: '5000000000',
      //gasLimit: 10_000_000,
    });
    tx.from = accounts[4].wallet.address;
    const estimateGasResponse2 = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    //tx.from = accounts[0].wallet.address;

    console.log(tx);
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

    const txs = await NewestimateContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 10_000_000,
    });

    const newTokenAddress = (await txs.wait()).logs.filter(
      (e) => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken,
    )[0].args[0];
    console.log(newTokenAddress);
  });

  //EGP-125
  it('should call estimateGas with transferRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

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

    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

    const associateTx = await precompiletTestContractAssociate.associateTokenExternal(spender, tokenAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();
    const grantTokenKYCTx = await estimateContract.grantTokenKycExternal(tokenAddress, spender, {
      gasLimit: 1_000_000,
    });
    await grantTokenKYCTx.wait();
    const approveTx = await tokenContract.approve(spender, 10, { gasLimit: 1_000_000 });
    await approveTx.wait();
    const transferTx = await tokenContract.transfer(spender, 10, { gasLimit: 1_000_000 });
    await transferTx.wait();

    const tx = await precompileTestContract.transferRedirect.populateTransaction(
      tokenAddress,
      accounts[2].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(47048n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP 126
  it('should call estimateGas with transferFromRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    let precompileTestContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);
    const txResult = await precompileTestContract.associateTokenExternal(accounts[4].wallet.address, tokenAddress, {
      gasLimit: 1_000_000,
    });
    const gasResult = await txResult.wait();
    const grant = await estimateContract.grantTokenKycExternal(tokenAddress, accounts[4].wallet.address, {
      gasLimit: 1_000_000,
    });
    await grant.wait();
    const nftApproveTX = await tokenContract.approve(accounts[4].wallet.address, 10, { gasLimit: 1_000_000 });
    await nftApproveTX.wait();
    const nftApprovePrecompileTX = await tokenContract.approve(spender, 10, { gasLimit: 1_000_000 });
    await nftApprovePrecompileTX.wait();
    const allowance = await tokenContract.allowance(accounts[0].wallet.address, accounts[4].wallet.address, {
      gasLimit: 1_000_000,
    });

    const tx = await precompileTestContract.transferFromRedirect.populateTransaction(
      tokenAddress,
      accounts[0].wallet.address,
      accounts[4].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(47350n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-127
  it('should call estimateGas with approveRedirect function', async function () {
    let spender = prefix + PrecompileContractAddress;

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

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

    const tokenContract = new ethers.Contract(tokenAddress, ERC20MockJson.abi, accounts[0].wallet);

    const associateTx = await precompiletTestContractAssociate.associateTokenExternal(spender, tokenAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();
    const grantTokenKYCTx = await estimateContract.grantTokenKycExternal(tokenAddress, spender, {
      gasLimit: 1_000_000,
    });
    await grantTokenKYCTx.wait();
    const approveTx = await tokenContract.approve(spender, 10, { gasLimit: 1_000_000 });
    await approveTx.wait();
    const transferTx = await tokenContract.transfer(spender, 10, { gasLimit: 1_000_000 });
    await transferTx.wait();

    const txResult = await precompileTestContract.associateTokenExternal(accounts[4].wallet.address, tokenAddress, {
      gasLimit: 1_000_000,
    });
    const gasResult = await txResult.wait();

    const tx = await precompileTestContract.approveRedirect.populateTransaction(
      tokenAddress,
      accounts[4].wallet.address,
      10,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(737257n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-128
  it('should call estimateGas with transferFromNFT function', async function () {
    let spender = prefix + PrecompileContractAddress;
    let nftSerial = await mintNFT();

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    let precompileTestContract = new ethers.Contract(
      prefix + PrecompileContractAddress,
      PrecompileTestContractJson.abi,
      accounts[4].wallet,
    );

    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    const txResult = await precompileTestContract.associateTokenExternal(accounts[4].wallet.address, nftAddress, {
      gasLimit: 1_000_000,
    });
    await txResult.wait();
    const grant = await estimateContract.grantTokenKycExternal(nftAddress, accounts[4].wallet.address, {
      gasLimit: 1_000_000,
    });
    await grant.wait();
    const nftApproveTX = await NFTtokenContract.approve(accounts[4].wallet.address, nftSerial, { gasLimit: 1_000_000 });
    await nftApproveTX.wait();
    const nftApprovePrecompileTX = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    await nftApprovePrecompileTX.wait();

    const tx = await precompileTestContract.transferFromRedirect.populateTransaction(
      nftAddress,
      accounts[0].wallet.address,
      accounts[4].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(61457n, estimateGasResponse, lowerPercentBound, upperPercentBound);
  });

  //EGP-129
  it('should call estimateGas with setApprovalForAll function', async function () {
    let spender = prefix + PrecompileContractAddress;
    let nftSerial = await mintNFT();

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

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

    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);

    const associateTx = await precompiletTestContractAssociate.associateTokenExternal(spender, nftAddress, {
      gasLimit: 1_000_000,
    });
    await associateTx.wait();
    const grantTokenKYCTx = await estimateContract.grantTokenKycExternal(nftAddress, spender, { gasLimit: 1_000_000 });
    await grantTokenKYCTx.wait();
    const approveTx = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    await approveTx.wait();
    const transferTx = await NFTtokenContract.transferFrom(accounts[0].wallet.address, spender, nftSerial, {
      gasLimit: 1_000_000,
    });
    await transferTx.wait();

    const tx = await precompileTestContract.setApprovalForAllRedirect.populateTransaction(
      nftAddress,
      accounts[2].wallet.address,
      true,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);
    isWithinDeviation(737243n, estimateGasResponse, lowerPercentBound, upperPercentBound);
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

  //---------------------TESTS---------
  it('should call estimateGas with approveNFT function', async function () {
    console.log('accounts[0].wallet.address = ' + accounts[0].wallet.address);
    console.log('accounts[2].wallet.address = ' + accounts[2].wallet.address);
    console.log('signers[0].wallet.address = ' + signers[0].wallet.address);
    console.log('estimateContract address = ' + prefix + EstimatePrecompileContractAddress);
    let spender = prefix + EstimatePrecompileContractAddress;
    const nftSerial = await mintNFT();

    estimateContract = new ethers.Contract(
      prefix + EstimatePrecompileContractAddress,
      EstimatePrecompileContractJson.abi,
      accounts[0].wallet,
    );

    // const TXtransfer = await estimateContract.transferNFTExternal(
    //   nftAddress,
    //   accounts[0].wallet.address,
    //   accounts[2].wallet.address,
    //   nftSerial,
    // );
    // await TXtransfer.wait();

    const NFTtokenContract = new ethers.Contract(nftAddress, ERC721MockJson.abi, accounts[0].wallet);
    const nftTX = await NFTtokenContract.approve(spender, nftSerial, { gasLimit: 1_000_000 });
    const nftTXResult = await nftTX.wait();

    const accountAssociateTX = await estimateContract.associateTokenExternal(spender, nftAddress);
    await accountAssociateTX.wait();

    const grantTokenKYCTX = await estimateContract.grantTokenKycExternal(nftAddress, spender);
    await grantTokenKYCTX.wait();

    const nftTransferTX = await NFTtokenContract.transferFrom(accounts[0].wallet.address, spender, nftSerial, {
      gasLimit: 1_000_000,
    });
    const nftTransferTXResult = await nftTransferTX.wait();

    // const nftSerial = await mintNFT();
    // const nftSerial2 = await mintNFT();
    // let spender = prefix + EstimatePrecompileContractAddress;
    // let amount =1;
    // let account2Wallet = await mirrorNode.get(`/accounts/${accounts[2].wallet.address}`, requestId);
    // let account2LongZero = Utils.idToEvmAddress(account2Wallet.account);
    // const NFTtokenContract = new ethers.Contract(nftAddress, EstimatePrecompileContractJson.abi, accounts[0].wallet);

    console.log('accounts[0].wallet.address = ' + accounts[0].wallet.address);
    console.log('accounts[2].wallet.address = ' + accounts[2].wallet.address);
    console.log('signers[0].wallet.address = ' + signers[0].wallet.address);
    console.log('estimateContract address = ' + prefix + EstimatePrecompileContractAddress);

    //await associateAcc(estimateContractSigner4, accounts[4].wallet.address, nftAddress);
    const txResult = await estimateContract.approveNFTExternal(nftAddress, accounts[2].wallet.address, nftSerial);
    const gasResult = await txResult.wait();

    const tx = await estimateContract.approveNFTExternal.populateTransaction(
      nftAddress,
      accounts[2].wallet.address,
      nftSerial,
    );
    const estimateGasResponse = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS, [tx]);

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
