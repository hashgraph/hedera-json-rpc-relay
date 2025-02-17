// SPDX-License-Identifier: Apache-2.0

require('dotenv').config();
const { Web3 } = require('web3');

module.exports = async () => {
  const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = web3.eth.accounts.privateKeyToAccount(process.env.OPERATOR_PRIVATE_KEY);

  const balance = await web3.eth.getBalance(wallet.address);
  console.log(`The address ${wallet.address} has ${balance} tinybars`);

  return balance;
};
