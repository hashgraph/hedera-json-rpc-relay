/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation, and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * https://trufflesuite.com/docs/truffle/reference/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  networks: {
    development: {
      host: process.env.RELAY_URL,
      port: process.env.RELAY_PORT,
      network_id: '*',
      provider: () => new HDWalletProvider([
          process.env.OPERATOR_PRIVATE_KEY,
          process.env.RECEIVER_PRIVATE_KEY
        ],
        `${process.env.RELAY_URL}:${process.env.RELAY_PORT}`
      ),
      gas: 300000
    }
  },

  mocha: {
    // 5 minutes
    timeout: 5 * 60000
  },

  compilers: {
    solc: {
      version: '0.8.15',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
