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
const { Options } = require('@layerzerolabs/lz-v2-utilities');
const { expect } = require('chai');

const HEDERA_EID = 40285;
const BSC_EID = 40102;
const DATA_FROM_HEDERA = 'dataFromHedera';
const DATA_FROM_BSC = 'dataFromBsc';

describe('OAppTests', function() {
  it('@hedera @send to bsc', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', process.env.OAPP_HEDERA_CONTRACT);
    const tx = await contract.send(
      BSC_EID,
      DATA_FROM_HEDERA,
      Options.newOptions().addExecutorLzReceiveOption(3000000, 0).toHex(),
      { gasLimit: 10_000_000, value: '5000000000000000000' }
    );

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to BSC via tx: ${tx.hash}`);
  });

  it('@bsc @send to hedera', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', process.env.OAPP_BSC_CONTRACT);
    const tx = await contract.send(
      HEDERA_EID,
      DATA_FROM_BSC,
      Options.newOptions().addExecutorLzReceiveOption(300000, 0).toHex(),
      { gasLimit: 12_000_000, value: '1000000000000000' }
    );

    const receipt = await tx.wait();
    if (!receipt.status) {
      process.exit(`Execution failed. Tx hash: ${tx.hash}`);
    }

    console.log(`(${hre.network.name}) successfully sent to Hedera via tx: ${tx.hash}`);
  });

  it('@hedera @test data()', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', process.env.OAPP_HEDERA_CONTRACT);
    const data = await contract.data();
    console.log(`(${hre.network.name}) data: ${data}`);

    expect(data).to.equal(DATA_FROM_BSC);
  });

  it('@bsc @test data()', async () => {
    const contract = await ethers.getContractAt('ExampleOApp', process.env.OAPP_BSC_CONTRACT);
    const data = await contract.data();
    console.log(`(${hre.network.name}) data: ${data}`);

    expect(data).to.equal(DATA_FROM_HEDERA);
  });
});
