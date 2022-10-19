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
import '@nomiclabs/hardhat-waffle';
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
  defaultNetwork: 'h_local',
  networks: {
    h_local: {
      url: process.env.RELAY_ENDPOINT,
      accounts: [
        // private keys
        "0x105d050185ccb907fba04dd92d8de9e32c18305e097ab41dadda21489a211524",
        "0x2e1d968b041d84dd120a5860cee60cd83f9374ef527ca86996317ada3d0d03e7",
        "0x45a5a7108a18dd5013cf2d5857a28144beadc9c70b3bdbd914e38df4e804b8d8",
        "0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd",
        "0x0b58b1bd44469ac9f813b5aeaf6213ddaea26720f0b2f133d08b6f234130a64f",
        "0x95eac372e0f0df3b43740fa780e62458b2d2cc32d6a440877f1cc2a9ad0c35cc",
        "0x6c6e6727b40c8d4b616ab0d26af357af09337299f09c66704146e14236972106",
        "0x5072e7aa1b03f531b4731a32a021f6a5d20d5ddc4e55acbb71ae202fc6f3a26d",
        "0x60fe891f13824a2c1da20fb6a14e28fa353421191069ba6b6d09dd6c29b90eff",
        "0xeae4e00ece872dd14fb6dc7a04f390563c7d69d16326f2a703ec8e0934060cc7",
      ],
    }
  },
  typechain: {
    outDir: "types",
    target: "ethers-v5",
  },
};

export default config;