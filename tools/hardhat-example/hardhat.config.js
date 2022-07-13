require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

task('show-balance', async () => {
  const showBalance = require('./scripts/showBalance');
  return showBalance();
});

task('transfer-hbars', async () => {
  const transferHbars = require('./scripts/transferHbars');
  return transferHbars();
});

task('deploy-contract', async () => {
  const deployContract = require('./scripts/deployContract');
  return deployContract();
});

task('contract-view-call', async (taskArgs) => {
  const contractViewCall = require('./scripts/contractViewCall');
  return contractViewCall(taskArgs.contractAddress);
});

task('contract-call', async (taskArgs) => {
  const contractCall = require('./scripts/contractCall');
  return contractCall(taskArgs.contractAddress, taskArgs.msg);
});

module.exports = {
  solidity: '0.8.4',
  defaultNetwork: 'relay',
  networks: {
    relay: {
      url: process.env.RELAY_ENDPOINT
    }
  }
};
