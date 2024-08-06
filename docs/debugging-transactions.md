# Debugging Transactions

## Table of Contents

1. [Overview](#overview)
2. [Debugging with Remix](#1-debugging-with-remix)
    - [Steps to Use the Built-in Debugger](#steps-to-use-the-built-in-debugger)
    - [Example of Debugging a Transaction](#example-of-debugging-a-transaction)
3. [Debugging with Truffle](#2-debugging-with-truffle)
    - [Steps to Use the Debugger in Truffle](#steps-to-use-the-debugger-in-truffle)
4. [Advanced Debugging with `debug_traceTransaction`](#2-advanced-debugging-with-debug_traceTransaction)
    - [Manually Calling `debug_traceTransaction`](#manually-calling-debug_traceTransaction)
    - [Examples of Using `debug_traceTransaction`](#examples-of-using-debug_tracetransaction)
        - [With `callTracer`](#1-with-callTracer)
        - [With `opcodeLogger`](#2-with-opcodeLogger)

## Overview

[Remix IDE](https://remix-project.org/) provides powerful debugging tools that allow developers to inspect and analyze
the execution of smart contracts.

This guide will walk you through the various debugging capabilities available, including:

1. how to use the built-in debugger in Remix to step through the execution of a transaction and inspect the state of
   your smart contracts, and
2. how to manually call the `debug_traceTransaction` method and analyze the response to get detailed information about
   the execution of a transaction.

## 1. Debugging with Remix

The built-in debugger in Remix allows you to step through the execution of a transaction, inspect the state, and
understand the behavior of your smart contracts.

### Steps to Use the Built-in Debugger

Official Documentation: [Remix Debugger](https://remix-ide.readthedocs.io/en/latest/debugger.html)

1. **Set Up Remix with a Local Node**:
    - Ensure you have a local node running that supports the `debug_traceTransaction` method.
    - Connect Remix to your local node by selecting
      the ["External Http Provider"](https://remix-ide.readthedocs.io/en/latest/run.html#more-about-external-http-provider)
      option in the Remix IDE and entering the URL of your local node (e.g., `http://localhost:7546`).

2. **Deploy or Load Contract**:
    - [Create and deploy your smart contract](https://remix-ide.readthedocs.io/en/latest/create_deploy.html) using Remix
      or load an existing contract by providing its address.

3. **Run a Transaction**:
    - Interact with your deployed contract by sending a transaction (e.g., calling a function).

4. **Access the Debugger**:
    - Remix displays information related to each transaction result in the terminal.
    - After the transaction has been processed, check in the terminal to see where it is logged.
    - Find the transaction you just executed and click on the debug icon next to it.

5. **Use the Debugger**:
    - The Remix Debugger will open, allowing you to step through the transaction execution.
    - You can inspect the state, stack, memory, any errors and other details at each step of the execution.

### Example of Debugging a Transaction

Here’s a simple example of how to deploy and interact with a contract in Remix:

#### Solidity Contract

```solidity
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 public storedData;

    function set(uint256 x) public {
        storedData = x;
    }

    function get() public view returns (uint256) {
        return storedData;
    }
}
```

#### Steps in Remix

1. **Deploy the Contract**:
    - Compile the `SimpleStorage` contract.
    - Deploy it using the "Deploy & Run Transactions" tab.

2. **Interact with the Contract**:
    - Call the `set` function with a value (e.g., `set(42)`).

3. **Debug the Transaction**:
    - Go to the terminal in Remix to see the transaction details.
    - Find the `set` transaction and click the debug icon.
    - Use the debugger to step through the transaction and inspect the state changes.

## 2. Debugging with Truffle

[Truffle](https://archive.trufflesuite.com) is a popular development framework for Ethereum smart contracts that
provides
built-in debugging capabilities.

### Steps to Use the Debugger in Truffle

Official Documentation:
[Truffle Debugger](https://archive.trufflesuite.com/docs/truffle/how-to/debug-test/use-the-truffle-debugger/)

1. **Install Truffle**:
    - Install Truffle using npm: `npm install -g truffle`.
2. **Initialize a new Truffle project**:
    - Initialize using `truffle init`.
3. **Set Up Your Environment**:
    - Install the necessary dependencies: `npm install @truffle/hdwallet-provider`
    - Configure your development environment in the `truffle-config.js` file.
    - Ensure you have a local node running that supports the `debug_traceTransaction` method.

- Connect to the local node by specifying the network configuration. (e.g., `http://localhost:7546`)
  ```javascript
  const HDWalletProvider = require('@truffle/hdwallet-provider');
  module.exports = {
    networks: {
      development: {
        host: "127.0.0.1",
        port: 7546,
        network_id: '*',
        provider: () => new HDWalletProvider(
          [
            '0x105d050185ccb907fba04dd92d8de9e32c18305e097ab41dadda21489a211524', // operator private key
            '0x2e1d968b041d84dd120a5860cee60cd83f9374ef527ca86996317ada3d0d03e7' // receiver private key
          ],
          'http://localhost:7546'
        )
      },
    },
  };
  ```

1. **Write and Compile Your Contracts**:
    - Add your `SimpleStorage` contract in the `contracts/` directory.
    - Compile your contracts: `truffle compile`.
2. **Deploy and Interact with Your Contracts**:
    - Deploy your contracts to the local network: `truffle migrate`.
    - Interact with your contracts using Truffle console or scripts.
    - Call functions and send transactions to test your contracts.
3. **Debug Your Contracts**:
    - Use the Truffle debugger to step through the execution of your contracts.
    - Run the debugger using `truffle debug <transaction_hash>`.
4. **Analyze the Execution Flow**:
    - Analyze the execution flow and identify any issues in your smart contracts.
    - Truffle Debugger Commands:
      ```
      Commands:
      (enter) last command entered (step next)
      (o) step over, (i) step line / step into, (u) step out, (n) step next
      (c) continue until breakpoint, (Y) reset & continue to previous error
      (y) (if at end) reset & continue to final error
      (;) step instruction (include number to step multiple)
      (g) turn on generated sources, (G) turn off generated sources except via `;`
      (p) print instruction & state (`p [mem|cal|sto]*`; see docs for more)
      (l) print additional source context (`l [+<lines-ahead>] [-<lines-back>]`)
      (s) print stacktrace, (e) Print recent events (`e [<number>|all]`)
      (q) quit, (r) reset, (t) load new transaction, (T) unload transaction
      (b) add breakpoint (`b [[<source-file>:]<line-number>]`; see docs for more)
      (B) remove breakpoint (similar to adding, or `B all` to remove all)
      (+) add watch expression (`+:<expr>`), (-) remove watch expression (-:<expr>)
      (?) list existing watch expressions and breakpoints
      (v) print variables and values (`v [bui|glo|con|loc]*`)
      (:) evaluate expression - see `v`, (h) print this help
      ```
5. **Fix Issues and Re-Test**:
    - Identify and fix any issues in your smart contracts.
    - Re-run the debugger to verify the changes and ensure the correct behavior.
    - Continue testing and debugging until you are satisfied with the results.

### Example of Debugging a Transaction

Here’s a simple example of how to deploy and interact with a contract in Truffle:

1. Modify the `migrations/1_deploy_contracts.js` script to deploy and interact with the `SimpleStorage` contract:
   ```javascript
   const SimpleStorage = artifacts.require("SimpleStorage");
   
   module.exports = async function (deployer) {
      await deployer.deploy(SimpleStorage);
      const simpleStorage = await SimpleStorage.deployed();
      console.log("Contract Address:", simpleStorage.address);
      const result = await simpleStorage.set(42);
      console.log("Transaction Hash:", result.tx);
      const storedData = await simpleStorage.get();
      console.log("Stored Data:", storedData.toNumber());
   };
   ```
2. Run the Truffle script to deploy and interact with the contract:
   ```bash
   truffle migrate
   ```
3. Debug the transaction using the Truffle debugger:
   ```bash
   truffle debug <place_tx_hash_here>
   ```
4. Use the debugger commands to step through the transaction and inspect the state changes.
5. Example output after running the debugger:
   ```bash
   SimpleStorage.sol:
   
   3: pragma solidity ^0.8.0;
   4:
   5: contract SimpleStorage {
   ^^^^^^^^^^^^^^^^^^^^^^^^
   
   debug(development:0xe122240e...)> # Clicking enter here will step to the next line
   ```
6. Output after clicking enter several times:
   ```bash
   SimpleStorage.sol:
   
   6:     uint256 public storedData;
   7:
   8:     function set(uint256 x) public {
   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   
   debug(development:0xe122240e...)>
   
   Transaction completed successfully.
   ```
7. Output after

## 3. Advanced Debugging with `debug_traceTransaction`

For more advanced debugging, you can directly use the `debug_traceTransaction` method.
This method allows you to trace the execution of a transaction, providing detailed information about each call made
during the transaction.

### Manually Calling `debug_traceTransaction`

1. **Set Up a Local Node**:
    - Ensure you have a local node running that supports the `debug_traceTransaction` method.
    - Connect to your local node using
      a [web3 provider](https://web3js.readthedocs.io/en/v1.2.11/web3.html#currentprovider).

2. **Send a JSON-RPC Request**:
    - You can use the `web3.currentProvider.send` method to call `debug_traceTransaction` with `callTracer` or
      `opcodeLogger` as the tracer type.

3. **View the Results**:
    - The results of the `debug_traceTransaction` call will be logged in the console.
    - You can inspect the detailed trace of the transaction, including all internal calls and their respective details.
    - Analyze the trace to understand the flow of execution and identify any issues in your smart contract.

### Examples of Using `debug_traceTransaction`

#### 1. With `callTracer`:

The `callTracer` tracer type provides detailed information about each call made during the transaction. You can inspect
the call frame objects to understand the flow of execution and identify any issues.

##### Example Code:

```javascript
const Web3 = require('web3');
const web3 = new Web3('http://localhost:7546'); // Connect to your local node

// Function to trace a transaction using debug_traceTransaction
async function traceTransaction(txHash) {
  return web3.currentProvider.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'debug_traceTransaction',
    params: [
      txHash,
      {
        tracer: 'callTracer',
        tracerConfig: { onlyTopCall: false }
      }
    ]
  });
}

// Example usage
const txHash = '0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae';
traceTransaction(txHash).then(result => console.log(result));
```

##### Response Schema:

##### CallFrame

The `CallFrame` object represents a call made during the transaction execution. It contains detailed information about
the call, including the `from` and `to` addresses, the amount of value transferred, gas provided, gas used, input data,
output data, error, revert reason, and any sub-calls made during the call.

It contains the following fields:

- `type`: **string** - `"CALL"` or `"CREATE"`
- `from`: **string** - hex-encoded address
- `to`: **string** - hex-encoded address
- `value`: **string** - hex-encoded amount of value transfer
- `gas`: **string** - hex-encoded gas provided for call
- `gasUsed`: **string** - hex-encoded gas used during call
- `input`: **string** - call data
- `output`: **string** - return data
- `error`: **string** - error, if any
- `revertReason`: **string** - solidity revert reason, if any
- `calls`: **CallFrame[]** - nested list of sub-calls containing the same fields

##### Example Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "type": "CALL",
    "from": "0x5067c042e35881843f2b31dfc2db1f4f272ef48c",
    "to": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
    "value": "0x0",
    "gas": "0x17459",
    "gasUsed": "0x166cb",
    "input": "0x0f5287b0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000001debea42000000000000000000000000000000000000000000000000000000000000000167c46aa713cfe47608dd1c16f8a0325208df084c3cbebf9f366ad0eafc2653e400000000000000000000000000000000000000000000000000000000001e8542000000000000000000000000000000000000000000000000000000006eca0000",
    "output": "0x000000000000000000000000000000000000000000000000000000000001371e",
    "calls": [
      {
        "type": "DELEGATECALL",
        "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
        "to": "0x76364611e457b1f97cd58ffc332ddc7561a193f6",
        "gas": "0x15bc0",
        "gasUsed": "0x1538e",
        "input": "0x0f5287b0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000001debea42000000000000000000000000000000000000000000000000000000000000000167c46aa713cfe47608dd1c16f8a0325208df084c3cbebf9f366ad0eafc2653e400000000000000000000000000000000000000000000000000000000001e8542000000000000000000000000000000000000000000000000000000006eca0000",
        "output": "0x000000000000000000000000000000000000000000000000000000000001371e",
        "calls": [
          {
            "type": "STATICCALL",
            "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
            "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            "gas": "0x123bb",
            "gasUsed": "0x25c0",
            "input": "0x313ce567",
            "output": "0x0000000000000000000000000000000000000000000000000000000000000006",
            "calls": [
              {
                "type": "DELEGATECALL",
                "from": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "to": "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
                "gas": "0x10357",
                "gasUsed": "0x94d",
                "input": "0x313ce567",
                "output": "0x0000000000000000000000000000000000000000000000000000000000000006"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### 2. With `opcodeLogger`:

The `opcodeLogger` tracer type provides detailed information about each opcode executed during the transaction. You can
inspect the `StructLog` objects to understand the flow of execution in the EVM and identify any issues.

##### Example Code:

```javascript
const Web3 = require('web3');
const web3 = new Web3('http://localhost:7546'); // Connect to your local node

// Function to trace a transaction using debug_traceTransaction with opcodeLogger
async function traceTransaction(txHash) {
  return web3.currentProvider.send({
    jsonrpc: '2.0',
    id: 1,
    method: 'debug_traceTransaction',
    params: [
      txHash,
      {
        tracer: 'opcodeLogger',
        tracerConfig: { enableMemory: true, disableStack: false, disableStorage: false }
      }
    ]
  });
}

// Example usage
const txHash = '0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae';
traceTransaction(txHash).then(result => console.log(result));
```

##### Response Schema:

##### OpcodeTrace

The `OpcodeTrace` object represents the trace of a transaction execution in the EVM.

It contains the following fields:

- `gas`: **number** - total gas used during the execution.
- `failed`: **boolean** - indicates whether the transaction failed.
- `returnValue`: **string | null** - hex-encoded return value of the transaction.
- `structLogs`: **StructLog[]** - list of `StructLog` objects representing the opcodes executed during the transaction.

##### StructLog

The `StructLog` object represents an individual opcode executed during a smart contract transaction.

It contains the following fields:

- `pc`: **number** - program counter.
- `op`: **string** - opcode.
- `gas`: **number** - gas remaining.
- `gasCost`: **number** - gas cost of the opcode.
- `depth`: **number** - call depth.
- `stack`: **string[]** - hex-encoded stack contents. (`null` if `disableStack` is `true`)
- `memory`: **string[] | null** - hex-encoded memory contents. (`null` if `disableMemory` is `true`)
- `storage`: **{ [key: string]: string } | null** - hex-encoded storage contents. (`null` if `disableStorage` is `true`)
- `reason`: **string | null** - The reason for failure, if any. (`null` if the transaction did not fail.)
    - In the
      following [format](https://besu.hyperledger.org/23.7.3/private-networks/how-to/send-transactions/revert-reason#revert-reason-format)

#### Example Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1
  "result": {
    "gas": 43718,
    "failed": false,
    "returnValue": "",
    "structLogs": [
      {
        "pc": 2,
        "op": "PUSH1",
        "gas": 26162,
        "gasCost": 3,
        "depth": 0,
        "stack": [
          "80"
        ],
        "memory": [],
        "storage": {}
      },
      {
        "pc": 4,
        "op": "PUSH1",
        "gas": 26159,
        "gasCost": 3,
        "depth": 0,
        "stack": [
          "80",
          "40"
        ],
        "memory": [],
        "storage": {}
      },
      {
        "pc": 5,
        "op": "MSTORE",
        "gas": 26147,
        "gasCost": 12,
        "depth": 0,
        "stack": [],
        "memory": [
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000080"
        ],
        "storage": {}
      },
      {
        "pc": 6,
        "op": "CALLVALUE",
        "gas": 26145,
        "gasCost": 2,
        "depth": 0,
        "stack": [
          "0000000000000000000000000000000000000000000000000000000000000000"
        ],
        "memory": [
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000080"
        ],
        "storage": {}
      },
      /* skip */
      {
        "pc": 124,
        "op": "STOP",
        "gas": 3651,
        "gasCost": 0,
        "depth": 0,
        "stack": [
          "0000000000000000000000000000000000000000000000000000000060fe47b1"
        ],
        "memory": [
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000080"
        ],
        "storage": {
          "0000000000000000000000000000000000000000000000000000000000000000": "000000000000000000000000000000000000000000000000000000000000002a"
        }
      }
    ]
  }
}
```
