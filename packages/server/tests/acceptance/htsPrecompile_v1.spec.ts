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
//Constants are imported with different definitions for better readability in the code.
import Constants from '../../tests/helpers/constants';

chai.use(solidity);

import { AliasAccount } from '../clients/servicesClient';
import { ethers } from 'ethers';
import BaseHTSJson from '../contracts/contracts_v1/BaseHTS.json';
import { Utils } from '../helpers/utils';


describe('@htsprecompilev1 HTS Precompile V1 Acceptance Tests', async function () {
  this.timeout(240 * 1000); // 240 seconds
  const { servicesNode, relay, mirrorNode }: any = global;

  const TX_SUCCESS_CODE = BigInt(22);

  const accounts: AliasAccount[] = [];
  let BaseHTSContractAddress;
  let HTSTokenContractAddress;
  let NftHTSTokenContractAddress;
  let baseHTSContract;
  let baseHTSContractOwner;
  let baseHTSContractReceiverWalletFirst;
  let baseHTSContractReceiverWalletSecond;
  let HTSTokenWithCustomFeesContractAddress;
  let requestId;

  this.beforeAll(async () => {
    requestId = Utils.generateRequestId();

    const contractDeployer = await servicesNode.createAliasAccount(50, relay.provider, requestId);
    BaseHTSContractAddress = await deployBaseHTSContract(contractDeployer.wallet);
    const contractMirror = await mirrorNode.get(`/contracts/${BaseHTSContractAddress}`, requestId);

    accounts[0] = await servicesNode.createAccountWithContractIdKey(contractMirror.contract_id,70, relay.provider, requestId);
    accounts[1] = await servicesNode.createAccountWithContractIdKey(contractMirror.contract_id,25, relay.provider, requestId);
    accounts[2] = await servicesNode.createAccountWithContractIdKey(contractMirror.contract_id,25, relay.provider, requestId);

    // allow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
    await new Promise(r => setTimeout(r, 5000));

    baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);

    baseHTSContractOwner = baseHTSContract;
    baseHTSContractReceiverWalletFirst = baseHTSContract.connect(accounts[1].wallet);
    baseHTSContractReceiverWalletSecond = baseHTSContract.connect(accounts[2].wallet);
  });

  this.beforeEach(async () => {
    requestId = Utils.generateRequestId();
  });

  async function deployBaseHTSContract(signer) {
    const baseHTSFactory = new ethers.ContractFactory(BaseHTSJson.abi, BaseHTSJson.bytecode, signer);
    const baseHTS = await baseHTSFactory.deploy(Constants.GAS.LIMIT_10_000_000);
    await baseHTS.waitForDeployment();

    return baseHTS.target;
  }

  async function createHTSToken() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 1_000_000
    });
    const { tokenAddress } = (await tx.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken)[0].args;

    return tokenAddress;
  }

  async function createNftHTSToken() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createNonFungibleTokenPublic(accounts[0].wallet.address, {
      value: BigInt('10000000000000000000'),
      gasLimit: 1_000_000
    });
    const { tokenAddress } = (await tx.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken)[0].args;

    return tokenAddress;
  }

  async function createHTSTokenWithCustomFees() {
    const baseHTSContract = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const tx = await baseHTSContract.createFungibleTokenWithCustomFeesPublic(accounts[0].wallet.address, HTSTokenContractAddress, {
      value: BigInt('20000000000000000000'),
      gasLimit: 1_000_000
    });
    const txReceipt = await tx.wait();
    const { tokenAddress } = txReceipt.logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.CreatedToken)[0].args;

    return tokenAddress;
  }

  it('should create associate to a fungible token', async function () {
    HTSTokenContractAddress = await createHTSToken();

    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  it('should create and associate to an nft', async function () {
    NftHTSTokenContractAddress = await createNftHTSToken();

    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, NftHTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, NftHTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, NftHTSTokenContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });

  it('should create and associate to a fungible token with custom fees', async function () {
    HTSTokenWithCustomFeesContractAddress = await createHTSTokenWithCustomFees();

    const baseHTSContractOwner = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[0].wallet);
    const txCO = await baseHTSContractOwner.associateTokenPublic(BaseHTSContractAddress, HTSTokenWithCustomFeesContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txCO.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const baseHTSContractReceiverWalletFirst = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[1].wallet);
    const txRWF = await baseHTSContractReceiverWalletFirst.associateTokenPublic(accounts[1].wallet.address, HTSTokenWithCustomFeesContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWF.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);

    const baseHTSContractReceiverWalletSecond = new ethers.Contract(BaseHTSContractAddress, BaseHTSJson.abi, accounts[2].wallet);
    const txRWS = await baseHTSContractReceiverWalletSecond.associateTokenPublic(accounts[2].wallet.address, HTSTokenWithCustomFeesContractAddress, Constants.GAS.LIMIT_1_000_000);
    expect((await txRWS.wait()).logs.filter(e => e.fragment.name === Constants.HTS_CONTRACT_EVENTS.ResponseCode)[0].args.responseCode).to.equal(TX_SUCCESS_CODE);
  });
});
