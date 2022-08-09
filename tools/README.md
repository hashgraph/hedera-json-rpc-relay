### Supported tools
|                                                                      | web3js | Truffle | ethers | Hardhat |
|----------------------------------------------------------------------|--------|---------|--------|---------|
| Transfer HBARS                                                       |    ✅   |    ✅    |    ✅   |    ✅    |
| Contract Deployment                                                  |    ✅   |    ✅    |    ✅   |    ✅    |
| Can use the contract instance after deploy without re-initialization |    ✅   |    ✅    |    ❌   |    ❌    |
| Contract View Function Call                                          |    ✅   |    ✅    |    ✅   |    ✅    |
| Contract Function Call                                               |    ✅   |    ✅    |    ✅   |    ✅    |

Note: On contract deployment, most of the tools (e.g. [ethers](https://docs.ethers.io/v5/api/utils/address/#utils--contract-addresses)) pre-compute the contract address on the client-side, based
on sender address and nonce. In the Hedera ecosystem, it's not like that, where it's just the next available id.

##### The JSON RPC relay serves as an interface to the Hedera network for ethereum developer tools that utilize the implemented JSON RPC APIs. The following development tools have been tested and the extent of their coverage is noted below.