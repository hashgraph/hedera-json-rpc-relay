# Waffle example

Simple scripts for testing waffle fixtures on the methods that requires HTS Emulation to work correctly.

## Configuration

Create `.env` file based on `.env.example`

```
OPERATOR_PRIVATE_KEY=
RELAY_ENDPOINT=
```

 - `OPERATOR_PRIVATE_KEY` is your account ECDSA hex-encoded private key.
 - `RELAY_ENDPOINT` is a path to your JSON RPC Api. `https://testnet.hashio.io/api` for testnet. Remember to start your Hedera local node if you want to use the http://localhost:7546 endpoint. Provided network MUST have HTS behaviour simulation implemented: altered behavior of the eth_getStorageAt for TokenProxy calls and eth_getCode for 0x167 address.
 - `ERC20_TOKEN_ADDRESS` is the address of the token used for testing. We are verifying the correct behavior of the forked network, which requires some preset data. The OPERATOR_PRIVATE_KEY account must have a non-zero balance of this token on this network and be authorized to perform transfer operations.

## Setup & Install

In the project directory:
1. Run `npm install`
2. Run `npm run build`
2. Run `npm run test`

#### Dependencies

Waffle uses **ethers.js** to perform operations such as deploying Smart Contracts and sending transactions. It leverages **Mocha** and **Chai** as the foundational testing tools, while adding its own custom matchers tailored for Smart Contracts.

## Installation:
To install Waffle, you need to add the `ethereum-waffle` node module to your project. You can do this using the following command:

```shell
npm install --save-dev ethereum-waffle
```

