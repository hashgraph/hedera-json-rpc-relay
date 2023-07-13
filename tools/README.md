##### The JSON RPC relay serves as an interface to the Hedera network for ethereum developer tools that utilize the implemented JSON RPC APIs. The following development tools have been tested and the extent of their coverage is noted below.

### TheGraph integration

|                                                                  | Status | Description                                                                                                                                         |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catch & handle events emitted from EthereumTransactions          | ✅     |
| Catch & handle events emitted from ContractCall & ContractCreate | ✅     |
| Capture ERC transfers through HTS precompile                     | ✅     |
| Execute contract calls during subgraph event processing          | ✅     |
| Being able to specify the startBlock from which the graph sync   | ✅     |
| Support for multiple dataSources                                 | ✅     |
| Support for dynamic dataSource templates                         | ✅     |
| Block Handlers WITHOUT filters                                   | ✅     |
| Can index anonymous events                                       | ✅     |
| Block Handlers WITH filters                                      | ❌     | Requires ОpenЕthereum's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter)                                            |
| Call Handlers                                                    | ❌     | Requires ОpenЕthereum's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter)                                            |
| Capture HTS transfers through HTS precompile                     | ❌     | Depends on [4127](https://github.com/hashgraph/hedera-services/issues/4127)                                                                         |
| Capture HTS token transfers through HAPI                         | ❌     | Depends on [4337](https://github.com/hashgraph/hedera-mirror-node/issues/4337), [4738](https://github.com/hashgraph/hedera-mirror-node/issues/4738) |

### Supported tools

|                                                                      | web3js | Truffle | ethers | Hardhat | Remix IDE |
| -------------------------------------------------------------------- | ------ | ------- | ------ | ------- | --------- |
| Transfer HBARS                                                       | ✅     | ✅      | ✅     | ✅      | ✅        |
| Contract Deployment                                                  | ✅     | ✅      | ✅     | ✅      | ✅        |
| Can use the contract instance after deploy without re-initialization | ✅     | ✅      | ✅     | ✅      | ✅        |
| Contract View Function Call                                          | ✅     | ✅      | ✅     | ✅      | ✅        |
| Contract Function Call                                               | ✅     | ✅      | ✅     | ✅      | ✅        |
| Debug Operations\*                                                   | ❌     | ❌      | ❌     | ❌      | ❌        |

\*1: Debug operation are not supported yet.

Note:
Development tools are usually making a lot of requests to certain endpoints, especially during contract deployment. Be aware about rate limiting, when deploying multiple large contracts.

Note:
Enable [`development mode`](../docs/dev-mode.md) to correctly assert revert messages of contract calls with `hardhat-chai-matchers`.
