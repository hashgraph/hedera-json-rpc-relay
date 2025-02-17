// SPDX-License-Identifier: Apache-2.0

const hre = require('hardhat');

//This function accepts two parameters - address and msg
//Retrieves the contract from the address and set new greeting
module.exports = async (address, msg) => {
  //Assign the greeter contract object in a variable, this is used for already deployed contract, which we have the address for. ethers.getContractAt accepts:
  //name of contract as first parameter
  //address of our contract
  const greeter = await hre.viem.getContractAt('Greeter', address);

  //using the greeter object(which is our contract) we can call functions from the contract. In this case we call setGreeting with our new msg
  const updateTx = await greeter.write.setGreeting([msg]);

  console.log(`Updated call result: ${msg}`);

  return updateTx;
};
