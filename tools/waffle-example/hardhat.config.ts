import '@nomiclabs/hardhat-waffle';
import { HardhatUserConfig } from 'hardhat/config';
import * as dotenv from 'dotenv';
dotenv.config();

const LOCAL_HEDERA_CHAIN_ID = 298;
const LOCAL_HEDERA_SDK_OPERATOR_ID = '0.0.2';
const LOCAL_HEDERA_NETWORK_NODE_ENDPOINT = '127.0.0.1:50211';
const LOCAL_HEDERA_RELAY_RPC_ENDPOINT = 'http://127.0.0.1:7546';
const LOCAL_HEDERA_MIRROR_NODE_ENDPOINT = 'http://127.0.0.1:5600';
const LOCAL_HEDERA_OPERATOR_KEY = '0x105d050185ccb907fba04dd92d8de9e32c18305e097ab41dadda21489a211524';
const LOCAL_HEDERA_SDK_OPERATOR_KEY =
  '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137';

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
      sdkClient: {
        operatorId: process.env.SDK_OPERATOR_ID || LOCAL_HEDERA_SDK_OPERATOR_ID,
        operatorKey: process.env.SDK_OPERATOR_KEY || LOCAL_HEDERA_SDK_OPERATOR_KEY,
        networkNodeUrl: process.env.NETWORK_NODE_URL || LOCAL_HEDERA_NETWORK_NODE_ENDPOINT,
        nodeId: '3',
        mirrorNode: process.env.MIRROR_NODE_URL || LOCAL_HEDERA_MIRROR_NODE_ENDPOINT,
      },
      timeout: 2000000,
    } as any,
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.OPERATOR_KEY || LOCAL_HEDERA_OPERATOR_KEY],
      chainId: 11155111,
    },
  },
};

export default config;
