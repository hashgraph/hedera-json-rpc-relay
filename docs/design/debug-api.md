# Debug API design

## Purpose

The Debug API gives you access to several non-standard RPC methods, which will allow you to inspect, debug and set certain debugging flags during runtime. Also, it could help you replay all the transactions that have been executed prior and save considerable effort for your debugging process.

## Goals

1. **Debugging Capabilities**: Enable developers to retrieve detailed information about transactions, execution traces, and other debugging-related data.
2. **Enhanced Insights**: Provide deeper insights into the behavior of smart contracts, transaction execution, and state changes on the Hedera network.
3. **Ethereum Equivalent**: Makes the Hedera JSON-RPC Relay more equivalent to other providers used in the ethereum ecosystem, by providing the needed endpoints for easier debugging by developers.

## Architecture

New Debug API methods can be added and handled by adding debug service, which will be blueprinted by new `debug` interface added in the relay interface itself. Each method will be separate from the other and they won't overlap in terms of functionality.

### Interface
```javascript
export interface Debug {
  traceTransaction(transactionHash, { tracer, tracerConfig });

  getModifiedAccountsByHash(startHash, endHash);

  getModifiedAccountsByNumber(startNum, endNum);
}
```

### Service class
```javascript
class DebugService implements Debug{
  traceTransaction(transactionHash, { tracer, tracerConfig }) {
    // Implementation of traceTranscation depending on passed params.
  }

  getModifiedAccountsByHash(startHash, endHash){ 
    // Implementation of getModifiedAccountsByHash depending on passed params.
  }

  getModifiedAccountsByNumber(startNum, endNum){
    // Implementation of getModifiedAccountsByNumber depending on passed params.
  }
}
```

### Method description

`debug_traceTransaction` - Attempts to run the transaction in the exact same manner as it was executed on the network.
This is achieved by utilizing the /api/v1/contracts/results/{transactionIdOrHash}/actions endpoint of the mirror node.
The relevant fields retrieved from this endpoint are processed and formatted to generate the expected response as outlined below.

#### Parameters
`transactionHash` - string - This is the hash of the transaction that we want to trace. <br>
`tracer` - string - to specify the type of tracer. Possible values are `callTracer` or `opcodeLogger`. In the beginning only `callTracer` will be accepted. <br>
`tracerConfig` - object 
  * One property for log tracer called `onlyTopCall`, which is a boolean. <br>
  * For `opcodeLogger` it can have four properties - enableMemory, disableStack, disableStorage, enableReturnData - all booleans
#### Returns for callTracer
`object` - trace object: 

1. `type` - string - CALL or CREATE
2. `from` - string	- address
3. `to` - string	- address
4. `value`	- string	- hex-encoded amount of value transfer
5. `gas`	- string	- hex-encoded gas provided for call
6. `gasUsed` - string - hex-encoded gas used during call
7. `input` - string - call data
8. `output` - string  - return data
9. `error` - string	- error, if any
10. `revertReason` - string - Solidity revert reason, if any
11. `calls` - []callframe	- list of sub-calls

#### Example Request callTracer

