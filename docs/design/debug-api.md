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

#### Parameters
`transactionHash` - string - This is the hash of the transaction that we want to trace.
`tracer` - string - to specify the type of tracer. In the beginning only `callTracer` will be accepted.
`tracerConfig` - object - consists of one property inside called `onlyTopCall`, which is a boolean. 

#### Returns 
`object` - trace object: 

1. `type` - string - CALL or CREATE
2. `from` - string	- address
3. `to` - string	- address
4. `value`	- string	- hex-encoded amount of value transfer
5. `gas`	- string	- hex-encoded gas provided for call
6. `gasUsed` - string	 -hex-encoded gas used during call
7. `input` - string	 -call data
8. `output` - string	- return data
9. `error` - string	- error, if any
10. `revertReason` - string - Solidity revert reason, if any
11. `calls` - []callframe	- list of sub-calls

#### Example Request

```JSON
{"jsonrpc": "2.0",
         "id": 1,
         "method": "debug_traceTransaction",
         "params": [
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


### Method description

`debug_getModifiedAccountsByHash` - Returns all accounts that have changed between the two blocks specified. 

#### Parameters
startHash - string - the first hash of block at which to retreive data
endHash - string - the last hash of block at which to retreive data. Optional, defaults to startHash

#### Returns 
addresses - array of addresses

#### Example Request

```JSON
{
	"jsonrpc":"2.0",
	"method":"debug_getModifiedAccountsByHash",
	"params":[
		"0x2a1af018e33bcbd5015c96a356117a5251fcccf94a9c7c8f0148e25fdee37aec",
		"0x4e3d3e7eee350df0ee6e94a44471ee2d22cfb174db89bbf8e6c5f6aef7b360c5"
	],
	"id":"1"
}
```

#### Example Response
```JSON
 {
  "jsonrpc": "2.0",
  "id": 1,
    "result": [
      "0x8c0041566e0bc27efe285a9e98d0b4217a46809c",
      "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
      "0x76364611e457b1f97cd58ffc332ddc7561a193f6"
    ]
 }
```

### Method description

`debug_getModifiedAccountsByNumber` - Returns all accounts that have changed between the two blocks specified.

#### Parameters
startNum - number - start block number
endNum - number - end block number. Optional, defaults to startNum

#### Returns 
addresses - array of addresses

#### Example Request
```JSON
{
	"jsonrpc":"2.0",
	"method":"debug_getModifiedAccountsByNumber",
	"params":[
		100,
		200
	],
	"id":"1"
}
```

#### Example Response
```JSON
 {
  "jsonrpc": "2.0",
  "id": 1,
    "result": [
      "0x8c0041566e0bc27efe285a9e98d0b4217a46809c",
      "0x3ee18b2214aff97000d974cf647e7c347e8fa585",
      "0x76364611e457b1f97cd58ffc332ddc7561a193f6"
    ]
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

1. Log every call to all filter API method, as a total amount.
2. Log every success or fail for each new API method, as a total amount.

## Tests
The following test cases should be covered but additional tests would be welcome.

1. Overall functionality of the methods.
2. Test different scenarios with all possible parameter combinations.
3. Case where transaction is not found for `debug_traceTransaction`.
4. Case where block hash is not found for `debug_getModifiedAccountsByHash`.
5. Case where block number is not found for `debug_getModifiedAccountsByNumber`.


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