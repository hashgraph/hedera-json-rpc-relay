const hre = require('hardhat');

module.exports = async (address) => {
  const provider = new hre.ethers.providers.JsonRpcProvider('http://localhost:7546');
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const greeter = await hre.ethers.getContractAt('Greeter', address, wallet);
  const callRes = await greeter.greet();

  console.log(`Contract call result: ${callRes}`);

  return callRes;
};
