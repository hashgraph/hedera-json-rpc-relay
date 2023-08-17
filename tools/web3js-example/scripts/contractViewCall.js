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
const fs = require('fs');
const { Web3 } = require('web3');

module.exports = async (address) => {
  const { abi } = await JSON.parse(fs.readFileSync(__dirname + '/../contract/Greeter.json'));
  const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = await web3.eth.accounts.wallet.add(process.env.OPERATOR_PRIVATE_KEY);
  const greeter = new web3.eth.Contract(abi, address, { from: wallet[0].address, gas: 300000 });

  const callRes = await greeter.methods.greet().call();
  console.log(`Contract call result: ${callRes}`);

  return callRes;
};
