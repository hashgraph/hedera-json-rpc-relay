import '@nomiclabs/hardhat-waffle';
import { HardhatUserConfig } from 'hardhat/config';
import * as dotenv from 'dotenv';
dotenv.config();

const LOCAL_HEDERA_CHAIN_ID = 298;
const LOCAL_HEDERA_RELAY_RPC_ENDPOINT = 'http://localhost:7546';
const LOCAL_HEDERA_OPERATOR_KEY = '0x105d050185ccb907fba04dd92d8de9e32c18305e097ab41dadda21489a211524';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.21',
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  defaultNetwork: 'hedera',
  networks: {
    hedera: {
      url: process.env.RELAY_ENDPOINT || LOCAL_HEDERA_RELAY_RPC_ENDPOINT,
      accounts: [process.env.OPERATOR_KEY || LOCAL_HEDERA_OPERATOR_KEY],
      chainId: Number(process.env.CHAIN_ID) || LOCAL_HEDERA_CHAIN_ID,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.OPERATOR_KEY || ''],
      chainId: 11155111,
    },
  },
};

export default config;
