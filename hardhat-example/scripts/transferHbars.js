const hre = require('hardhat');

module.exports = async () => {
  const provider = new hre.ethers.providers.JsonRpcProvider('http://localhost:7546');
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const walletReceiver = new hre.ethers.Wallet(process.env.RECEIVER_PRIVATE_KEY, provider);

  console.log(`Balance before tx: ${await walletReceiver.getBalance()}`);
  await wallet.sendTransaction({
    to: walletReceiver.address,
    value: 10000000000
  });
  console.log(`Balance after tx: ${await walletReceiver.getBalance()}`);
}