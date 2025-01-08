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

describe('ONFTTests', function() {
  it('@hedera @send to bsc', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(RECEIVER_ADDRESS),
      tokenId: 1,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      onftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleONFT', process.env.ONFT_HEDERA_CONTRACT);
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
      tokenId: 2,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      onftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleONFT', process.env.ONFT_BSC_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '1000000000000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 1_000_000,
      value: '1000000000000000'
    });

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to BSC via tx: ${tx.hash}`);
  });

  it('@hedera @test get owner', async () => {
    const contract = await ethers.getContractAt('ExampleONFT', process.env.ONFT_HEDERA_CONTRACT);
    const owner = await contract.ownerOf(2);
    expect(owner).to.equal(RECEIVER_ADDRESS);
  });

  it('@bsc @test get owner', async () => {
    const contract = await ethers.getContractAt('ExampleONFT', process.env.ONFT_BSC_CONTRACT);
    const owner = await contract.ownerOf(1);
    expect(owner).to.equal(RECEIVER_ADDRESS);
  });
});
