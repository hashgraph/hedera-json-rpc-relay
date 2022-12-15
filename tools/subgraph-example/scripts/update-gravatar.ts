import hre, { ethers } from "hardhat";
import networks from "../subgraph/networks.json";

async function main() {
  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  const wallet = new hre.ethers.Wallet(
    <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );

  const Gravatar = await ethers.getContractFactory("GravatarRegistry");
  const gravatar = Gravatar.attach(networks.local.GravatarRegistry.address);

  const tx = await gravatar.connect(wallet).updateGravatarName("New Gravatar");

  await tx.wait();
  console.log("TX HASH:");
  console.log(tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