```JSON
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "debug_traceTransaction",
  "params": 
    [
      "0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae",
      {
        "tracer": "callTracer"
      }
    ]
}
```
#### Example Response
```JSON
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
          },
          {
            "type": "STATICCALL",
            "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
            "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            "gas": "0xf9d6",
            "gasUsed": "0xcf3",
            "input": "0x70a082310000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585",
            "output": "0x00000000000000000000000000000000000000000000000000001691e551e115",
            "calls": [
              {
                "type": "DELEGATECALL",
                "from": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "to": "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
                "gas": "0xf315",
                "gasUsed": "0x9e1",
                "input": "0x70a082310000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585",
                "output": "0x00000000000000000000000000000000000000000000000000001691e551e115"
              }
            ]
          },
          {
            "type": "CALL",
            "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
            "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            "value": "0x0",
            "gas": "0xe796",
            "gasUsed": "0x5f48",
            "input": "0x23b872dd0000000000000000000000005067c042e35881843f2b31dfc2db1f4f272ef48c0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585000000000000000000000000000000000000000000000000000000001debea42",
            "output": "0x0000000000000000000000000000000000000000000000000000000000000001",
            "calls": [
              {
                "type": "DELEGATECALL",
                "from": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "to": "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
                "gas": "0xe115",
                "gasUsed": "0x5c2d",
                "input": "0x23b872dd0000000000000000000000005067c042e35881843f2b31dfc2db1f4f272ef48c0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585000000000000000000000000000000000000000000000000000000001debea42",
                "output": "0x0000000000000000000000000000000000000000000000000000000000000001"
              }
            ]
          },
          {
            "type": "STATICCALL",
            "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
            "to": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            "gas": "0x857c",
            "gasUsed": "0x523",
            "input": "0x70a082310000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585",
            "output": "0x00000000000000000000000000000000000000000000000000001692033dcb57",
            "calls": [
              {
                "type": "DELEGATECALL",
                "from": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                "to": "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf",
                "gas": "0x808c",
                "gasUsed": "0x211",
                "input": "0x70a082310000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585",
                "output": "0x00000000000000000000000000000000000000000000000000001692033dcb57"
              }
            ]
          },
          {
            "type": "CALL",
            "from": "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
            "to": "0x98f3c9e6e3face36baad05fe09d375ef1464288b",
            "value": "0x0",
            "gas": "0x4f9f",
            "gasUsed": "0x46c6",
            "input": "0xb19a437e000000000000000000000000000000000000000000000000000000006eca00000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000000000000000000000000000000000000000008501000000000000000000000000000000000000000000000000000000001debea42000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000267c46aa713cfe47608dd1c16f8a0325208df084c3cbebf9f366ad0eafc2653e4000100000000000000000000000000000000000000000000000000000000001e8542000000000000000000000000000000000000000000000000000000",
            "output": "0x000000000000000000000000000000000000000000000000000000000001371e",
            "calls": [
              {
                "type": "DELEGATECALL",
                "from": "0x98f3c9e6e3face36baad05fe09d375ef1464288b",
                "to": "0x8c0041566e0bc27efe285a9e98d0b4217a46809c",
                "gas": "0x3b88",
                "gasUsed": "0x3377",
                "input": "0xb19a437e000000000000000000000000000000000000000000000000000000006eca00000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000f000000000000000000000000000000000000000000000000000000000000008501000000000000000000000000000000000000000000000000000000001debea42000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000267c46aa713cfe47608dd1c16f8a0325208df084c3cbebf9f366ad0eafc2653e4000100000000000000000000000000000000000000000000000000000000001e8542000000000000000000000000000000000000000000000000000000",
                "output": "0x000000000000000000000000000000000000000000000000000000000001371e"
              }
            ]
          }
        ]
      }
    ]
  }
}
```
#### Returns for opcodeLogger

`object` - trace object:
1. `pc`	- int - program counter
2. `op` -	string - opcode to be executed
3. `gas`- int -	remaining gas
4. `gasCost`- int -	cost for executing op
5. `memory`	- string[] -	EVM memory. Enabled via enableMemory
6. `memSize`- int	- Size of memory
7. `stack`- int[]	- EVM stack. Disabled via disableStack
8. `returnData`	- string[]	- Last call's return data. Enabled via enableReturnData
9. `storage` - map[hash]hash	- Storage slots of current contract read from and written to. Only emitted for SLOAD and SSTORE. Disabled via disableStorage
10. `depth` -	int -	Current call depth
11. `refund`	- int -	Refund counter
12. `error` -	string -	Error message if any

