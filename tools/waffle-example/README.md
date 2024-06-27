# Waffle
[Waffle](https://ethereum-waffle.readthedocs.io/) is a library designed for testing Smart Contracts.

#### Features

Waffle provides several features that enhance the testing experience for developers:

- Includes new Chai matchers specifically designed for Smart Contract testing.
- Allows importing contracts directly from modules by simply using the path to `.sol` files.
- Enables the use of mocked wallets and Smart Contracts for isolated and controlled testing environments.
- Allows the use of fixtures to define reusable setups for tests, reducing boilerplate code and simplifying complex test setups.

#### Dependencies

Waffle uses **ethers.js** to perform operations such as deploying Smart Contracts and sending transactions. It leverages **Mocha** and **Chai** as the foundational testing tools, while adding its own custom matchers tailored for Smart Contracts.

## Installation:
To install Waffle, you need to add the `ethereum-waffle` node module to your project. You can do this using the following command:

```shell
npm install --save-dev ethereum-waffle
```

## Hedera Smart Contracts Development

Waffle utilizes `ethers.js` to communicate with the JSON-RPC API.

A sample usage is documented in this [example](https://github.com/hashgraph/hedera-json-rpc-relay/tree/main/tools/hardhat-example).

Both [contract deployment](https://github.com/hashgraph/hedera-json-rpc-relay/blob/main/tools/hardhat-example/scripts/deployContract.js) and [calls](https://github.com/hashgraph/hedera-json-rpc-relay/blob/main/tools/hardhat-example/scripts/contractCall.js) are performed using `ethers.js` in the same way Waffle does.

The [Chai matchers](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html) provided by Waffle are not dependent on any specific network. They can be used to easily detect common scenarios in Smart Contract testing, such as whether an event was emitted by the Smart Contract or if an operation was reverted.

However, the mocks provided by Waffle are designed to simulate Ethereum network behavior, which means they may not replicate some Hedera-specific traits, such as `ecrecover` behavior for non-ECDSA keys or after private key changes. The wallet mock will only support wallets utilizing ECDSA keys.

The mock Waffle provider allows users to imitate basic ENS operations, such as registering domains and retrieving the address of a domain. The Hedera Name Service (HNS) at its core level provides similar functionalities, so this mock can be used as its replacement.
