/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
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

require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

task('show-balance', async () => {
  const showBalance = require('./scripts/showBalance');
  return showBalance();
});

task('transfer-hbars', async () => {
  const transferHbars = require('./scripts/transferHbars');
  return transferHbars();
});

task('deploy-contract', async () => {
  const deployContract = require('./scripts/deployContract');
  return deployContract();
});

task('contract-view-call', async (taskArgs) => {
  const contractViewCall = require('./scripts/contractViewCall');
  return contractViewCall(taskArgs.contractAddress);
});

task('contract-call', async (taskArgs) => {
  const contractCall = require('./scripts/contractCall');
  return contractCall(taskArgs.contractAddress, taskArgs.msg);
});

task('test-previewnet', async (taskArgs) => {
  // const hollowWallet = hre.ethers.Wallet.createRandom().connect(ethers.provider);
  const hollowWallet = {address: '0x27ba0FadDb727a3c710d0fC2dcaFa79cEA3331f2'};
  console.log(hollowWallet.address);
  const signer = (await hre.ethers.getSigners())[0];
  console.log(await hre.ethers.provider.getBalance(hollowWallet.address));
  console.log(await hre.ethers.provider.getBalance(signer.address));
});

module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'h_previewnet',
  networks: {
    h_relay: {
      url: 'http://localhost:7546',
      accounts: [
        "0x484961ec6c67c270dc5659ea8bb61489967c6acc574d81b1e046e072d5d2436d",
        "0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129",
      ],
      chainId: 296
    },
    h_testnet: {
      timeout: 600_000,
      url: "https://testnet.hashio.io/api",
      accounts: [
        "0x484961ec6c67c270dc5659ea8bb61489967c6acc574d81b1e046e072d5d2436d",
        "0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129",
      ],
      chainId: 296
    },
    h_previewnet: {
      timeout: 600_000,
      url: "https://previewnet.hashio.io/api",
      accounts: [
        "0x551692d20bc9e0e704f9165533ffef060f5f6d33359078fe29d3c35958c4c743",
      ],
      chainId: 297
    }
  }
};
