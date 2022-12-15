import networks from "../subgraph/networks.json";

export async function transferERC20(receiver: string, hre: any) {
  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  const wallet = new hre.ethers.Wallet(
    <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );

  const recipient = new hre.ethers.Wallet(receiver, provider);

  const ERC20 = await hre.ethers.getContractFactory("ExampleERC20");
  const erc20 = ERC20.attach(networks.local.ExampleERC20.address);

  const tx = await erc20.connect(wallet).transfer(recipient.address, 1);

  const receipt = await tx.wait();
  console.log(receipt);
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}
