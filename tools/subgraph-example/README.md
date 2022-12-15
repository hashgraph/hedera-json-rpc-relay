# Subgraph example

Hardhat based project containing example subgraph indexing the following contracts and events:

ExampleERC721 -> Transfer

ExampleERC20 -> Transfer

GravatarRegistry -> GravatarCreated and GravatarUpdated

For more information on subgraphs, check the official TheGraph documentation https://thegraph.com/docs/en/

## Prerequisites:

Note: Currently this example needs to be executed against older relay and mirror-node versions, until all fixes have been released.

### Install the dependencies:

Run `npm install` or `yarn [install]`

### Run Hedera local node:

To start a Hedera local node by running `npx hedera start --network local-test`. Note that when the containers are up, you'll need to stop the `json-rpc-relay` container and start a local relay server.

### JSON-RPC Relay configurations:

Note: Currently you'll have to start the relay from the main branch in this repo, because it contains important bugfixes. This doc will be updated when a new version containing all the fixes is released.

The graph node is configured to run against a local instance of the json-rpc-relay. Be sure to set the following options in your json-rpc .env file:
```
ETH_GET_LOGS_BLOCK_RANGE_LIMIT=2000
RATE_LIMIT_DISABLED = true
```

### Set .env vars

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

NOTE: This example uses the [hardhat-graph](https://github.com/graphprotocol/hardhat-graph) hardhat plugin. After every contract deploy, the plugin will update the networks.json file with the contract address (and the startBlock), so you don't have to manually update it in the `subgraph.yaml` file.

### Generate the types:

Run `npm run graph-codegen` or `yarn graph-codegen`

### Start a local graph-node:

Run `npm run graph-local` or `yarn graph-local`

Note: If you run the graph-node against a local Hedera node and see this error in the graph-node console:
```
Trying again after eth_getBlockByNumber(0, false) RPC call failed (attempt #10) with result Err(Ethereum node could not find genesis block), provider: local-rpc-0
```

Uncomment [this](./docker-compose.yml#L24) line and restart the node.

Every time you restart the hedera-node it is recommended to do a clean-up of the graph-node. To do this run `npm run graph-local-clean` or `yarn graph-local-clean`

### Deploy the subgraph to the local graph-node:

Before deploying the subgraph, be sure to update the address (and startBlock) in `subgraph.yaml` to the address of the deployed Greeter contract.

To deploy the subgraph:

1. Run `npm run create-local` or `yarn create-local`
2. Run `npm run deploy-local -- --network local` or `yarn deploy-local --network local`
3. Follow the instructions
4. After the subgraph is successfully deployed open the [GraphQL playground](http://127.0.0.1:8000/subgraphs/name/subgraph-example/graphql?query=%7B+%0A++gravatars+%7B%0A++++id%0A++++owner%0A++++displayName%0A++++imageUrl%0A++%7D%0A++erc20S+%7B%0A++++id%0A++++supply%0A++++type%0A++++transfers+%7B%0A++++++from%0A++++++to%0A++++++amount%0A++++%7D%0A++%7D%0A++erc721S+%7B%0A++++id%0A++++owner%0A++++type%0A++++tokenId%0A++++transfers+%7B%0A++++++from%0A++++++to%0A++++%7D%0A++%7D%0A%7D%0A) where you can execute queries and fetch indexed data.

### Running the tests:

Note: At this time the whole test workflow can't be proficiently automated, so you'll need to perform some manual steps:

1. Be sure to start a clean local hedera node. If the node is currently running stop it.
    - Run `npx hedera stop` to be sure that all containers are stopped and the temp files and volumes have been removed.
    - Run `npx hedera start --network local-test` to start a new clean node.
2. After the node has started, execute `npx hardhat prepare` task, which will deploy and interact with the contracts.
3. Be sure to start a clean graph-node by executing `yarn/npm run graph-local-clean` and then `yarn/npm run graph-local`
4. Create and deploy the subgraph by executing `yarn/npm run create-local` and `yarn deploy-local --network local` or `npx run deploy-local -- --network local` and follow the instructions
5. Execute `npx hardhat test`
