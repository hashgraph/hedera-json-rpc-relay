// SPDX-License-Identifier: Apache-2.0

const { ethers } = require('hardhat');

module.exports = async (address) => {
  const wallet = (await ethers.getSigners())[0];
  const greeter = await hre.ethers.getContractAt('Greeter', address, wallet);
  const callRes = await greeter.greet();

  console.log(`Contract call result: ${callRes}`);

  return callRes;
};
