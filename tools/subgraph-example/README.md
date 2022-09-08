# Subgraph example

Simple subgraph indexing the `GreeterSet` event of emitted by the [modified] Greeter contract

For more information on subgraphs, check the official TheGraph documentation https://thegraph.com/docs/en/

## Prerequisites:

### Deploy and interact with the Greeter contract using one of the other examples:

1. [hardhat-example](../hardhat-example)
3. [web3js-example](../web3js-example)

Note: The Greeter contract has been updated to emit `GreetingSet` event each time a new greeting is set with `setGreeting`.

### Install the dependencies:

Run `npm install` or `yarn [install]`

### Generate the types:

Run `npm run codegen` or `yarn codegen`

### Start a local graph-node:

Run `npm run graph-local` or `yarn graph-local`

Note: The graph node is configured to run against a local instance of the json-rpc-relay. If you run the graph-node against a local Hedera node, every time you restart the hedera-node it is recommended to do a clean-up of the graph-node. To do this run `npm run graph-local-clean` or `yarn graph-local-clean`

### Deploy the subgraph to the local graph-node:

Before deploying the subgraph, be sure to update the address (and startBlock) in `subgraph.yaml` to the address of the deployed Greeter contract.

To deploy the subgraph:

1. Run `npm run create-local` or `yarn create-local`
2. Run `npm run deploy-local` or `yarn deploy-local`
3. Follow the instructions
