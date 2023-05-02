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
import EstimateGasContractJson from '../contracts/EstimateGasContract.json';
import { AliasAccount } from '../clients/servicesClient';

describe('EstimateGasContract tests', function() {
  const signers: AliasAccount[] = [];
  let contract: ethers.Contract;
  let randomAddress: string;
  const { servicesNode, relay }: any = global;

  const add0xPrefix = (num) => {
    return num.startsWith('0x') ? num : '0x' + num;
  };

  const estimateGasCall = async (body = {}) => {
    return await relay.call('eth_estimateGas', [body]);
  };

  before(async function() {
    signers[0] = await servicesNode.createAliasAccount(15, null, Utils.generateRequestId());

    const contractReceipt = await servicesNode.deployContract(EstimateGasContractJson, 500_000);
    contract = new ethers.Contract(contractReceipt.contractId.toSolidityAddress(), EstimateGasContractJson.abi, signers[0].wallet);

    randomAddress = (ethers.Wallet.createRandom()).address;
  });

  const baseGasCheck = (response) => {
    const gasValue = ethers.BigNumber.from(response);
    expect(gasValue.toNumber()).to.be.greaterThan(0);
  };

  const expectRevert = (response) => {
    expect(response).to.haveOwnProperty('_status');
    expect(response._status).to.haveOwnProperty('messages');
    expect(response._status.messages).to.not.be.empty;
  };

  it('#001 Pure function without arguments that multiplies two numbers', async function() {
    const tx = await contract.populateTransaction.pureMultiply();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#002 Function with msg.send (address)', async function() {
    const tx = await contract.populateTransaction.msgSender();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#003 Function with tx.origin (address)', async function() {
    const tx = await contract.populateTransaction.txOrigin();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#004 Function with msg.value (uint)', async function() {
    const tx = await contract.populateTransaction.msgValue();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#005 Function with msg.sig (bytes4)', async function() {
    const tx = await contract.populateTransaction.msgSig();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#006 Function with .balance (uint256)', async function() {
    const tx = await contract.populateTransaction.addressBalance(signers[0].address);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#007 Function that accepts an argument and change contract slot information by updating global contract field with the passed argument', async function() {
    const tx = await contract.populateTransaction.updateCounter(5644);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#008 Function that successfully deploys a new smart contract via CREATE op code', async function() {
    const tx = await contract.populateTransaction.deployViaCreate();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#009 Function that successfully deploys a new smart contract via CREATE2 op code', async function() {
    const tx = await contract.populateTransaction.deployViaCreate2();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#010 Function that makes a static call to a method from a different contract (test STATICCALL op code)', async function() {
    const tx = await contract.populateTransaction.staticCallToContract();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#011 Function that makes a delegate call to a method from a different contract (test DELEGATECALL op code)', async function() {
    const tx = await contract.populateTransaction.delegateCallToContract();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#012 Function that makes a call code to a method from a different contract (test CALLCODE op code)', async function() {
    const tx = await contract.populateTransaction.callCodeToContract();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#013 Function that perfroms LOG0, LOG1, LOG2, LOG3, LOG4 operations (test those op code)', async function() {
    const tx = await contract.populateTransaction.logs();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#014 Function that performs self destruct (test SELFDESCTRUCT op code)', async function() {
    const tx = await contract.populateTransaction.destroy();
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#015 "data" from request body with wrong method signature', async function() {
    const estimateGasResponse = await estimateGasCall({
      data: '0xffffffff',
      to: add0xPrefix(contract.address),
      from: add0xPrefix(signers[0].address)
    });
    baseGasCheck(estimateGasResponse);
  });
  it('#016 "data" from request body with wrong encoded parameter', async function() {
    const estimateGasResponse = await estimateGasCall({
      data: '0x3ec4de35',
      to: add0xPrefix(contract.address),
      from: add0xPrefix(signers[0].address)
    });
    baseGasCheck(estimateGasResponse);
  });
  it('#017 non existing "from" from request body', async function() {
    const estimateGasResponse = await estimateGasCall({
      data: '0x0ec1551d',
      to: add0xPrefix(contract.address),
      from: randomAddress
    });
    baseGasCheck(estimateGasResponse);
  });
  it('#018 non existing "to" from request body', async function() {
    const estimateGasResponse = await estimateGasCall({
      data: '0x0ec1551d',
      to: randomAddress,
      from: add0xPrefix(signers[0].address)
    });
    baseGasCheck(estimateGasResponse);
  });
  it('#019 Function that makes a call to a method to invalid smart contract', async function() {
    const tx = await contract.populateTransaction.callToInvalidContract(randomAddress);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#020 Function that makes a delegate call to a method to invalid smart contract', async function() {
    const tx = await contract.populateTransaction.delegateCallToInvalidContract(randomAddress);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#021 Function that makes a static call to a method to invalid smart contract', async function() {
    const tx = await contract.populateTransaction.staticCallToInvalidContract(randomAddress);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
  it('#022 Function that makes a call code to a method to invalid smart contract', async function() {
    const tx = await contract.populateTransaction.callCodeToInvalidContract(randomAddress);
    const estimateGasResponse = await estimateGasCall(tx);
    baseGasCheck(estimateGasResponse);
  });
});
