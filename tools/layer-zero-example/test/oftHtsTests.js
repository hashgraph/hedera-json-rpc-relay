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

const HEDERA_EID = 40285;
const BSC_EID = 40102;
const receiverAddress = '0xF51c7a9407217911d74e91642dbC58F18E51Deac';
const amount = '100';

describe('OFTHTSTests', function() {
  it('@hedera @approve oft hts contract', async() => {
    const oftHts = await ethers.getContractAt('ExampleOFTHTS', process.env.OFT_HTS_HEDERA_CONTRACT);
    const tokenAddress = await oftHts.htsTokenAddress();

    const contract = await ethers.getContractAt('ERC20', tokenAddress);
    const txApprove = await contract.approve(process.env.OFT_HTS_HEDERA_CONTRACT, amount)
    const receipt = await txApprove.wait();

    expect(receipt.status).to.equal(1);
  });

  it('@hedera @send to bsc', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      amountLD: amount,
      minAmountLD: amount,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleOFTHTS', process.env.OFT_HTS_HEDERA_CONTRACT);
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
      to: addressToBytes32(receiverAddress),
      amountLD: amount,
      minAmountLD: amount,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      oftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleOFT', process.env.OFT_HTS_BSC_CONTRACT);
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

    const oftHts = await ethers.getContractAt('ExampleOFTHTS', process.env.OFT_HTS_HEDERA_CONTRACT);
    const tokenAddress = await oftHts.htsTokenAddress();

    const contract = await ethers.getContractAt('ERC20', tokenAddress);
    const receiverBalance = await contract.balanceOf(receiverAddress);

    console.log(`(${hre.network.name}) oft contract balance: ${await contract.balanceOf(process.env.OFT_HTS_HEDERA_CONTRACT)}`);
    console.log(`(${hre.network.name}) signer balance: ${await contract.balanceOf(signers[0].address)}`);
    console.log(`(${hre.network.name}) total supply: ${await contract.totalSupply()}`);
    console.log(`(${hre.network.name}) receiver balance: ${receiverBalance}`);

    expect(receiverBalance).to.equal(amount);
  });

  it('@bsc @test balance', async () => {
    const signers = await ethers.getSigners();

    const contract = await ethers.getContractAt('ERC20', process.env.OFT_HTS_BSC_CONTRACT);
    const receiverBalance = await contract.balanceOf(receiverAddress);

    console.log(`(${hre.network.name}) oft contract balance: ${await contract.balanceOf(process.env.OFT_HTS_BSC_CONTRACT)}`);
    console.log(`(${hre.network.name}) signer balance: ${await contract.balanceOf(signers[0].address)}`);
    console.log(`(${hre.network.name}) total supply: ${await contract.totalSupply()}`);
    console.log(`(${hre.network.name}) receiver balance: ${receiverBalance}`);

    expect(receiverBalance).to.equal(amount);
  });
});
