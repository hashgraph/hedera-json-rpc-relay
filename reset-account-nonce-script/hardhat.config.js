require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.24',
  defaultNetwork: 'testnet',
  networks: {
    mainnet: {
      name: 'mainnet',
      url: 'https://mainnet.hashio.io/api',
      chainId: 295,
      accounts: [],
      mirrorNodeREST: 'https://mainnet-public.mirrornode.hedera.com'
    },
    testnet: {
      name: 'testnet',
      url: 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: [
        '0x8d193e86dcaeb6079ce70a695935688e438f8e51a450353b6763b5101ad5257c'
      ],
      mirrorNodeREST: 'https://testnet.mirrornode.hedera.com'
    },
    previewnet: {
      name: 'previewnet',
      url: 'https://previewnet.hashio.io/api',
      chainId: 297,
      accounts: [],
      mirrorNodeREST: 'https://previewnet.mirrornode.hedera.com'
    }
  }
};
