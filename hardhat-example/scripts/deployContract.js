const hre = require('hardhat');

module.exports = async () => {
  const provider = new hre.ethers.providers.JsonRpcProvider('http://localhost:7546');
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const Greeter = await hre.ethers.getContractFactory('Greeter', wallet);
  const greeter = await Greeter.deploy('initial_msg');
  const contractAddress = (await greeter.deployTransaction.wait()).contractAddress;

  console.log(`Greeter deployed to: ${contractAddress}`);

  return contractAddress;
};
