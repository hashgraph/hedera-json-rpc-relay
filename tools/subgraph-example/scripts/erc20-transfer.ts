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

export async function transferERC20(receiver: string, hre: any) {
  const networks = await import("../subgraph/networks.json");

  const provider = new hre.ethers.providers.JsonRpcProvider(
    process.env.RELAY_ENDPOINT,
  );
  const wallet = new hre.ethers.Wallet(
    <string>process.env.OPERATOR_PRIVATE_KEY,
    provider,
  );

  const recipient = new hre.ethers.Wallet(receiver, provider);

  const ERC20 = await hre.ethers.getContractFactory("ExampleERC20");
  const erc20 = ERC20.attach(networks.local.ExampleERC20.address);

  const tx = await erc20.connect(wallet).transfer(recipient.address, 1);

  const receipt = await tx.wait();

  console.log("TX HASH:");
  console.log(receipt.transactionHash);
}
