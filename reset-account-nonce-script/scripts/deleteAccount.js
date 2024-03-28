/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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

const hre = require('hardhat');
const { Client, AccountDeleteTransaction, PrivateKey } = require('@hashgraph/sdk');

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
