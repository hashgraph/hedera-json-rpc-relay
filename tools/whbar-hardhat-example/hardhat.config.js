require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
const SDK = require('@hashgraph/sdk');
const { fundECDSA, fundED25519, capitalizeFirstLetter } = require('./fund');

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

    await fundECDSA(hre, Number(process.env.INITIAL_BALANCE), contract.target);
  });

task('deploy-whbar-using-ed25519-signer-key', 'Deploy WHBAR using ED25519 signer key')
  .setAction(async (taskArgs, hre) => {
    const networkName = hre.network.name.split('_')[1];
    const client = SDK.Client[`for${capitalizeFirstLetter(networkName)}`]();

    client.setOperator(process.env.ED25519_ACCOUNT_ID, SDK.PrivateKey.fromStringED25519(process.env.ED25519_HEX_PRIVATE_KEY));

    const { bytecode } = await hre.artifacts.readArtifact('WHBAR');

    const contractCreateTx = new SDK.ContractCreateFlow()
      .setBytecode(bytecode)
      .setGas(250_000);

    const contractCreateTxResponse = contractCreateTx.execute(client);
    const contractCreateReceipt = (await contractCreateTxResponse).getReceipt(client);
    const { contractId } = await contractCreateReceipt;

    console.log(`(${hre.network.name}) deployed WHBAR has id ${contractId}`);

    await fundED25519(hre, Number(process.env.INITIAL_BALANCE), contractId.toString());
  });
