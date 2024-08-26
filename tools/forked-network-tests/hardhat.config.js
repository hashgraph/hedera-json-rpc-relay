require("@nomicfoundation/hardhat-toolbox-viem");
require("@nomicfoundation/hardhat-chai-matchers");
const { task } = require("hardhat/config");

// Import dotenv module to access variables stored in the .env file
require("dotenv").config();

task("show-balance", async (taskArgs) => {
  const showBalance = require("./scripts/showBalance");
  return showBalance(taskArgs.contractAddress, taskArgs.accountAddress);
});

task("show-name", async (taskArgs) => {
  const showName = require("./scripts/showName");
  return showName(taskArgs.contractAddress);
});

task("show-symbol", async (taskArgs) => {
  const showSymbol = require("./scripts/showSymbol");
  return showSymbol(taskArgs.contractAddress);
});

task("show-decimals", async (taskArgs) => {
  const showDecimals = require("./scripts/showDecimals");
  return showDecimals(taskArgs.contractAddress);
});

task("mine-block", async () => {
  const mineBlock = require("./scripts/mineBlock");
  return mineBlock();
});


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  mocha: {
    timeout: 3600000
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500
      }
    }
  },
  // This specifies network configurations used when running Hardhat tasks
  defaultNetwork: "local",
  networks: {
    local: {
      // Your Hedera Local Node address pulled from the .env file
      url: process.env.FORKED_NETWORK_ENDPOINT,
      // Conditionally assign accounts when private key value is present
      accounts: process.env.FORKED_NETWORK_NODE_OPERATOR_PRIVATE_KEY ? [process.env.FORKED_NETWORK_NODE_OPERATOR_PRIVATE_KEY] : []
    }
  }
};
