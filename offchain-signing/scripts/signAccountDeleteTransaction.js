require('dotenv').config();
const {
  AccountDeleteTransaction, PrivateKey, AccountId, TransactionId, Timestamp
} = require('@hashgraph/sdk');

const ONE_DAY_AS_NANOS = 86_400_000_000_000;
const VALID_START_DAYS_OFFSET = (process.env.VALID_START_DAYS_OFFSET && Number.isInteger(Number(process.env.VALID_START_DAYS_OFFSET)))
  ? parseInt(process.env.VALID_START_DAYS_OFFSET)
  : 30;

async function main() {
  const deletableAccountPk = PrivateKey.fromStringECDSA(process.env.DELETABLE_ACCOUNT_PK);
  const deletableAccountId = new AccountId(0, 0, process.env.DELETABLE_ACCOUNT_NUM);
  const receiverAccountId = new AccountId(0, 0, process.env.RECEIVER_ACCOUNT_NUM);

  const transaction = new AccountDeleteTransaction()
    .setTransactionValidDuration(180)
    .setAccountId(deletableAccountId)
    .setTransferAccountId(receiverAccountId);

  const validStartTimestamp = Timestamp.generate().plusNanos(ONE_DAY_AS_NANOS * VALID_START_DAYS_OFFSET);
  const signedTx = await transaction
    .setTransactionId(new TransactionId(deletableAccountId, validStartTimestamp))
    .setNodeAccountIds([
      new AccountId(0, 0, 4)
    ])
    .freeze()
    .sign(deletableAccountPk);

  console.log('signed tx id:    ' + signedTx._transactionIds.get(0));
  console.log('signed tx bytes: ' + (await signedTx.toBytesAsync()).toString('hex'));

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
