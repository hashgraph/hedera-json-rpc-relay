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

module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'relay',
  networks: {
    relay: {
      url: process.env.RELAY_ENDPOINT
    }
  }
};
