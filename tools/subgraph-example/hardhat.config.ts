/* eslint-disable prettier/prettier */
import * as dotenv from "dotenv";
import * as fs from 'fs';
import * as path from 'path';
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@graphprotocol/hardhat-graph";
import { task } from "hardhat/config";
import { mintNFT, transferERC20, createGravatar } from "./scripts";

dotenv.config();

task("deployERC20", "Deploys ERC20 contract", async (taskArgs, hre) => {
  const contractName = "ExampleERC20";
  await hre.run("compile");

  const wallet = createWallet(hre);
  const ERC20 = await hre.ethers.getContractFactory(
    contractName,
    wallet
  );
  const contract = await ERC20.deploy(20);

  await contract.deployed();
  const deployTx = await contract.deployTransaction.wait();
  const address = deployTx.contractAddress;

  await hre.run("graph", { contractName, address });
  updateStartBlock(contractName, deployTx.blockNumber, hre);

  console.log("CONTRACT DEPLOYED AT:")
  console.log(address);
  console.log(contract.address);
});

task("transferERC20", "Transfers ERC20 tokens to a recipient", async (taskArgs, hre) => {
  await transferERC20(<string>process.env.RECEIVER_PRIVATE_KEY, hre);
});

task("deployERC721", "Deploys ERC721 Contract", async (taskArgs, hre) => {
  const contractName = "ExampleERC721";
  await hre.run("compile");

  const wallet = createWallet(hre);
  const contractArtifacts = await hre.ethers.getContractFactory(
    contractName,
    wallet
  );
  const contract = await contractArtifacts.deploy();

  await contract.deployed();
  const deployTx = await contract.deployTransaction.wait();
  const address = deployTx.contractAddress;

  await hre.run("graph", { contractName, address });
  updateStartBlock(contractName, deployTx.blockNumber, hre);

  console.log("CONTRACT DEPLOYED AT:")
  console.log(address);
  console.log(contract.address);
});

task("mintERC721", "Mints an ERC721 token to a recipient", async (taskArgs, hre) => {
  await mintNFT(<string>process.env.RECEIVER_PRIVATE_KEY, hre);
});

task("deployGravatar", "Deploys the passed contract", async (taskArgs, hre) => {
  const contractName = "GravatarRegistry";
  await hre.run("compile");

  const wallet = createWallet(hre);
  const contractArtifacts = await hre.ethers.getContractFactory(
    contractName,
    wallet
  );
  const contract = await contractArtifacts.deploy();

  await contract.deployed();

  const deployTx = await contract.deployTransaction.wait();
  const address = deployTx.contractAddress;

  await hre.run("graph", { contractName, address });
  updateStartBlock(contractName, deployTx.blockNumber, hre);

  console.log("CONTRACT DEPLOYED AT:")
  console.log(address);
  console.log(contract.address);
});

task("createGravatar", "Creates a Gravatar", async (taskArgs, hre) => {
  await createGravatar('My Gravatar', 'https://example.com/gravatars/1', hre);
});

function updateStartBlock(dataSource: string, startBlock: number, hre: any) {
  const filepath = path.join(__dirname, 'subgraph/networks.json');
  const networksRaw = fs.readFileSync(
    filepath,
    {
      encoding: 'utf-8',
    },
  );
  const networks = JSON.parse(networksRaw);
  networks[hre.network.name][dataSource].startBlock = startBlock;
  fs.writeFileSync(filepath, JSON.stringify(networks, null, 2));
}

function createWallet(hre: any) {
  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );

  return new hre.ethers.Wallet(
    <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );
}

const config = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  defaultNetwork: 'local',
  networks: {
    local: {
      url: process.env.RELAY_ENDPOINT
    }
  },
};

export default config;
