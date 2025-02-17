// SPDX-License-Identifier: Apache-2.0

const hre = require('hardhat');

module.exports = async () => {
  const [walletClient] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const balance = await publicClient.getBalance({
    address: walletClient.account.address,
  });
  console.log(`The address ${walletClient.account.address} has ${balance} weibars`);

  return balance;
};
