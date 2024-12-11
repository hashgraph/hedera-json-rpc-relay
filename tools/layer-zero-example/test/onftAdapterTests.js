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

describe('ONFTAdapterTests', function() {
  it('@hedera @mint to signer', async () => {
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_HEDERA_CONTRACT);
    const tx = await contract.mint(signers[0].address, 1);
    const receipt = await tx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@hedera @mint to adapter', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_HEDERA_CONTRACT);
    const tx = await contract.mint(process.env.ONFT_ADAPTER_HEDERA_CONTRACT, 2);
    const receipt = await tx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@bsc @mint to signer', async () => {
    const signers = await ethers.getSigners();
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_BSC_CONTRACT);
    const tx = await contract.mint(signers[0].address, 2);
    const receipt = await tx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@bsc @mint to adapter', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_BSC_CONTRACT);
    const tx = await contract.mint(process.env.ONFT_ADAPTER_BSC_CONTRACT, 1);
    const receipt = await tx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@hedera @approve adapter', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_HEDERA_CONTRACT);
    const approveTx = await contract.approve(process.env.ONFT_ADAPTER_HEDERA_CONTRACT, 1);
    const receipt = await approveTx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@bsc @approve adapter', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_BSC_CONTRACT);
    const approveTx = await contract.approve(process.env.ONFT_ADAPTER_BSC_CONTRACT, 2);
    const receipt = await approveTx.wait();
    expect(!!receipt.status).to.be.true;
  });

  it('@hedera @send to bsc', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: BSC_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 1,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      onftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleONFTAdapter', process.env.ONFT_ADAPTER_HEDERA_CONTRACT);
    const tx = await contract.send(sendParam, { nativeFee: '500000000', lzTokenFee: 0 }, signers[0].address, {
      gasLimit: 10_000_000,
      value: '5000000000000000000'
    });

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${tx.hash}`);
  });

  it('@bsc @send to hedera', async () => {
    const signers = await ethers.getSigners();

    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(receiverAddress),
      tokenId: 2,
      extraOptions: Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toBytes(),
      composeMsg: ethers.utils.arrayify('0x'),
      onftCmd: ethers.utils.arrayify('0x')
    };

    const contract = await ethers.getContractAt('ExampleONFTAdapter', process.env.ONFT_ADAPTER_BSC_CONTRACT);
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

  it('@hedera @test get owner', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_HEDERA_CONTRACT);
    console.log('owner of 1: ' + await contract.ownerOf(1));
    console.log('owner of 2: ' + await contract.ownerOf(2));
  });

  it('@bsc @test get owner', async () => {
    const contract = await ethers.getContractAt('ERC721Mock', process.env.ERC721_BSC_CONTRACT);
    console.log('owner of 1: ' + await contract.ownerOf(1));
    console.log('owner of 2: ' + await contract.ownerOf(2));
  });
});
