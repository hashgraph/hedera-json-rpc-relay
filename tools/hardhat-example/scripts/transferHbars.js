const hre = require('hardhat');

module.exports = async (amount = 100000000000) => {
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

  console.log(`Balance before tx: ${await walletReceiver.getBalance()}`);
  // Keep in mind that TINYBAR to WEIBAR coefficient is 10000000000
  await wallet.sendTransaction({
    to: walletReceiver.address,
    value: amount // 10 tinybars
  });
  console.log(`Balance after tx: ${await walletReceiver.getBalance()}`);
};
