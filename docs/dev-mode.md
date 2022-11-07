# Development mode

`Developer mode` is intended to be used by users when developing and testing smart contracts. It allows `hardhat-chai-matchers` and other similar libraries to correctly assert revert messages of non-pure contract methods. 
It will also be expanded with special settings to speed up the [local node](https://github.com/hashgraph/hedera-local-node).

## Enabling

To enable `dev mode` start the Relay with the environment variable `DEV_MODE` set to `true`.


## Rationale 

In the example below `contract.call()` will make the following requests to the JSON RPC Relay: `eth_chainId, eth_estimateGas, eth_sendRawTransaction, eth_getTransactionByHash`

```typescript
await expect(contract.call()).to.be.revertedWith("Some revert message");
```

The asserting method expects to catch an error from any of the called API endpoints. Normally `eth_estimateGas` throws the error if the contract call is about to revert, 
but that is currently not possible in the context of Hedera. Instead the error can be thrown by `eth_getTransactionByHash` after the transaction has gone through the consensus nodes.
Since that is not the normal desired behaviour it is only enabled in this mode.