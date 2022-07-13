const hre = require('hardhat');
const hethers = require('@hashgraph/hethers');

module.exports = async () => {
  const provider = new hre.ethers.providers.JsonRpcProvider(process.env.RELAY_ENDPOINT);
  const wallet = new hre.ethers.Wallet(process.env.OPERATOR_PRIVATE_KEY, provider);
  const Greeter = await hre.ethers.getContractFactory('Greeter', wallet);
  const greeter = await Greeter.deploy('initial_msg');
  const contractAddress = (await greeter.deployTransaction.wait()).contractAddress;
  const contractId = hethers.utils.getAccountFromAddress(contractAddress);

  console.log(`Greeter contract id: ${hethers.utils.asAccountString(contractId)}`);
  console.log(`Greeter deployed to: ${contractAddress}`);

  return contractAddress;
};
