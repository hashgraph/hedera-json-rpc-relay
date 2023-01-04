export async function createGravatar(name: string, url: string, hre: any, signer?: string | null ) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  const wallet = new hre.ethers.Wallet(
    signer || <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );

  const Gravatar = await hre.ethers.getContractFactory("GravatarRegistry");
  const gravatar = Gravatar.attach(networks.local.GravatarRegistry.address);

  const tx = await gravatar.connect(wallet).createGravatar(name, url);

  const receipt = await tx.wait();
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}

export async function updateGravatarName(name: string, hre: any, signer?: string | null ) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );
  const owner = new hre.ethers.Wallet(
    signer || <string>process.env.OPERATOR_PRIVATE_KEY,
    provider
  );

  const Gravatar = await hre.ethers.getContractFactory("GravatarRegistry");
  const gravatar = Gravatar.attach(networks.local.GravatarRegistry.address);

  const tx = await gravatar.connect(owner).updateGravatarName(name);

  const receipt = await tx.wait();
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}
