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

export async function createGravatar(
  name: string,
  url: string,
  hre: any,
  signer?: string | null,
) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT,
  );
  const wallet = new hre.ethers.Wallet(
    signer || <string>process.env.OPERATOR_PRIVATE_KEY,
    provider,
  );

  const Gravatar = await hre.ethers.getContractFactory("GravatarRegistry");
  const gravatar = Gravatar.attach(networks.local.GravatarRegistry.address);

  const tx = await gravatar
    .connect(wallet)
    .createGravatar(name, url, { gasLimit: 500_000 });

  const receipt = await tx.wait();
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}

export async function updateGravatarName(
  name: string,
  hre: any,
  signer?: string | null,
) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT,
  );
  const owner = new hre.ethers.Wallet(
    signer || <string>process.env.OPERATOR_PRIVATE_KEY,
    provider,
  );

  const Gravatar = await hre.ethers.getContractFactory("GravatarRegistry");
  const gravatar = Gravatar.attach(networks.local.GravatarRegistry.address);

  const tx = await gravatar
    .connect(owner)
    .updateGravatarName(name, { gasLimit: 500_000 });

  const receipt = await tx.wait();
  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}