#### Example Request opcodeLogger
```JSON
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "debug_traceTransaction",
  "params": 
    [
      "0x8fc90a6c3ee3001cdcbbb685b4fbe67b1fa2bec575b15b0395fea5540d0901ae",
      {
        "tracer": "opcodeLogger"
      }
    ]
}
```
#### Example Response
```JSON
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "gas": 85301,
    "returnValue": "",
    "structLogs": [{
        "depth": 1,
        "error": "",
        "gas": 162106,
        "gasCost": 3,
        "memory": null,
        "op": "PUSH1",
        "pc": 0,
        "stack": [],
        "storage": {}
    },
    /* skip */
    {
        "depth": 1,
        "error": "",
        "gas": 100000,
        "gasCost": 0,
        "memory": ["0000000000000000000000000000000000000000000000000000000000000006", "0000000000000000000000000000000000000000000000000000000000000000", "0000000000000000000000000000000000000000000000000000000000000060"],
        "op": "STOP",
        "pc": 120,
        "stack": ["00000000000000000000000000000000000000000000000000000000d67cbec9"],
        "storage": {
          "0000000000000000000000000000000000000000000000000000000000000004": "8241fa522772837f0d05511f20caa6da1d5a3209000000000000000400000001",
          "0000000000000000000000000000000000000000000000000000000000000006": "0000000000000000000000000000000000000000000000000000000000000001",
          "f652222313e28459528d920b65115c16c04f3efc82aaedc97be59f3f377c0d3f": "00000000000000000000000002e816afc1b5c0f39852131959d946eb3b07b5ad"
        }
    }]
  }
}
```

## Error Codes

| Error Codes |        Error message        |                              Solution                               |
| :---------: | :-------------------------: | :-----------------------------------------------------------------: |
|    32000    |      Transaction not found.      | Occurs when user is trying to trace non-existing transaction. |
|    32001    | Block hash not found. |          Occurs when user is trying to get modified accounts for non-existing block hash.           |
|    32002    | Block number not found. |          Occurs when user is trying to get modified accounts for non-existing block number.           |

## Limits
1. Trying to get modified accounts for more than ex. 100 blocks. Env. variable can be `DEBUG_MODIFIED_ACCOUNTS_LIMIT`


## Metric Capturing

Capture metrics for the following:

1. Record each invocation of all debug API methods and maintain a cumulative count.
2. Log every success or fail for each new API method and maintain a cumulative count.

## Tests
The following test cases should be covered but additional tests would be welcome.

1. Test `debug_traceTransaction` with `callTracer` and `onlyTopCall` set to true.
2. Test `debug_traceTransaction` with `callTracer` and `onlyTopCall` set to false.
3. Test `debug_traceTransaction` with `opcodeLogger` and all the tracerConfig values set to false.
4. Test `debug_traceTransaction` with `opcodeLogger` and all the tracerConfig values set to true.
5. Test `debug_traceTransaction` with `opcodeLogger` and all different combinations of tracerConfig values.
6. Test `debug_traceTransaction` with hashes for the different types of transactions e.g Legacy, 1559, 2930.
7. Case where transaction is not found for `debug_traceTransaction`.

## Deployment

Debug API will run alongside the already available HTTP server.

## Answered Questions

1. What is the purpose of Debug API and what kind of goals adding it fulfil ?
2. What new interfaces and classes would it need ?
3. What new endpoints will be exposed ?
4. What kind of parameters each method accepts ?
5. What kind of response is expected to return ?
6. What is the expected request and response ?
7. What limits should be introduced ? 
8. What metrics should be captured ?


## Tasks (in suggested order):

#### Milestone 1

1. Finalize design document

#### Milestone 2

1. Implement new interfaces and classes.
2. Implement `debug_traceTransaction`.
3. Add needed acceptance tests for `debug_traceTransaction`.

#### Milestone 3
1. Implement `debug_getModifiedAccountsByHash`.
2. Implement `debug_getModifiedAccountsByNumber`.
3. Add needed acceptance tests for both new methods.