// SPDX-License-Identifier: Apache-2.0

require('dotenv').config();
const fs = require('fs');
const { Web3 } = require('web3');

module.exports = async (address, msg) => {
  const { abi } = await JSON.parse(fs.readFileSync(__dirname + '/../contract/Greeter.json'));
  const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = await web3.eth.accounts.wallet.add(process.env.OPERATOR_PRIVATE_KEY);
  const greeter = new web3.eth.Contract(abi, address, { from: wallet[0].address, gas: 300000 });

  const updateTx = await greeter.methods.setGreeting(msg).send();
  console.log(`Updated call result: ${msg}`);

  return updateTx;
};
