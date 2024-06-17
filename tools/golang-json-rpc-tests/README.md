# Hedera JSON RPC - Golang Tests Project

This project offers boilerplate code for using golang client methods on Hedera JSON RPC API.
It can be configured to communicate with both community-hosted and local ([Hedera Local Node](https://github.com/hashgraph/hedera-local-node)) instances of the [Hedera JSON RPC Relay](https://github.com/hashgraph/hedera-json-rpc-relay).

## Requirements
Install go: https://go.dev/doc/install

## Setup

1. Clone this repo to your local machine:

```shell
git clone https://github.com/hashgraph/hedera-json-rpc-relay.git
```

2. Once you've cloned the repository, open your IDE terminal and navigate to the root directory of the project:

```shell
cd hedera-json-rpc-relay/tools/golang-json-rpc-tests
```

3. Run the following command to install all the necessary dependencies:

```shell
go get github.com/ethereum/go-ethereum/ethclient \
       github.com/ethereum/go-ethereum \
       github.com/ethereum/go-ethereum/accounts/abi/bind \
       github.com/ethereum/go-ethereum/crypto \
       github.com/joho/godotenv
```

4. Get your Hedera testnet account hex encoded private key from the [Hedera Developer Portal](https://portal.hedera.com/register) and update the `.env.example` `OPERATOR_PRIVATE_KEY`

5. Copy `.env.example` to `.env`

6. Run the test script from the root directory of the project. The default network is set to "testnet".

```shell
go run .
```

# Known Issues
 - Go Ethereum Client Incompatibility with Hedera JSON RPC Relay [#2500](https://github.com/hashgraph/hedera-json-rpc-relay/issues/2500), [#2600](https://github.com/hashgraph/hedera-json-rpc-relay/issues/2600)
