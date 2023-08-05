
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

import { TokenId, Client, LocalProvider, Wallet, TokenMintTransaction } from "@hashgraph/sdk";

export async function mintHtsNft(receiver: string, hre: any) {
  const networks = await import("../subgraph/networks.json");

  const wallet = new Wallet(
    process.env.OPERATOR_ID!,
    process.env.OPERATOR_KEY!,
    new LocalProvider({client: Client.forNetwork(JSON.parse(process.env.HEDERA_NETWORK!))})
  );
  const tokenId = TokenId.fromSolidityAddress(networks.default.local.ExampleHTSNFT.address);

    const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata([Buffer.from("2")])
        .freezeWithSigner(wallet);
    let mintTxSign = await (await mintTx).signWithSigner(wallet);
    const mintTxRecipe = await (await mintTxSign.executeWithSigner(wallet)).getReceiptWithSigner(wallet);
      console.log(`HTS NFT Token mint has status: ${mintTxRecipe.status.toString()}`);
}
