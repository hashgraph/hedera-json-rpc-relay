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

___Example output:___

```shell
Address 0x4c003d0e477b7b6c950912ad1dd0db6e253522d1 balance: 976427588230000000000
Deployed contract at address: 0xb0da4c4327a9e308d604e8d45f3e50e3320fcaf6
Retrieved: Hello World!
```