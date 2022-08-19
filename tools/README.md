##### The JSON RPC relay serves as an interface to the Hedera network for ethereum developer tools that utilize the implemented JSON RPC APIs. The following development tools have been tested and the extent of their coverage is noted below.

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

#### Option 1
```typescript
// init the contract factory
const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
// deploy the contract
let contract = await factory.deploy();

// wait till the transaction is mined and get the contract address from the receipt
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

// wait for transaction to be mined
await contract.deployed();

// get the transaction receipt
const receipt = await provider.getTransactionReceipt(contract.deployTransaction.hash);

// re-init the contract with the deployed address
contract = new ethers.Contract(receipt.contractAddress, contractJson.abi, wallet);
```
