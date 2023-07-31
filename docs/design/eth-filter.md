# Filter API design

## Purpose

The JSON-RPC Relay currently doesn't support monitoring events using filter API as is common in many other relays and is expected by many web3 tools, which makes polling for event logs, new blocks and transactions hard for developers.

## Goals

1. Introduce new methods:
   1. `eth_newFilter`
   2. `eth_uninstallFilter`
   3. `eth_getFilterChanges`
   4. `eth_getFilterLogs`

## Non-Goals

1. Decrease the load on the subscription, as this is an alternative.
2. Increase the supported functionality of the relay.

## Architecture

New filter API methods can be added and handled by extending `eth` class. Adding several new methods is needed and for saving the filter IDs it needs to utilize the already available cache.

### Filter Types

|      Filter Type       |                                                    Description                                                     |                           Support                           |
| :--------------------: | :----------------------------------------------------------------------------------------------------------------: | :---------------------------------------------------------: |
|          logs          |                               Returns all logs matching filter with given filter ID.                               |                       Yes, initially                        |
|       newBlocks        |                            Returns all new blocks matching filter with given filter ID.                            |                 No, maybe in future release                 |
| newPendingTransactions | Returns transaction hashes that are sent to the network and marked as `pending`, depending on the given filter ID. | No, as Hedera does not have pending transactions on a node. |

### Initiating a filtration

#### Request

```javascript
{"jsonrpc":"2.0","id": 1, "method": "eth_newFilter", "params": [fromBlock, toBlock, address, topics]}
```

#### Response

```javascript
{"jsonrpc":"2.0","id": 1, "result": FILTER_ID}
```

### Getting Filter Changes

     The `getFilterLogs` method returns logs that match a specified topic filter and are included in newly added blocks.

#### Parameters

An existing

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

## Error Codes

| Error Codes |   Error message   |                              Solution                               |
| :---------: | :---------------: | :-----------------------------------------------------------------: |
|    32000    | Filter not found. | Occurs when user attempts receive logs using non-existing filterID. |

## Rate Limits

1. All filters expire after 5 minutes of inactivity (no queries).

## Metric Capturing

Capture metrics for the following:

1. Log every call to all filter API method, as a total amount and broken down by IP.
2. The duration of active filters.
3. The total amount of requests to the mirror node per filter.
4. The amount of requests to the mirror node per filter that have returned non-null data.

## Tests

The following test cases should be covered but additional tests would be welcome.

1. Overall functionality of creating and uninstalling new filters.
2. Receiving requested information depending on filterID using `eth_getFilterChanges` and `eth_getFilterLogs`.
3. Deleting of filter due to inactivity.
4. E2E test using popular libraries (`ethers.js WebSocketProvider`).

## Non-Functional Requirements

Users should be required to renew their filters in the case of an inactivity. If for some reason the relay is restarted it will lose all cached filters.

## Deployment

Filter API will run alongside the already available HTTP server.

## Answered Questions

1. How will we implement the `getFilterChanges` and `getFilterLogs` flow?
2. How will the relay poll the mirror node?
3. What kind of limits will be implemented?

## Tasks (in suggested order):

#### Milestone 1

1. Finalize design document

#### Milestone 2

1. Introduce `еth_newFilter` and add acceptance and unit tests.
2. Introduce `eth_uninstallFilter` and add acceptance and unit tests.
3. Introduce `eth_getFilterChanges` and add acceptance and unit tests.
4. Introduce `eth_getFilterLogs` and add acceptance and unit tests.
