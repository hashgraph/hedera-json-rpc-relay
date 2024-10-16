const { Client, PrivateKey, TransferTransaction, AccountId, Hbar } = require('@hashgraph/sdk');
const { exit } = require('process');

const operatorAccountId = process.env.OPERATOR_ID_MAIN;
const operatorPrivateKey = process.env.OPERATOR_KEY_MAIN;


if (!operatorAccountId || !operatorPrivateKey) {
  throw new Error('Operator ID and Private Key must be set.');
}

const client = Client.forTestnet();
client.setOperator(operatorAccountId, operatorPrivateKey);

const numberOfAccounts = 4;

// Initial balance for each new account (in tinybars)
const initialBalanceTinybar = Hbar.fromTinybars(1000000000); // Equivalent to 10 HBAR

async function main() {

  for (let i = 1; i <= numberOfAccounts; i++) {
    console.log(`\n=== Creating Alias Account ${i} ===`);

    const privateKey = PrivateKey.generateECDSA();
    const publicKey = privateKey.publicKey;

    console.log(`Generated ECDSA Private Key: ${privateKey.toStringRaw()}`);
    console.log(`Generated ECDSA Public Key: ${publicKey.toStringRaw()}`);

    const ethereumAddress = publicKey.toEthereumAddress();

    console.log(`Ethereum Address: 0x${ethereumAddress.toString()}`);

    const aliasAccountId = AccountId.fromEvmAddress(0, 0, ethereumAddress);

    const transferTx = await new TransferTransaction()
      .addHbarTransfer(operatorAccountId, initialBalanceTinybar.negated())
      .addHbarTransfer(aliasAccountId, initialBalanceTinybar)
      .execute(client);

    const receipt = await transferTx.getReceipt(client);
    console.log(`Transfer Transaction Status: ${receipt.status.toString()}`);

  }

  exit();
}

main().catch((error) => {
  console.error('Error creating alias accounts:', error);
});