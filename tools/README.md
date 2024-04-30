##### The JSON RPC relay serves as an interface to the Hedera network for ethereum developer tools that utilize the implemented JSON RPC APIs. The following development tools have been tested and the extent of their coverage is noted below.

### TheGraph integration

|                                                                  | Status | Description                                                                                              |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| Catch & handle events emitted from EthereumTransactions          | ✅     |
| Catch & handle events emitted from ContractCall & ContractCreate | ✅     |
| Capture ERC transfers through HTS precompile                     | ✅     |
| Execute contract calls during subgraph event processing          | ✅     |
| Being able to specify the startBlock from which the graph sync   | ✅     |
| Support for multiple dataSources                                 | ✅     |
| Support for dynamic dataSource templates                         | ✅     |
| Block Handlers WITHOUT filters                                   | ✅     |
| Can index anonymous events                                       | ✅     |
| Block Handlers WITH filters                                      | ❌     | Requires ОpenЕthereum's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter) |
| Call Handlers                                                    | ❌     | Requires ОpenЕthereum's [trace_filter](https://openethereum.github.io/JSONRPC-trace-module#trace_filter) |
| Capture HTS transfers through HTS precompile                     | ❌     | Depends on [4127](https://github.com/hashgraph/hedera-services/issues/4127)                              |
| Capture HTS token transfers/mint/wipe/burn through HAPI          | ✅     | Only multiple token transfer events are not supported                                                    |

### Supported tools

|                                                                      | web3js | Truffle | ethers | Hardhat | Remix IDE | Foundry |
| -------------------------------------------------------------------- | ------ | ------- | ------ | ------- | --------- | ------- |
| Transfer HBARS                                                       | ✅     | ✅      | ✅     | ✅      | ✅        | ✅        |
| Contract Deployment                                                  | ✅     | ✅      | ✅     | ✅      | ✅        |  ✅        |
| Can use the contract instance after deploy without re-initialization | ✅     | ✅      | ✅     | ✅      | ✅        | ✅        |
| Contract View Function Call                                          | ✅     | ✅      | ✅     | ✅      | ✅        | ✅        |
| Contract Function Call                                               | ✅     | ✅      | ✅     | ✅      | ✅        | ✅        |
| Debug Operations\*                                                   | ❌     | ❌      | ❌     | ❌      | ❌        | ❌        |

\*1: Debug operation are not supported yet.

Note:
Development tools are usually making a lot of requests to certain endpoints, especially during contract deployment. Be aware about rate limiting, when deploying multiple large contracts.

Note:
Enable [`development mode`](../docs/dev-mode.md) to correctly assert revert messages of contract calls with `hardhat-chai-matchers`.

# EVM Analysis tools study General Information: 
This report aims to analyze potential tools that will aid in the development, porting, and security assessment
of Smart Contracts deployed on the Hedera network. Key aspects evaluated during this research include:
- Ease of use and compatibility with Hedera.
- Ability to identify optimizations and potential errors or bugs specific to Smart Contracts on the Hedera.
- Issues with compatibility for contracts ported from Ethereum or other networks to the Hedera.
### Prerequisites
Tools were tested in the MacOS and Kubuntu Linux environments as well as on Docker containers. Test setup involves:
- Installing the Solidity compiler package.
- Cloning the Hedera JSON RPC repository: `git clone -b main --single-branch  https://github.com/hashgraph/hedera-json-rpc-relay.git`.
- Installing dependencies, and building the project: `npm install`, `npm run setup`, from the project directory.
- Starting the project: `npm start`.
- Launching the analytical tools discussed in this report: `docker-compose up -d`, using
  [docker-compose](slither-analysis/docker-compose.yaml) file placed in the tool analysis directory ([Dockerfile](slither-analysis/Dockerfile) for the Slither will be required).

## Impact of This Document's Analysis Tools Research on Potential Guides for EVM Developers

### Relevance of Slither Analysis to Hedera JSON RPC

While [Slither](slither-analysis/analysis.md) is a powerful static analysis tool, it is important to note its lack of network-specific features such as the Hedera JSON RPC.

### Relevance of MAIAN and Manticore Analysis to Hedera JSON RPC

Both [MAIAN](maian-analysis/analysis.md) and [Manticore](manticore-analysis/analysis.md) tools require updates to use the latest versions of Python and their respective libraries (as well as additional fixes)
to function correctly before we can assess their compatibility with the Hedera JSON RPC.