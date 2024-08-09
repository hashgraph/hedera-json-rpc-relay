# Initial alloy-core research

## Alloy core
https://crates.io/crates/alloy-core

Alloy implements high-performance, well-tested, and documented libraries for interacting with Ethereum and other EVM-based chains. It is a rewrite of [`ethers-rs`](https://github.com/gakonst/ethers-rs) from the ground up, with exciting new features, high performance, and excellent [documentation](https://docs.rs/alloy).

Alloy is a collection of several crates around the Ethereum ecosystem. For our use case, we'll use alloy-core. It's the youngest library on the list, but that doesn't mean it's the worst. On the contrary, as a rewrite of ethers-rs, many known problems in the previous libraries won't appear.

___Library status:___  
It's a relatively new library but highly developed and will probably become the most popular choice soon.

___Docs:___  
[Alloy documentation](https://alloy.rs/) contains rich examples of most use cases, with comments provided to explain everything line by line.


___Compile contract artifact using foundry___
```shell
forge build contract/Greeter.sol -o tools/alloy-core-rs-example/contract/out
```

___Example output___

```shell
Address 0x4c003D0E477B7b6c950912AD1DD0DB6E253522d1 balance: 942908758340000000000
Deployed contract at address: 0x61694f0f15087690b1a9a30daf26c3c7ea4fef03
Retrieved greet: Hello world!
Change greeting tx_hash: 0xbb7de0d1a61ca5e2ff8e3d21e59aac78d62d108af4d6f82e196ac0f437eff681
After change retrieved greet: Hello world 2!
```