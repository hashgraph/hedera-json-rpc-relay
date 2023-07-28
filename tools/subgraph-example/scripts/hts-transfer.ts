
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

import { AccountId, TokenId, Client, LocalProvider, Wallet, TokenAssociateTransaction, TransferTransaction, PrivateKey } from "@hashgraph/sdk";
import { ethers } from "ethers";

export async function transferHtsFT(receiver: string, hre: any) {
  const networks = await import("../subgraph/networks.json");

  const wallet = new Wallet(
    process.env.OPERATOR_ID!,
    process.env.OPERATOR_KEY!,
    new LocalProvider({client: Client.forNetwork(JSON.parse(process.env.HEDERA_NETWORK!))})
  );
  const account = new ethers.Wallet(receiver);
  const privateKey = PrivateKey.fromStringECDSA(account.privateKey);
  const tokenId = TokenId.fromSolidityAddress(networks.default.local.ExampleHTS.address);
  const accountId = AccountId.fromString("0.0.1013");

  let associateTx = await new TokenAssociateTransaction()
            .setAccountId(accountId)
            .setTokenIds([tokenId])
            .freezeWithSigner(wallet)
  await associateTx.sign(privateKey);
  await (
    await (
        await associateTx.signWithSigner(wallet)
    ).executeWithSigner(wallet)
  ).getReceiptWithSigner(wallet);

  const transferTx = await (
    await (
        await (
            await new TransferTransaction()
                .addTokenTransfer(tokenId, wallet.getAccountId(), -10)
                .addTokenTransfer(tokenId, accountId, 10)
                .freezeWithSigner(wallet)
        ).signWithSigner(wallet)
    ).executeWithSigner(wallet)
  ).getReceiptWithSigner(wallet);

  console.log(`HTS Token transfer has status: ${transferTx.status.toString()}`);
}
