/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
require('@nomicfoundation/hardhat-chai-matchers');

task('show-balance', async () => {
  const showBalance = require('./scripts/showBalance');
  return showBalance();
});

task('transfer-hbars', async () => {
  const transferHbar = require('./scripts/transferHbars');
  return transferHbar();
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

const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error('Please set your MNEMONIC in a .env file');
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: {
    timeout: 3600000,
  },
  solidity: {
    version: '0.8.9',
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  defaultNetwork: 'local',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic,
      },
    },
    local: {
      url: process.env.RELAY_ENDPOINT,
      accounts: [process.env.OPERATOR_PRIVATE_KEY, process.env.RECEIVER_PRIVATE_KEY],
      chainId: 298,
    },
    testnet: {
      url: 'https://testnet.hashio.io/api',
      accounts: process.env.TESTNET_OPERATOR_PRIVATE_KEY ? [process.env.TESTNET_OPERATOR_PRIVATE_KEY] : [],
      chainId: 296,
    },
  },

  // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify#verifying-on-sourcify
  sourcify: {
    // Enable it to support verification in Hedera's custom Sourcify instance
    enabled: true,
    // Needed to specify a different Sourcify server
    apiUrl: 'https://server-verify.hashscan.io',
    // Needed to specify a different Sourcify repository
    browserUrl: 'https://repository-verify.hashscan.io',
  },
};
