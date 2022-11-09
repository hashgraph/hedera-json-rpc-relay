##### The JSON RPC relay serves as an interface to the Hedera network for ethereum developer tools that utilize the implemented JSON RPC APIs. The following development tools have been tested and the extent of their coverage is noted below.

### TheGraph integration

|             |   Status    |   Description    |
| ----------- | ----------- | ----------- |
| Catch & handle events emitted from EthereumTransactions | ✅ |
| Catch & handle events emitted from ContractCall & ContractCreate | ✅ |
| Capture ERC transfers through HTS precompile | ✅ |
| Execute contract calls during subgraph event processing | ✅ |
| Being able to specify the startBlock from which the graph sync | ✅ |
| Support for multiple dataSources | ✅ |
| Support for dynamic dataSource templates | ✅ |
| Block Handlers WITHOUT filters | ✅ |
| Block Handlers WITH filters | ❌ | Requires Parity's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter)
| Call Handlers | ❌ | Requires Parity's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter)
| Capture HTS transfers through HTS precompile | ❌ | Depends on [4127](https://github.com/hashgraph/hedera-services/issues/4127)
| Capture HTS token transfers through HAPI | ❌ | Depends on [4337](https://github.com/hashgraph/hedera-mirror-node/issues/4337), [4738](https://github.com/hashgraph/hedera-mirror-node/issues/4738)
| Can index anonymous events | ❔ | Depends on [667](https://github.com/hashgraph/hedera-json-rpc-relay/issues/667)

### Supported tools
|                                                                      | web3js | Truffle | ethers | Hardhat |
|----------------------------------------------------------------------|--------|---------|--------|---------|
| Transfer HBARS                                                       |    ✅   |    ✅    |    ✅   |    ✅    |
| Contract Deployment                                                  |    ✅   |    ✅    |    ✅   |    ✅    |
| Can use the contract instance after deploy without re-initialization |    ✅   |    ✅    |    ⚠️   |    ⚠️    |
| Contract View Function Call                                          |    ✅   |    ✅    |    ✅   |    ✅    |
| Contract Function Call                                               |    ✅   |    ✅    |    ✅   |    ✅    |

Note:
On contract deployment, most of the tools (e.g. [ethersjs](https://docs.ethers.io/v5/api/utils/address/#utils--contract-addresses)) pre-compute the contract address on the client-side, based
on sender address and nonce. In the Hedera ecosystem, it's not like that, where it's just the next available id.
[ethersjs](https://docs.ethers.io/v5/) and therefore Hardhat usage are impacted by this address calculation difference with the details captured [here](https://github.com/ethers-io/ethers.js/discussions/3141).
An extra step to retrieve the valid Hedera contract address is required to workaround this challenge, example workarounds are provided below.

Note:
Development tools are usually making a lot of requests to certain endpoints, especially during contract deployment. Be aware about rate limiting, when deploying multiple large contracts.

Note:
Enable [`development mode`](../docs/dev-mode.md) to correctly assert revert messages of contract calls with `hardhat-chai-matchers`.

#### Option 1
```typescript
// init the contract factory
const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
// deploy the contract
let contract = await factory.deploy();

// wait till the transaction has reached consensus and get the contract address from the receipt
const { contractAddress } = await contract.deployTransaction.wait();

// re-init the contract with the deployed address
contract = new ethers.Contract(contractAddress, contractJson.abi, wallet);
```

#### Option 2
```typescript
// init the contract factory
const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
// deploy the contract
let contract = await factory.deploy();

// wait for transaction to reach consensus
await contract.deployed();

// get the transaction receipt
const receipt = await provider.getTransactionReceipt(contract.deployTransaction.hash);

// re-init the contract with the deployed address
contract = new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet);
```
