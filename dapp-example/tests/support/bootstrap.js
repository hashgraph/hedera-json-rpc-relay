const HederaSDK = require('@hashgraph/sdk');
const ethers = require('ethers');
const hethers = require('@hashgraph/hethers');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const randomUppercaseString = (length = 5) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(crypto.randomInt(charactersLength));
  }

  return result;
};

const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];

let client;
const network = process.env.HEDERA_NETWORK || '{}';
if (supportedEnvs.includes(network.toLowerCase())) {
    client = HederaSDK.Client.forName(network);
} else {
    client = HederaSDK.Client.forNetwork(JSON.parse(network));
}

client.setOperator(process.env.OPERATOR_ID_MAIN, process.env.OPERATOR_KEY_MAIN);

const createAccountFromCompressedPublicKey = async function(compressedPublicKey) {
  const transferTransaction = await (new HederaSDK.TransferTransaction()
    .addHbarTransfer(HederaSDK.PublicKey.fromString(compressedPublicKey).toAccountId(0, 0), new HederaSDK.Hbar(100))
    .addHbarTransfer(HederaSDK.AccountId.fromString(process.env.OPERATOR_ID_MAIN), new HederaSDK.Hbar(-100)))
    .execute(client);

  const txTransaction = await (new HederaSDK.TransactionRecordQuery()
    .setTransactionId(transferTransaction.transactionId))
    .execute(client);

  const transfer = txTransaction.transfers.find(trans => !trans.amount.isNegative() && trans.accountId.num.toNumber() > 999);
  const accountId = transfer.accountId.toString();

  console.log(`Account has been successfully created: ${accountId}`);

  return { accountId };
};

const createHTSToken = async function() {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 30);
  const tokenCreate = await (await new HederaSDK.TokenCreateTransaction()
    .setTokenName(randomUppercaseString(8))
    .setTokenSymbol(randomUppercaseString(4))
    .setExpirationTime(expiration)
    .setDecimals(8)
    .setInitialSupply(200000000000)
    .setTreasuryAccountId(client.operatorAccountId)
    .setTransactionId(HederaSDK.TransactionId.generate(client.operatorAccountId))
    .setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]))
    .execute(client);

  const receipt = await tokenCreate.getReceipt(client);
  const tokenId = receipt.tokenId.toString();
  const tokenAddress = hethers.utils.getAddressFromAccount(tokenId);

  console.log(`HTS Token Deployed at: ${tokenAddress} with id ${tokenId}`);

  return { tokenId, tokenAddress };
};

const associateHTSToken = async function(accountId, tokenId, pk) {
  const tokenAssociate = await (await new HederaSDK.TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(HederaSDK.PrivateKey.fromStringECDSA(pk)))
    .execute(client);

  await tokenAssociate.getReceipt(client);
  console.log(`HTS Token ${tokenId} associated to : ${accountId}`);
};

const approveHTSToken = async function(spenderId, tokenId) {
  const amount = 100000000000;
  const tokenApprove = await (new HederaSDK.AccountAllowanceApproveTransaction()
    .addTokenAllowance(tokenId, spenderId, amount))
    .execute(client);

  await tokenApprove.getReceipt(client);
  console.log(`${amount} of HTS Token ${tokenId} can be spent by ${spenderId}`);
};

const transferHTSToken = async function(accountId, tokenId) {
  const amount = 50000000000;
  const tokenTransfer = await (await new HederaSDK.TransferTransaction()
    .addTokenTransfer(tokenId, client.operatorAccountId, -amount)
    .addTokenTransfer(tokenId, accountId, amount))
    .execute(client);

  await tokenTransfer.getReceipt(client);
  console.log(`${amount} of HTS Token ${tokenId} can be spent by ${accountId}`);
};

(async () => {
  const mainWallet = new ethers.Wallet(process.env.PRIVATE_KEY);
  const mainCompressedKey = mainWallet._signingKey().compressedPublicKey.replace('0x', '');
  const mainAccountId = (await createAccountFromCompressedPublicKey(mainCompressedKey)).accountId;

  const receiverWallet = new ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY);
  const receiverCompressedKey = receiverWallet._signingKey().compressedPublicKey.replace('0x', '');
  const receiverAccountId = (await createAccountFromCompressedPublicKey(receiverCompressedKey)).accountId;

  const { tokenId, tokenAddress } = await createHTSToken();
  fs.writeFileSync(path.resolve(__dirname + '../../../') + '/.htsTokenAddress.json', '{"HTS_ADDRESS":"' + tokenAddress + '"}');

  await associateHTSToken(mainAccountId, tokenId, process.env.PRIVATE_KEY);
  await approveHTSToken(mainAccountId, tokenId);

  await associateHTSToken(receiverAccountId, tokenId, process.env.RECEIVER_PRIVATE_KEY);
  await approveHTSToken(receiverAccountId, tokenId);

  await transferHTSToken(mainAccountId, tokenId);
  await transferHTSToken(receiverAccountId, tokenId);

  process.exit(0);
})();
