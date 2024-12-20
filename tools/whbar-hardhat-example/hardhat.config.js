require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
const fund = require('./fund');

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 500
      }
    }
  },
  mocha: {
    timeout: 3600000
  },
  defaultNetwork: 'hedera_' + process.env.NETWORK,
  networks: {
    hedera_mainnet: {
      url: 'https://mainnet.hashio.io/api',
      accounts: [process.env.ECDSA_HEX_PRIVATE_KEY],
      chainId: 295
    },
    hedera_testnet: {
      url: 'https://testnet.hashio.io/api',
      accounts: [process.env.ECDSA_HEX_PRIVATE_KEY],
      chainId: 296
    },
    hedera_previewnet: {
      url: 'https://previewnet.hashio.io/api',
      accounts: [process.env.ECDSA_HEX_PRIVATE_KEY],
      chainId: 297
    }
  }
};

task('deploy-whbar', 'Deploy WHBAR')
  .setAction(async (taskArgs, hre) => {
    const contractFactory = await ethers.getContractFactory('WHBAR');
    const contract = await contractFactory.deploy();
    await contract.waitForDeployment();

    console.log(`(${hre.network.name}) WHBAR deployed to: ` + contract.target);

    await fund(hre, Number(process.env.INITIAL_BALANCE), contract.target);
  });
