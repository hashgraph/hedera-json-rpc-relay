/*-
 *
 * Hedera JSON RPC Relay - Web3js Example
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

require('dotenv').config();
const Web3 = require('web3');
const Web3HttpProvider = require('web3-providers-http');

module.exports = async (amount = 100_000_000_000) => {
  const web3 = new Web3(new Web3HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = await web3.eth.accounts.wallet.add(process.env.OPERATOR_PRIVATE_KEY);
  const walletReceiver = await web3.eth.accounts.wallet.add(process.env.RECEIVER_PRIVATE_KEY);

  console.log(`Balance before tx: ${await web3.eth.getBalance(walletReceiver.address)}`);
  // Keep in mind that TINYBAR to WEIBAR coefficient is 10_000_000_000
  const signedTx = await wallet.signTransaction({
    'to': walletReceiver.address,
    'value': amount,
    'gas': 300000
  });
  await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log(`Balance after  tx: ${await web3.eth.getBalance(walletReceiver.address)}`);
};
