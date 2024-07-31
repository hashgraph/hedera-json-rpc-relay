# Initial alloy-core research

## alloy-core
https://crates.io/crates/alloy-core

Alloy implements high-performance, well-tested, and documented libraries for interacting with Ethereum and other EVM-based chains. It is a rewrite of [`ethers-rs`](https://github.com/gakonst/ethers-rs) from the ground up, with exciting new features, high performance, and excellent [documentation](https://docs.rs/alloy).

Alloy is a collection of several crates around the Ethereum ecosystem. For our use case, we'll use alloy-core. It's the youngest library on the list, but that doesn't mean it's the worst. On the contrary, as a rewrite of ethers-rs, many known problems in the previous libraries won't appear.

___Library status:___  
It's a relatively new library but highly developed and will probably become the most popular choice soon.

___Docs:___  
[Alloy documentation](https://alloy.rs/) contains rich examples of most use cases, with comments provided to explain everything line by line.


Example output

```shell
Address 0x4c003D0E477B7b6c950912AD1DD0DB6E253522d1 balance: 976697350970000000000
Deployed contract at address: 0xFba313d76735Fed8adb54DFF5e65A92E18F15101
Set number to 42: 0xbd8bdc4318f08926ab40050126a58cbb5aefb22f859c55bde188ee80277a1ab8
Incremented number: 0xbe208a95f7db4647155b4a95af5a085e321ff77e8ef2b34cdd43c6e916d35620
Retrieved number: 43
```