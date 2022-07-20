As an implementation of [HIP 419](https://hips.hedera.com/hip/hip-482), the Hedera JSON RPC Relay provides some [Ethereum JSON-RPC APIs](https://ethereum.github.io/execution-apis/api-documentation/) which implement the [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) to support Ethereum tools interacting with Hedera nodes e.g. wallets, developer tools.

## Requests
Requests to the Relay will take the form of HTTP calls to an endpoints method. 
A curl example to the `eth_chainId` takes the form
  Request
  ```shell
    curl ${RELAY_ENDPOINT_URL} -X POST -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":"2","method":"eth_chainId","params":[null]}'
  ```

Where
- RELAY_ENDPOINT_URL - HTTP url endpoint, default `http://localhost:7546`

  
## Result Schema

Result responses can take the form of success or error.

  Success Response
  ```json
  {
    "id": 1,
    "jsonrpc": "2.0",
    "result": "0x4b7"
  }
  ```
    
Error Response
  ```json
  {
    "id": 2,
    "jsonrpc": "2.0",
    "error": {
        "code": -32602,
        "message": "Invalid params"
    }
  }
  ```

The values can range from regular data types (String, int, array) to defined Ethereum objects such as:

- [Block](https://besu.hyperledger.org/en/stable/Reference/API-Objects/#block-object)
- [Log](https://besu.hyperledger.org/en/stable/Reference/API-Objects/#log-object)
- [Transaction](https://besu.hyperledger.org/en/stable/Reference/API-Objects/#transaction-object)

## Endpoints

The JSON RPC Relay methods implements a subset of the standard method:

- [Gossip Methods](https://ethereum.org/en/developers/docs/apis/json-rpc/#gossip-methods)
- [State Methods](https://ethereum.org/en/developers/docs/apis/json-rpc/#state_methods)
- [History Methods](https://ethereum.org/en/developers/docs/apis/json-rpc/#history_methods)


Below is a table of provided methods. 

| Method | Static Response Value    | Hedera Nodes (Relay Only, Mirror Node, Consensus Node, Both Nodes)    |
| [eth_accounts](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_accounts)   | `[]`  | N/A   |
| [eth_blockNumber](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber)   | N/A   | Mirror Node |
| [eth_call](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_call)   | N/A   | Consensus Node |
| [eth_chainId](https://besu.hyperledger.org/en/stable/Reference/API-Methods/#eth_chainid)   | [Chain_ID](../README.md#configuration)   | Relay Only    |
| [eth_coinbase](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_coinbase)   | `-32601`  | N/A   |
| [eth_estimateGas](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_estimategas)   | N/A   | Both Nodes  |
| [eth_feeHistory](https://besu.hyperledger.org/en/stable/Reference/API-Methods/#eth_feehistory)   | N/A   | Both Nodes  |
| [eth_gasPrice](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gasprice)   | N/A   | Both Nodes  |
| [eth_getBalance](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getbalance)   | N/A   |   Consensus Node  |
| [eth_getBlockByHash](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbyhash)   | N/A   | Mirror Node |
| [eth_getBlockByNumber](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblockbynumber)   | N/A   | Mirror Node |
| [eth_getBlockTransactionCountByHash](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbyhash)   | N/A   | Mirror Node |
| [eth_getBlockTransactionCountByNumber](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getblocktransactioncountbynumber)   | N/A   | Mirror Node |
| [eth_getLogs](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs)   | N/A   | Mirror Node |
| [eth_getTransactionByBlockHashAndIndex](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionbyblockhashandindex)   | N/A   | Mirror Node |
| [eth_getTransactionByBlockNumberAndIndex](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionbyblocknumberandindex)   | N/A   | Mirror Node |
| [eth_getTransactionByHash](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionbyhash)   | N/A   | Mirror Node |
| [eth_getTransactionCount](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactioncount)   | N/A   | Mirror Node |
| [eth_getTransactionReceipt](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_gettransactionreceipt)   | N/A   | Mirror Node |
| [eth_getUncleByBlockHashAndIndex](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getunclebyblockhashandindex)   | `null`  | N/A   |
| [eth_getUncleByBlockNumberAndIndex](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getunclebyblocknumberandindex)   | `null`  | N/A   |
| [eth_getUncleCountByBlockHash](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getunclecountbyblockhash)   | `null`  | N/A   |
| [eth_getUncleCountByBlockNumber](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getunclecountbyblocknumber)   | `0x0`  | N/A   |
| [eth_getWork](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getwork)   | `-32601`  | N/A   |
| [eth_hashrate](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_hashrate)   | `0x0` | N/A   |
| [eth_mining](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_mining)   | `false`   | N/A   | N/A   |
| [eth_protocolVersion](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_protocolversion)   | `-32601`  | N/A   |
| [eth_sendRawTransaction](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendrawtransaction)   |
| [eth_sendTransaction](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sendtransaction)   | `-32601`  | N/A   |
| [eth_signTransaction](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_signtransaction)   | `-32601`  | N/A   |
| [eth_sign](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_sign)   | `-32601`  | N/A   |
| [eth_submitHashrate](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_submithashrate)   | `-32601`  | N/A   |
| [eth_submitWork](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_submitwork)   | `false`   | N/A   |
| [eth_syncing](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_syncing)   | `false`   | N/A   |
| [net_listening](https://ethereum.org/en/developers/docs/apis/json-rpc/#net_listening)   | `false`   | N/A   |
| [net_version](https://ethereum.org/en/developers/docs/apis/json-rpc/#net_version)   | [Chain_ID](../README.md#configuration)   | Relay Only    |
| [web3_clientVersion](https://ethereum.org/en/developers/docs/apis/json-rpc/#web3_clientversion)   | `relay/<semanticVersion>`   | Relay Only    |



