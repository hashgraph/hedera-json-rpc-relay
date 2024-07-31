# Initial web3rs research

## web3 rs
https://crates.io/crates/web3

Ethereum JSON-RPC multi-transport client. Rust implementation of the Web3.js library. This is the oldest package, allowing contract calls, batch requests, and sending transactions. It supports the async runtime `tokio` and transport via HTTP, IPC, and WebSockets.

If you want to deploy a contract, you need ready bin and ABI files, as the library doesn't provide any solution for that. In the documentation, they recommend using `solc` outside of Rust.

The library provides contract types, transaction, transaction receipt, block, work, and syncing but doesn't generate types and methods from ABI. When you want to call a contract method, you need to pass the method name as a string and parameters in a tuple.

___Library status:___
As they typed on the crate page, this package is barely maintained, and they are looking for an active maintainer. They recommend using `ethers-rs` for new projects.

___Docs:___
In my opinion, the documentation is weak, but at least the library provides some examples of the most popular use cases.

___Example output:___

```shell
Address 0x4c003d0e477b7b6c950912ad1dd0db6e253522d1 balance: 973384236010000000000
Deployed contract at address: 0x3edbd05cdbaea07b906643b5739eb09a6532acf9
Retrieved: 0
```