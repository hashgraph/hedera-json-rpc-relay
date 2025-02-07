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

/* eslint-disable prettier/prettier */
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
require("@typechain/hardhat");
require("@nomiclabs/hardhat-waffle");
require("hardhat-graph");
const { task } = require("hardhat/config");
const {
  mintNFT,
  transferERC20,
  createGravatar,
  updateGravatarName,
  transferHtsFT,
  mintHtsNft,
} = require("./scripts");
const {
  Client,
  LocalProvider,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  Wallet,
} = require("@hashgraph/sdk");

dotenv.config();

task("deployERC20", "Deploys ERC20 contract", async (taskArgs, hre) => {
  const contractName = "ExampleERC20";
  await hre.run("compile");

  const wallet = createWallet(hre);
  const ERC20 = await hre.ethers.getContractFactory(contractName, wallet);
  const contract = await ERC20.deploy(20);

  await contract.deployed();
  const deployTx = await contract.deployTransaction.wait();
  const address = deployTx.contractAddress;

  await hre.run("graph", { contractName, address });
  updateStartBlock(contractName, deployTx.blockNumber, hre);

  console.log("CONTRACT DEPLOYED AT:");
  console.log(address);
});

task("transferERC20", "Transfers ERC20 tokens to a recipient", async (taskArgs, hre) => {
  await transferERC20(process.env.RECEIVER_PRIVATE_KEY, hre);
});

function updateStartBlock(dataSource, startBlock, hre) {
  const filepath = path.join(__dirname, "subgraph/networks.json");
  const networksRaw = fs.readFileSync(filepath, {
    encoding: "utf-8",
  });
  const networks = JSON.parse(networksRaw);
  networks[hre.network.name][dataSource].startBlock = startBlock || 0;
  fs.writeFileSync(filepath, JSON.stringify(networks, null, 2));
}

function createWallet(hre) {
  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  return new hre.ethers.Wallet(
    process.env.OPERATOR_PRIVATE_KEY,
    provider
  );
}

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "local",
  networks: {
    local: {
      url: process.env.RELAY_ENDPOINT,
    },
  },
};
