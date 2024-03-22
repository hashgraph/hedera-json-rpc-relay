const hre = require('hardhat');
const { Client, AccountDeleteTransaction, PrivateKey } = require('@hashgraph/sdk');

async function main() {
  // await createAccount();return;

  const NETWORK = hre.config.defaultNetwork;
  const MIRROR_NODE_URL = hre.config.networks[NETWORK].mirrorNodeREST;

  console.log(`Selected network: ${NETWORK}`);

  const deletableWallet = new hre.ethers.Wallet(process.env.DELETABLE_ACCOUNT_PK);

  const preDeletionAccount = await (await fetch(`${MIRROR_NODE_URL}/api/v1/accounts/${deletableWallet.address}`)).json();
  console.log(`address: ${preDeletionAccount.evm_address} deleted: ${preDeletionAccount.deleted} balance: ${preDeletionAccount.balance.balance}`);

  const client = Client.forNetwork(NETWORK)
    .setOperator(process.env.OPERATOR_ID, PrivateKey.fromStringECDSA(process.env.OPERATOR_PK));

  const transaction = new AccountDeleteTransaction()
    .setAccountId(preDeletionAccount.account)
    .setTransferAccountId(process.env.OPERATOR_ID);

  const txResponse = await (await transaction.freezeWith(client).sign(PrivateKey.fromStringECDSA(process.env.DELETABLE_ACCOUNT_PK))).execute(client);
  const receipt = await txResponse.getReceipt(client);

  console.log('deletion status: ' + receipt.status + ' (SUCCESS = 22)');
  console.log('waiting for mirror node data population...');
  await new Promise(r => setTimeout(r, 5000));

  const afterDeletionAccount = await (await fetch(`${MIRROR_NODE_URL}/api/v1/accounts/${deletableWallet.address}`)).json();
  console.log(`mirror node query after deletion: ${afterDeletionAccount?._status?.messages[0]?.message} (expected "Not found")`);
  process.exit(1);
}

async function createAccount() {
  const newWallet = hre.ethers.Wallet.createRandom();
  console.log(`address: ${newWallet.address}\nprivate key: ${newWallet.privateKey}`);

  const [signer] = await hre.ethers.getSigners();
  await signer.sendTransaction({
    to: newWallet.address,
    value: '10000000000000000000' // 10 hbars
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
