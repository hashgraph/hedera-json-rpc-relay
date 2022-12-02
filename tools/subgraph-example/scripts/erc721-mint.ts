import networks from "../subgraph/networks.json";

export async function mintNFT(receiver: string, hre: any) {
  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );

  const recipient = new hre.ethers.Wallet(receiver, provider);

  const ERC721 = await hre.ethers.getContractFactory("ExampleERC721");
  const erc721 = ERC721.attach(networks.local.ExampleERC721.address);
  const tx = await erc721.connect(recipient).mint(recipient.address);

  console.log(await tx.wait());
  console.log("TX HASH:");
  console.log(tx.hash);
}
