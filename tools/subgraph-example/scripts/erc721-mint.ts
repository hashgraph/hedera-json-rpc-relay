/*-
 *
 * Hedera JSON RPC Relay - Hardhat Example
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

export async function mintNFT(receiver: string, hre: any) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT
  );

  const recipient = new hre.ethers.Wallet(receiver, provider);

  const ERC721 = await hre.ethers.getContractFactory("ExampleERC721");
  const erc721 = ERC721.attach(networks.local.ExampleERC721.address);
  const tx = await erc721.connect(recipient).mint(recipient.address, {gasLimit: 500_000});

  const receipt = await tx.wait();
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}
