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

# EVM Analytic tools study 
### General Information:
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

# Guidelines for using Ethereum precompiles in Hedera:
1. Hedera supports ED25519 accounts, ecrecover works correctly only for ECSDA accounts. This must be noted during potential
   contract migration (Slither detector placed in this repository can be used to check for ecrecover usage in the contract to
   migrate).
2. There are precompiles which may be missing from Hedera EVM that are present in current EVM version.
   For example Cancun-related updates are yet to be implemented as for end of April 2024.
3. By the [docs](https://docs.hedera.com/hedera/sdks-and-apis/sdks/token-service/associate-tokens-to-an-account).
   When using the Hedera Token Service it is important to check if the token is associated with the receiving account.
4. List of pain points between Hedera EVM and vanilla Ethereum EVM:
- ECDSA aliases can be possibly changed in Hedera, which can lead to a new account address, this may influence whitelists
  systems, transaction validation, and potential vulnerability in replay attacks and authorization issues,
- If a contract relies on specific addresses for functionality or permissions, redeploying or updating these contracts
  may be necessary to align with new address formats.
  More information [here](https://medium.com/@Arkhia/creating-an-ecdsa-based-account-with-an-alias-on-hedera-5d5d8b2cc1e9)
- OpenZeppelin - the most widely used library used in Solidity Smart Contracts. Contracts using ecrecover:
    - ERC20Wrapper
    - ERC2771Forwarder
    - ERC721Wrapper
    - ERC20Permit
    - governance/utils/Votes
    - Utils: EIP712Verifier, cryptography/ECDSA, SignatureChecker
5. A list of differences between Hedera EVM and vanilla Ethereum EMV should be created and maintained. 


