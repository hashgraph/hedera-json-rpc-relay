const {
  Client, PrivateKey, TransferTransaction, AccountId, Hbar, AccountInfoQuery
} = require('@hashgraph/sdk');

async function getClientOfNewCreatedAccount() {
  const INITIAL_BALANCE = 5; // hbars
  const customClient = Client.forTestnet()
    .setOperator('0.0.1362', PrivateKey.fromStringECDSA('0x8d193e86dcaeb6079ce70a695935688e438f8e51a450353b6763b5101ad5257c'));

  const newAccountPrivateKey = PrivateKey.generateECDSA();
  const newAccountId = newAccountPrivateKey.publicKey.toAccountId(0, 0);

  const transferTransaction = new TransferTransaction()
    .addHbarTransfer(AccountId.fromEvmAddress(0, 0, newAccountPrivateKey.publicKey.toEvmAddress()), new Hbar(INITIAL_BALANCE))
    .addHbarTransfer(AccountId.fromString('0.0.1362'), new Hbar(-INITIAL_BALANCE));
  const tx = await transferTransaction.execute(customClient);
  await tx.getReceipt(customClient);

  const newAccountInfo = await new AccountInfoQuery()
    .setAccountId(newAccountId)
    .execute(customClient);

  console.log(`Created new account with id: ${newAccountInfo.accountId.toString()} pk: ${newAccountPrivateKey.toStringRaw()} and balance: ${newAccountInfo.balance.toString()}.`);
  process.exit(0);
}

getClientOfNewCreatedAccount();
