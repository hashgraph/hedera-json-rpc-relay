# Debugging Transactions

## Table of Contents
1. [Overview](#overview)
2. [Built-in Remix Debugger](#1-built-in-remix-debugger)
   - [Steps to Use the Built-in Debugger](#steps-to-use-the-built-in-debugger)
   - [Example of Debugging a Transaction](#example-of-debugging-a-transaction)
3. [Advanced Debugging with `debug_traceTransaction`](#2-advanced-debugging-with-debug_traceTransaction)
   - [Manually Calling `debug_traceTransaction`](#manually-calling-debug_traceTransaction)
   - [Examples of Using `debug_traceTransaction`](#examples-of-using-debug_tracetransaction)
      - [With `callTracer`](#1-with-callTracer)
      - [With `opcodeLogger`](#2-with-opcodeLogger)

## Overview

[Remix IDE](https://remix-project.org/) provides powerful debugging tools that allow developers to inspect and analyze the execution of smart contracts.

This guide will walk you through the various debugging capabilities available in Remix, including:

1. how to use the built-in debugger in Remix to step through the execution of a transaction and inspect the state of your smart contracts, and
2. how to manually call the `debug_traceTransaction` method and analyze the response to get detailed information about the execution of a transaction.

## 1. Built-in Remix Debugger

The built-in debugger in Remix allows you to step through the execution of a transaction, inspect the state, and understand the behavior of your smart contracts.

### Steps to Use the Built-in Debugger

Official Documentation: [Remix Debugger](https://remix-ide.readthedocs.io/en/latest/debugger.html)

1. **Set Up Remix with a Local Node**:
   - Ensure you have a local node running that supports the `debug_traceTransaction` method.
   - Connect Remix to your local node by selecting the "Web3 Provider" option in the Remix IDE and entering the URL of your local node (e.g., `http://localhost:8545`).

2. **Deploy or Load Contract**:
   - [Create and deploy your smart contract](https://remix-ide.readthedocs.io/en/latest/create_deploy.html) using Remix or load an existing contract by providing its address.

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

## 2. Advanced Debugging with `debug_traceTransaction`

For more advanced debugging, you can directly use the `debug_traceTransaction` method. This method allows you to trace the execution of a transaction, providing detailed information about each call made during the transaction.

### Manually Calling `debug_traceTransaction`

1. **Set Up Remix with a Local Node**:
   - Ensure you have a local node running that supports the `debug_traceTransaction` method.
   - Connect Remix to your local node by selecting the "Web3 Provider" option in the Remix IDE and entering the URL of your local node (e.g., `http://localhost:8545`).

2. **Send a JSON-RPC Request**:
   - Use the Remix console to send a JSON-RPC request to the local node.
   - You can use the `web3.currentProvider.send` method to call `debug_traceTransaction` with `callTracer` or `opcodeLogger` as the tracer type.

3. **View the Results**:
   - The results of the `debug_traceTransaction` call will be logged in the Remix console.
   - You can inspect the detailed trace of the transaction, including all internal calls and their respective details.
   - Analyze the trace to understand the flow of execution and identify any issues in your smart contract.

### Examples of Using `debug_traceTransaction`

#### 1. With `callTracer`:

The `callTracer` tracer type provides detailed information about each call made during the transaction. You can inspect the call frame objects to understand the flow of execution and identify any issues.

##### Example Code:

```javascript
// Connect to the local node using Remix's web3 provider
const web3 = new Web3(web3.currentProvider);

// Function to trace a transaction using debug_traceTransaction
async function traceTransaction(txHash) {
   return web3.currentProvider.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'debug_traceTransaction',
      params: [txHash, { tracer: 'callTracer' }, { onlyTopCall: false }]
   });
}

// Example usage
const txHash = '0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae';
const result = await traceTransaction(txHash);
console.log(result);
```

##### Response Schema:

##### CallFrame

The `CallFrame` object represents a call made during the transaction execution. It contains detailed information about the call, including the `from` and `to` addresses, the amount of value transferred, gas provided, gas used, input data, output data, error, revert reason, and any sub-calls made during the call.

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

The `opcodeLogger` tracer type provides detailed information about each opcode executed during the transaction. You can inspect the `StructLog` objects to understand the flow of execution in the EVM and identify any issues.

##### Example Code:

```javascript
// Connect to the local node using Remix's web3 provider
const web3 = new Web3(web3.currentProvider);

// Function to trace a transaction using debug_traceTransaction with opcodeLogger
async function traceTransaction(txHash) {
   return web3.currentProvider.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'debug_traceTransaction',
      params: [txHash, { tracer: 'opcodeLogger', disableMemory: false, disableStack: false, disableStorage: false }]
   });
}

// Example usage
const txHash = '0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae';
const result = await traceTransaction(txHash);
console.log(result);
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
  - In the following [format](https://besu.hyperledger.org/23.7.3/private-networks/how-to/send-transactions/revert-reason#revert-reason-format)

#### Example Response:

```json
{
   "jsonrpc": "2.0",
   "id": 1,
   "result": {
      "gas": 85301,
      "failed": true,
      "returnValue": "",
      "structLogs": [
         {
            "depth": 0,
            "gas": 162106,
            "gasCost": 3,
            "memory": [],
            "op": "PUSH1",
            "pc": 0,
            "reason": null,
            "stack": [],
            "storage": {}
         },
         {
            "depth": 1,
            "gas": 162103,
            "gasCost": 3,
            "memory": [],
            "op": "PUSH1",
            "pc": 2,
            "reason": null,
            "stack": [],
            "storage": {}
         },
         {
            "depth": 2,
            "gas": 100000,
            "gasCost": 0,
            "memory": ["0x0000000000000000000000000000000000000000000000000000000000000006", "0x0000000000000000000000000000000000000000000000000000000000000000", "0000000000000000000000000000000000000000000000000000000000000060"],
            "op": "REVERT",
            "pc": 120,
            "reason": "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001a4e6f7420656e6f7567682045746865722070726f76696465642e000000000000",
            "stack": ["0x00000000000000000000000000000000000000000000000000000000d67cbec9"],
            "storage": {
               "0x0000000000000000000000000000000000000000000000000000000000000004": "0x8241fa522772837f0d05511f20caa6da1d5a3209000000000000000400000001",
               "0x0000000000000000000000000000000000000000000000000000000000000006": "0x0000000000000000000000000000000000000000000000000000000000000001",
               "0xf652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f": "0x00000000000000000000000002e816afc1b5c0f39852131959d946eb3b07b5ad"
            }
         }
      ]
   }
}
```