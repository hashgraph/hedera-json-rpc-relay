const { http, createPublicClient, createWalletClient} = require('viem');
const { hederaTestnet, testnet} = require('viem/chains');
const { privateKeyToAccount } = require("viem/accounts");

module.exports = {
  publicClient: createPublicClient({
    chain: hederaTestnet,
    transport: http(),
  }),
  walletClient: createWalletClient({
    account: privateKeyToAccount(process.env.TESTNET_OPERATOR_PRIVATE_KEY),
    chain: testnet,
    transport: http(process.env.TESTNET_ENDPOINT),
  }),
};
