require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

task('show-balance', async () => {
  const showBalance = require('./scripts/showBalance');
  return await showBalance();
});

task('transfer-hbars', async () => {
  const transferHbars = require('./scripts/transferHbars');
  return await transferHbars();
});

task('deploy-contract', async () => {
  const deployContract = require('./scripts/deployContract');
  return await deployContract();
});

task('contract-view-call', async (taskArgs, hre) => {
  const contractViewCall = require('./scripts/contractViewCall');
  return await contractViewCall(taskArgs.contractAddress);
});

task('contract-call', async (taskArgs, hre) => {
  const contractCall = require('./scripts/contractCall');
  return await contractCall(taskArgs.contractAddress, taskArgs.msg);
});

module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'relay',
  networks: {
    relay: {
      url: 'http://localhost:7546'
    }
  }
};
