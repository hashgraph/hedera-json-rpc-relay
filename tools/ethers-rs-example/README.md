# Ether.rs
https://crates.io/crates/ethers

Complete Ethereum library and wallet implementation in Rust. This crate is created to work with Ethereum.
___

## How to run example
1. Create `.env` file from `.env.example` file.
2. Run example with command `cargo run`

### Compile contract (optional)
If you want compile contract at your own, you can use for example foundry
```shell
forge build contract/Greeter.sol -o tools/ethers-rs-example/contract/out
```

### Example output

```shell
Address 0x4c003d0e477b7b6c950912ad1dd0db6e253522d1 balance: 942705029140000000000
Deployed contract at address: 0x9ce16204481a46194bbc65efe520ebcbdb374dd5
Retrieved greet: Hello world!
Change greeting tx_hash: 0x8494c1466e3130d478c84c449f330b1bd4de28e6ee07438236ed4fb5e3965a58
After change retrieved greet: Hello world 2!
```
