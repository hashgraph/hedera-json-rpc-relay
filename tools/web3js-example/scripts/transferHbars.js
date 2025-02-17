// SPDX-License-Identifier: Apache-2.0

require('dotenv').config();
const { Web3 } = require('web3');

module.exports = async (amount = 100_000_000_000) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RELAY_ENDPOINT));
  const wallet = await web3.eth.accounts.wallet.add(process.env.OPERATOR_PRIVATE_KEY);
  const walletReceiver = await web3.eth.accounts.wallet.add(process.env.RECEIVER_PRIVATE_KEY);

  console.log(`Balance before tx: ${await web3.eth.getBalance(walletReceiver[0].address)}`);
  // Keep in mind that TINYBAR to WEIBAR coefficient is 10_000_000_000
  const gasPrice = await web3.eth.getGasPrice();
  const transaction = {
    from: wallet[0].address,
    to: walletReceiver[1].address,
    gas: 300000,
    gasPrice: gasPrice,
    value: amount, // value should be passed in wei. For easier use and to avoid mistakes we utilize the auxiliary `toWei` function.
  };

  await web3.eth.sendTransaction(transaction);
  console.log(`Balance after  tx: ${await web3.eth.getBalance(walletReceiver[0].address)}`);
};
