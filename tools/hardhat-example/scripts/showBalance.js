const hre = require('hardhat');

module.exports = async () => {
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);

  const balance = (await wallet.getBalance()).toString();
  console.log(`The address ${wallet.address} has ${balance} tinybars`);

  return balance;
};
