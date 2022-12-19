# Subgraph example

## Description:

Hardhat based project containing example subgraph indexing the following contracts and events:

ExampleERC721 -> Transfer

ExampleERC20 -> Transfer

GravatarRegistry -> GravatarCreated and GravatarUpdated

For more information on subgraphs, check the official TheGraph documentation https://thegraph.com/docs/en/

## Introduction:

1. [What is TheGraph](https://thegraph.com/docs/en/about)
2. [How to create a subgraph](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
3. [The AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)

## Try it out:

### Prerequisites:

Note: Currently this example needs to be executed against older relay (v0.10.0) and mirror-node (v0.67.0-rc1) versions, until all fixes have been released.

The full hedera local-node config can be found [here](./configs/local-test.json)

#### Install the dependencies:

Run `npm install` or `yarn [install]`

#### Run Hedera local node:

To start a Hedera local node by running `npx hedera start --network local-test`. Note that when the containers are up, you'll need to stop the `json-rpc-relay` container and start a local relay server.

#### JSON-RPC Relay configurations:

If the graph node is configured to run against a local instance of the json-rpc-relay. Be sure to set the following env variables in your json-rpc-relay .env file:
```
ETH_GET_LOGS_BLOCK_RANGE_LIMIT=2000
RATE_LIMIT_DISABLED = true
```

#### Set .env vars

Rename `.env.example` to `.env`

### Deploy and interact with the contracts using the following commands:

#### ERC721:
`npx hardhat deployERC721`

`npx hardhat mintERC721`

#### ERC20:
`npx hardhat deployERC20`

`npx hardhat transferERC20`

#### Gravatar:
`npx hardhat deployGravatar`

`npx hardhat createGravatar`

_NOTE: This example uses the [hardhat-graph](https://github.com/graphprotocol/hardhat-graph) plugin. After every contract deploy, the plugin will update the networks.json file with the contract address (and the startBlock), this way you can use the `--network <network_name>` option of the `deploy` command, which will automatically update the address (and startBlock) in the `subgraph.yaml` file to the last contract deployment._

### Generate the types:

Run `npm run graph-codegen` or `yarn graph-codegen`

### Start a local graph-node:

Run `npm run graph-local` or `yarn graph-local`

_NOTE: If you run the graph-node against a local Hedera node and see this error in the graph-node console:_

```
Trying again after eth_getBlockByNumber(0, false) RPC call failed (attempt #10) with result Err(Ethereum node could not find genesis block), provider: local-rpc-0
```

_Add [this](./docker-compose.yml#L24) line to your `docker-compose.yml` and restart the node._

_NOTE: Every time you restart the hedera-node it is recommended to do a clean-up of the graph-node. To do this run `npm run graph-local-clean` or `yarn graph-local-clean`_

### Deploy the subgraph to the local graph-node:

To deploy the subgraph:

1. Run `npm run create-local` or `yarn create-local`
2. Run `npm run deploy-local -- --network local` or `yarn deploy-local --network local`
3. Follow the instructions
4. After the subgraph is successfully deployed open the [GraphQL playground](http://127.0.0.1:8000/subgraphs/name/subgraph-example/graphql?query=%7B+%0A++gravatars+%7B%0A++++id%0A++++owner%0A++++displayName%0A++++imageUrl%0A++%7D%0A++erc20S+%7B%0A++++id%0A++++supply%0A++++type%0A++++transfers+%7B%0A++++++from%0A++++++to%0A++++++amount%0A++++%7D%0A++%7D%0A++erc721S+%7B%0A++++id%0A++++owner%0A++++type%0A++++tokenId%0A++++transfers+%7B%0A++++++from%0A++++++to%0A++++%7D%0A++%7D%0A%7D%0A) where you can execute queries and fetch indexed data.

## Running the tests:

_NOTE: At this time the whole test workflow can't be proficiently automated, so you'll need to perform some manual steps:_

1. Be sure to start a clean local hedera node. If the node is currently running stop it.
    1. Run `npx hedera stop` to be sure that all containers are stopped and the temp files and volumes have been removed.
    2. Run `npx hedera start --network local-test` to start a new clean node.
2. After the node has started, execute `npx hardhat prepare` task, which will deploy and interact with the contracts.
3. Be sure to start a clean graph-node by executing `yarn/npm run graph-local-clean` and then `yarn/npm run graph-local`
4. Create and deploy the subgraph by executing `yarn/npm run create-local` and `yarn deploy-local --network local` or `npx run deploy-local -- --network local` and follow the instructions
5. Execute `npx hardhat test`


## HOW TOs:

### Run a private graph-node against testnet, previewnet and mainnet:

The easiest way to run a local `graph-node` against `testnet`, `previewnet` or `mainnet` is using the [docker-compose](https://github.com/graphprotocol/graph-node/tree/master/docker#docker-compose) setup.

1. Copy the content of the provided [docker-compose.yml](https://github.com/graphprotocol/graph-node/blob/master/docker/docker-compose.yml) file, or use the one from the [subgraph-example](./docker-compose.yml)
2. Replace `'mainnet:http://host.docker.internal:8545'` on [this](https://github.com/graphprotocol/graph-node/blob/master/docker/docker-compose.yml#L22) line with:
     1. `'mainnet:https://mainnet.hashio.io/api'` for `mainnet`
     2.  `'testnet:https://testnet.hashio.io/api'` for `testnet`
     3.  `'previewnet:https://previewnet.hashio.io/api'` for `testnet`
3. In the `subgraph.yaml` file change the dataSources network with to the network you want to index. Also don't forget to update the address (and the startBlock).

Advanced info on how to set up an indexer could be found in [The Graph Docs](https://thegraph.com/docs/en/indexing/operating-graph-node/) and the [official graph-node GitHub repository](https://github.com/graphprotocol/graph-node)
