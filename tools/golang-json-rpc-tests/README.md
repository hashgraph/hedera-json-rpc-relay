# Hedera JSON RPC - Golang Tests Project

This project offers boilerplate code for using golang client methods on Hedera JSON RPC api.
It can be configured to communicate with both community-hosted and local ([Hedera Local Node](https://github.com/hashgraph/hedera-local-node)) instances of the [Hedera JSON RPC Relay](https://github.com/hashgraph/hedera-json-rpc-relay).

## Requirements
Install go: https://go.dev/doc/install

## Setup

1. Clone this repo to your local machine:

```shell
git clone https://github.com/hashgraph/hedera-json-rpc-relay.git
```

2. Once you've cloned the repository, open your IDE terminal and navigate to the root directory of the project:

```shell
cd hedera-json-rpc-relay/tools/golang-json-rpc-tests
```

3. Run the following command to install all the necessary dependencies:

```shell
go get github.com/ethereum/go-ethereum/ethclient \
       github.com/ethereum/go-ethereum \
       github.com/ethereum/go-ethereum/accounts/abi/bind \
       github.com/ethereum/go-ethereum/crypto \
       github.com/joho/godotenv
```

4. Get your Hedera testnet account hex encoded private key from the [Hedera Developer Portal](https://portal.hedera.com/register) and update the `.env.example` `OPERATOR_PRIVATE_KEY`

5. Copy `.env.example` to `.env`

6. Run the test script from the root directory of the project. The default network is set to "testnet."

```shell
go run .
```
# Known Issues

#### Go Ethereum Client Incompatibility with Hedera JSON RPC Relay

The Go Ethereum client does not work correctly with the Hedera JSON RPC relay for legacy transactions. The problem arises due to differences in how the `v` part of the signature is handled:

- **Legacy Transactions**: For legacy transactions (no type provided or type = 0x0), Go expects the `v` part of the signature to be 27, 28, or {0,1} + CHAIN_ID * 2 + 35, as proposed in [EIP-155](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md).
- **Hedera Legacy Transactions**: Hedera has legacy transactions with `v = 0` or `1`, which do not meet these conditions, causing checks in the Go client to fail.

This issue manifests in the breakage of `TransactionByHash` or any other method that builds a transaction object (e.g., `testBlockByNumber` if the block contains an improper transaction).

#### Workarounds

1. **Use Low-Level Calls**: Utilize your own low-level calls to the Hedera JSON RPC and build the transaction manually, bypassing the `v` value checks.
2. **Work only with non-legacy Transaction Types**: Ensure you work only with transaction types which are non-legacy and always validate that the data represents a correct type of the transaction.

##### Example of Low-Level Call

Below is an example of how to perform a low-level call to the Hedera JSON RPC and build the transaction manually:

```go
package main

import (
    "fmt"
    "log"
    "math/big"
    "github.com/ethereum/go-ethereum/rpc"
)

func main() {
    client, err := rpc.Dial("https://your-hedera-json-rpc-endpoint")
    if err != nil {
        log.Fatalf("Failed to connect to the Ethereum client: %v", err)
    }

    var result map[string]interface{}
    err = client.Call(&result, "eth_getTransactionByHash", "0xYourTransactionHash")
    if err != nil {
        log.Fatalf("Failed to get transaction by hash: %v", err)
    }

    fmt.Println("Transaction details:", result)

    // Manually build the transaction object and handle the 'v' part as needed
    v, ok := new(big.Int).SetString(result["v"].(string)[2:], 16)
    if !ok {
        log.Fatalf("Invalid 'v' value")
    }

    // Check if 'v' is within expected range or handle it accordingly
    if v.Cmp(big.NewInt(27)) < 0 || v.Cmp(big.NewInt(28)) > 0 {
        // Handle legacy transaction 'v' value issue
    } else {
        // You can use golang library without chaning anything
    }

    // Further processing...
}
```

This example demonstrates how to make a raw RPC call to get transaction details and handle the `v` value appropriately.
