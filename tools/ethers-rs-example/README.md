# Initial ethers-rs research
_More examples and usages will be covered soon_

## ethers rs
https://crates.io/crates/ethers

Complete Ethereum & Celo library and wallet implementation in Rust. This crate is created to work with Ethereum and Celo chains, with rich features listed below.

___Features:___
- Ethereum JSON-RPC Client
- Interacting with and deploying smart contracts
- Type-safe smart contract bindings code generation
- Querying past events
- Event monitoring as `Stream`s
- ENS as a first-class citizen
- Celo support
- Polygon support
- Avalanche support
- Optimism support
- Websockets / `eth_subscribe`
- Hardware wallet support
- Parity APIs (`tracing`, `parity_blockWithReceipts`)
- Geth TxPool API

Unlike `web3-rs`, `ethers` provides tools for compilation and abigen. The library looks more mature and more developer-friendly.

___Library status:___
They write on their GitHub: "We are deprecating ethers-rs for Alloy."

___Docs:___
`Ethers rs` has better documentation represented by the book at https://www.gakonst.com/ethers-rs/. However, it is incomplete and provides examples only for some parts.

___Compile contract artifact using foundry___
```shell
forge build contract/Greeter.sol -o tools/ethers-rs-example/contract/out
```

___Example output:___

```shell
Address 0x4c003d0e477b7b6c950912ad1dd0db6e253522d1 balance: 942705029140000000000
Deployed contract at address: 0x9ce16204481a46194bbc65efe520ebcbdb374dd5
Retrieved greet: Hello world!
Change greeting tx_hash: 0x8494c1466e3130d478c84c449f330b1bd4de28e6ee07438236ed4fb5e3965a58
After change retrieved greet: Hello world 2!
```