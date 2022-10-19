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

import "dotenv/config";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-network-metadata";
import { task } from "hardhat/config";

task('get-current-block', async () => {
  const file = await import('./scripts/getCurrentBlock');
  return file.getCurrentBlock();
});

task('show-balance', async () => {
  const file = await import('./scripts/showBalance');
  return file.showBalance();
});

task('transfer-hbars', async () => {
  const file = await import('./scripts/transferHbars');
  return file.transferHbars();
});

task('deploy-contract', async () => {
  const file = await import('./scripts/deployContract');
  return file.deployContract();
});

task('contract-view-call', async (taskArgs: any) => {
  const file = await import('./scripts/contractViewCall');
  return file.contractViewCall(taskArgs.contractAddress);
});

task('contract-call', async (taskArgs: any) => {
  const file = await import('./scripts/contractCall');
  return file.contractCall(taskArgs.contractAddress, taskArgs.msg);
})
.addPositionalParam("contractAddress")
.addPositionalParam("msg");

const config = {
  solidity: '0.8.4',
  defaultNetwork: 'relay',
  networks: {
    relay: {
      url: process.env.RELAY_ENDPOINT
    }
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
};

export default config;