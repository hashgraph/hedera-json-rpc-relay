import { Signer } from "ethers";
import hre, { ethers } from "hardhat";
import networks from "../subgraph/networks.json";

async function main() {
  // const provider = new hre.ethers.providers.JsonRpcProvider(
  //   process.env.RELAY_ENDPOINT
  // );
  // const wallet = new hre.ethers.Wallet(
  //   <string>process.env.OPERATOR_PRIVATE_KEY,
  //   provider
  // );

  // const recipient = new hre.ethers.Wallet(
  //   <string>process.env.RECEIVER_PRIVATE_KEY,
  //   provider
  // );
  // const [signer, recipient] = await ethers.getSigners();
  // const ERC20 = await hre.ethers.getContractFactory("ExampleERC20");
  // const contract = await ERC20.deploy(20);

  // await contract.deployed();

  const ERC20 = await ethers.getContractFactory("ExampleERC20");
  const erc20 = ERC20.attach(networks.local.ExampleERC20.address);
  // const contractName = "ExampleERC20";
  // await hre.run("compile");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  const signer = new hre.ethers.Wallet(
    <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );
  const recipient = new hre.ethers.Wallet(
    <string>process.env.RECEIVER_PRIVATE_KEY,
    provider
  );
  // const ERC20 = await hre.ethers.getContractFactory(contractName, signer);
  // const erc20 = await ERC20.deploy(20);

  // await erc20.deployed();

  // const tx1 = await erc20
  //   .connect(signer)
  //   .approve(erc20.address, 10000000000000000n);
  // console.log(await tx1.wait());
  // console.log("TX HASH:");
  // console.log(tx1.hash);

  const tx2 = await erc20.connect(signer).transfer(recipient.address, 5, {
    gasLimit: 1_000_000,
  });

  console.log(await tx2.wait());
  console.log("TX HASH:");
  console.log(tx2.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
