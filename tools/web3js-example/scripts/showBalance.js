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

module.exports = async () => {
  const web3 = new Web3(new Web3HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = web3.eth.accounts.privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY);

  const balance = await web3.eth.getBalance(wallet.address);
  console.log(`The address ${wallet.address} has ${balance} tinybars`);

  return balance;
};
