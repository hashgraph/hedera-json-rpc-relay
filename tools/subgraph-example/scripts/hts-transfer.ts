
import { AccountId, TokenId, Client, LocalProvider, Wallet, TokenAssociateTransaction, TransferTransaction, PrivateKey } from "@hashgraph/sdk";
import { ethers } from "ethers";

export async function transferHts(receiver: string, hre: any) {
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
