/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

const hre = require('hardhat');
const { ethers } = hre;
const { Options, addressToBytes32 } = require('@layerzerolabs/lz-v2-utilities');
const { expect } = require('chai');
const CONSTANTS = require('./constants');

const { HEDERA_EID, BSC_EID, RECEIVER_ADDRESS } = CONSTANTS;
const amount = '100';

describe('HTSConnectorExistingToken', function() {
  it('@hedera @update-keys', async () => {
    const contract = await ethers.getContractAt('CreateHTS', process.env.HTS_CONNECTOR_CREATE_HTS_CONTRACT);
    const updatedKey = [
      false,
      process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT,
      '0x',
      '0x',
      '0x0000000000000000000000000000000000000000'
    ];
    const tx = await contract.updateTokenKeysPublic(
      [
        [16, updatedKey]
      ]
    );
    const receipt = await tx.wait();

    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${tx.hash}`);

    expect(receipt.status).to.equal(1);
  });

  it('@hedera @fund', async () => {
    const oftHts = await ethers.getContractAt('ExampleHTSConnectorExistingToken', process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT);
    const tokenAddress = await oftHts.htsTokenAddress();

    const contract = await ethers.getContractAt('ERC20', tokenAddress);
    const txTransfer = await contract.transfer(process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT, '200');
    const receipt = await txTransfer.wait();
    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${txTransfer.hash}`);

    expect(receipt.status).to.equal(1);
  });

  it('@hedera @approve oft hts contract', async () => {
    const oftHts = await ethers.getContractAt('ExampleHTSConnectorExistingToken', process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT);
    const tokenAddress = await oftHts.htsTokenAddress();

    const contract = await ethers.getContractAt('ERC20', tokenAddress);
    const txApprove = await contract.approve(process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT, amount);
    const receipt = await txApprove.wait();
    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${txApprove.hash}`);

    expect(receipt.status).to.equal(1);
  });

  it('@hedera @send to bsc', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(RECEIVER_ADDRESS),
      amountLD: amount,
      minAmountLD: amount,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleHTSConnectorExistingToken', process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to BSC via tx: ${tx.hash}`);
  });

  it('@bsc @send to hedera', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(RECEIVER_ADDRESS),
      amountLD: amount,
      minAmountLD: amount,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleOFT', process.env.HTS_CONNECTOR_EXISTING_TOKEN_BSC_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${tx.hash}`);
  });

  it('@hedera @test balance', async () => {
    const signers = await ethers.getSigners();

    const oftHts = await ethers.getContractAt('ExampleHTSConnectorExistingToken', process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT);
    const tokenAddress = await oftHts.htsTokenAddress();

    const contract = await ethers.getContractAt('ERC20', tokenAddress);
    const receiverBalance = await contract.balanceOf(RECEIVER_ADDRESS);

    console.log(`(${hre.network.name}) oft contract balance: ${await contract.balanceOf(process.env.HTS_CONNECTOR_EXISTING_TOKEN_HEDERA_CONTRACT)}`);
    console.log(`(${hre.network.name}) signer balance: ${await contract.balanceOf(signers[0].address)}`);
    console.log(`(${hre.network.name}) total supply: ${await contract.totalSupply()}`);
    console.log(`(${hre.network.name}) receiver balance: ${receiverBalance}`);

    expect(receiverBalance).to.equal(amount);
  });

  it('@bsc @test balance', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ERC20', process.env.HTS_CONNECTOR_EXISTING_TOKEN_BSC_CONTRACT);
    const receiverBalance = await contract.balanceOf(RECEIVER_ADDRESS);

    console.log(`(${hre.network.name}) oft contract balance: ${await contract.balanceOf(process.env.HTS_CONNECTOR_EXISTING_TOKEN_BSC_CONTRACT)}`);
    console.log(`(${hre.network.name}) signer balance: ${await contract.balanceOf(signers[0].address)}`);
    console.log(`(${hre.network.name}) total supply: ${await contract.totalSupply()}`);
    console.log(`(${hre.network.name}) receiver balance: ${receiverBalance}`);

    expect(receiverBalance).to.equal(amount);
  });
});
