# Filter API design

## Purpose

The JSON-RPC Relay currently doesn't support monitoring events using filter API as is common in many other relays and is expected by many web3 tools, like ethersjs, web3js and even development environment like Hardhat. This new functionality makes polling for event logs, new blocks and transactions hard for developers.

## Goals

1. Introduce new methods:
   1. `eth_newFilter`
   2. `eth_uninstallFilter`
   3. `eth_getFilterChanges`
   4. `eth_getFilterLogs`
2. Increase the supported functionality of the relay.

## Non-Goals

1. Decrease the load on the subscription, as this is an alternative.

## Architecture

New filter API methods can be added and handled by adding filter service, which expands the `eth` interface. Adding several new methods is needed and for saving the filter IDs it needs to utilize the already available cache.

Parameters accepted in the `eth_newFilter` method are:

- blockHash - Using blockHash is equivalent to fromBlock = toBlock = the block number with hash blockHash. If blockHash is present in the filter criteria, then neither fromBlock nor toBlock are allowed.
- address - Contract address or a list of addresses from which logs should originate.
- fromBlock - Either the hex value of a block number OR block tags.
- toBlock - Either the hex value of a block number OR block tags.
- topics - Array of 32 Bytes DATA topics. Topics are order-dependent. Each topic can also be an array of DATA with "or" options.

Parameters accepted in `eth_uninstallFilter`, `eth_getFilterChanges` and `eth_getFilterLogs` methods are:

- hex formated `filterId`.

### Filter Types

|      Filter Type       |                                                    Description                                                     |                           Support                           |
| :--------------------: | :----------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------: |
|          logs          |                               Returns all logs matching filter with given filter ID.                               |                       Yes, initially                        |
|       newBlocks        |                            Returns all new blocks matching filter with given filter ID.                            |                 No, maybe in future release                 |
| newPendingTransactions | Returns transaction hashes that are sent to the network and marked as `pending`, depending on the given filter ID. | No, as Hedera does not have pending transactions on a node. |

### Initiating a filtration

#### Request

```javascript
{"jsonrpc":"2.0","id": 1, "method": "eth_newFilter", "params": [blockHash ,fromBlock, toBlock, address, topics]}
```

#### Response

```javascript
{"jsonrpc":"2.0","id": 1, "result": FILTER_ID}
```

### Getting Filter Logs

     The `getFilterLogs` method returns an array of all logs matching filter with given id. Can compute the same results with an eth_getLogs call.

#### Parameters

An existing `FILTER_ID` in hex format

#### Request

```javascript
{"jsonrpc":"2.0","id": 1, "method": "eth_getFilterLogs", "params": ["0x123"]}
```

#### Response

```javascript
{
    "jsonrpc": "2.0",
    "id": 73,
    "result": [{
        "address": "0xb5a5f22694352c15b00323844ad545abb2b11028",
        "blockHash": "0x99e8663c7b6d8bba3c7627a17d774238eae3e793dee30008debb2699666657de",
        "blockNumber": "0x5d12ab",
        "data": "0x0000000000000000000000000000000000000000000000a247d7a2955b61d000",
        "logIndex": "0x0",
        "removed": false,
        "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "0x000000000000000000000000bdc0afe57b8e9468aa95396da2ab2063e595f37e", "0x0000000000000000000000007503e090dc2b64a88f034fb45e247cbd82b8741e"],
        "transactionHash": "0xa74c2432c9cf7dbb875a385a2411fd8f13ca9ec12216864b1a1ead3c99de99cd",
        "transactionIndex": "0x3"
    }]
}
```

### Getting Filter Changes

     The `getFilterChanges` method returns an array of logs which occurred since last poll.

#### Parameters

An existing `FILTER_ID` in hex format

#### Request

```javascript

{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "eth_getFilterChanges",
  "params": [
    "0x62440eb3b951769ef7cc8abb1d26fbaa"
  ]
}

```

#### Response

```javascript
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "address": "0xe41d2489571d322189246dafa5ebde1f4699f498",
      "blockHash": "0x8243343df08b9751f5ca0c5f8c9c0460d8a9b6351066fae0acbd4d3e776de8bb",
      "blockNumber": "0x429d3b",
      "data": "0x00000000000000000000000000000000000000000000006194049f30f7200000",
      "logIndex": "0x1",
      "removed": false,
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000e4c8eb504eeeffb8a0468318a96d565d7521aef3",
        "0x0000000000000000000000004a7a5c1f34c57b9d1e0993e83060b6736f6a42bd"
      ],
      "transactionHash": "0x78356eec0d6ed3087e277538811f604c329be8217c5b5e007e4eeb3dba973bff",
      "transactionIndex": "0x2"
    }
  ]
}
```

## Error Codes

| Error Codes |        Error message        |                              Solution                               |
| :---------: | :-------------------------: | :-----------------------------------------------------------------: |
|    32000    |      Filter not found.      | Occurs when user attempts receive logs using non-existing filterID. |
|    32602    | Log response size exceeded. |          Occurs when user request exceed logs size limit.           |

## Limits

1. All filters expire after 5 minutes of inactivity (no queries). Env. variable can be `FILTER_CACHE_TTL`.
2. Returned logs should have limitations, similar to those used in `eth_getLogs` method.

## Metric Capturing

Capture metrics for the following:

1. Log every call to all filter API method, as a total amount.
2. The number of active filters.
3. The duration of active filters.
4. The total amount of requests to the mirror node per filter.
5. The amount of requests to the mirror node per filter that have returned non-null data.

## Tests

The following test cases should be covered but additional tests would be welcome.

1. Overall functionality of creating and uninstalling new filters.
2. Receiving requested information depending on filterID using `eth_getFilterChanges` and `eth_getFilterLogs`.
3. Deleting of filter due to inactivity.
4. Case where logs are within limit range.
5. Case where logs are not within limit range.
6. Case where no logs are available.
7. E2E test using popular libraries (`ethers.js WebSocketProvider`).

## Non-Functional Requirements

Users should be required to renew their filters, by calling again `eth_newFilter`, in the case of an inactivity. If for some reason the relay is restarted it will lose all cached filters.

## Deployment

Filter API will run alongside the already available HTTP server.

## Answered Questions

1. What kind of limits will be implemented?
2. What kind of parameters are accepted from the methods?
3. What is the difference between `eth_getFilterChanges` and `eth_getFilterLogs` ?
4. What kind of tests are needed to test this new functionality ?

## Tasks (in suggested order):

#### Milestone 1

1. Finalize design document

#### Milestone 2

1. Introduce `еth_newFilter` and add acceptance and unit tests.
2. Introduce `eth_uninstallFilter` and add acceptance and unit tests.
3. Introduce `eth_getFilterChanges` and add acceptance and unit tests.
4. Introduce `eth_getFilterLogs` and add acceptance and unit tests.
