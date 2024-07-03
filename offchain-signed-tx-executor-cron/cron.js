require('dotenv').config();
const cron = require('node-cron');
const {
  AccountDeleteTransaction, Client, Timestamp
} = require('@hashgraph/sdk');

// check the validStart time every 15 seconds
cron.schedule('*/15 * * * * *', async () => {
  // mainnet
  const executorClient = Client.forNetwork({
    '35.186.191.247:50211': '0.0.4'
  });

  // testnet client
  // const executorClient = Client.forNetwork({
  //   '35.237.119.55:50211': '0.0.4'
  // });

  const tx = AccountDeleteTransaction.fromBytes(Buffer.from(process.env.SIGNED_TX_BYTES, 'hex'));
  const { validStart } = tx._transactionIds.get(0);

  console.log('node id: ' + tx._nodeAccountIds.get(0).toString());
  console.log('tx id:   ' + tx._transactionIds.get(0).toString());
  console.log('\n');

  if (validStart.compare(Timestamp.generate()) < 0) {
    const res = await tx.execute(executorClient);
    const receipt = await res.getReceipt(executorClient);

    console.log('deletion status: ' + receipt.status + ' (SUCCESS = 22)');
    process.exit(0);
  }
});
