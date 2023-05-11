# Subscription design

## Purpose

The JSON-RPC Relay currently doesn't support subscription using websocket as is common in many other relays and is expected by many web3 tools, which makes polling for event logs, new blocks and transactions very hard for developers.

## Goals

1. Implement websocket subscription in the relay
2. Introduce two new methods - `eth_subscribe` and `eth_unsubscribe`
3. Support subscription for event logs

## Non-Goals

1. Add long-term memory to the relay
2. Reduce the efficiency of the relay or mirror node due to high resource usage
3. Support subscription for new blocks and pending transactions

## Architecture

The websocket connections should be handled by its own node process, this can be done by creating a new package - `ws-server`;

### Subscription Types

|   Subscription Type    |                                  Description                                   |                           Support                           |
| :--------------------: | :----------------------------------------------------------------------------: |:-----------------------------------------------------------:|
|          logs          |      Emits logs attached to a new block that match certain topic filters.      |                       Yes, initially                        |
|        newHeads        |               Emits new blocks that are added to the blockchain.               |                 No, maybe in future release                 |
| newPendingTransactions | Emits transaction hashes that are sent to the network and marked as `pending`. | No, as Hedera does not have pending transactions on a node. |

### Initiating a subscription

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://<env>.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": [SUBSCRIPTION_TYPE, PARAMS]}
```

#### Response

```javascript
{"jsonrpc":"2.0","id": 1, "result": SUBSCRIPTION_ID}
```

### Logs

     The `logs` subscription type emits logs that match a specified topic filter and are included in newly added blocks.

#### Parameters

An object with the following fields:

- address (optional): `string` or [`array of strings`] Singular address or array of addresses. Only logs created from one of these addresses will be emitted. Initially only `string` should be supported and filtering by multiple addresses can be added at a later stage.
- topics: an array of topic specifiers.
    - Each topic specifier is either null, a single string, or an array of strings.
    - For every non-null topic, a log will be emitted when activity associated with that topic occurs.

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://<env>.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": ["logs", {"address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}]}
```

#### Response

This response is sent whenever new data is available.

```javascript
{
  "method": "eth_subscription",
  "params": {
    "subscription": SUBSCRIPTION_ID,
    "result": {
      "address": "0x8320fe7702b96808f7bbc0d4a888ed1468216cfd",
      "blockHash": "0x61cdb2a09ab99abf791d474f20c2ea89bf8de2923a2d42bb49944c8c993cbf04",
      "blockNumber": "0x29e87",
      "data": "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003",
      "logIndex": "0x0",
      "topics": ["0xd78a0cb8bb633d06981248b816e7bd33c2a35a6089241d099fa519e361cab902"],
      "transactionHash": "0xe044554a0a55067caafd07f8020ab9f2af60bdfe337e395ecd84b4877a3d1ab4",
      "transactionIndex": "0x0"
    }
  }
}
```

## Mock code

### Server side

```javascript
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', function (ws) {
  ws.on('message', function (msg) {
    const msgString = msg.toString('base64');
    const request = JSON.parse(Buffer.from(msgString, 'base64').toString('ascii'));
    const { method, params } = request;

    if (method === 'eth_subscribe') {
      const event = params[0];

      if (event === 'log') {
        const filter = params[1];
        // Cache the `event`, `filter`, `SUBSCRIPTION_ID` and the current block number values

        // This establishes the subscription
        ws.send(
          JSON.stringify({
            id: request.id,
            result: SUBSCRIPTION_ID,
            jsonrpc: '2.0',
          })
        );
      }

      // Handle other types of events: newPendingTransactions, newHeads, syncing
    }

    // The WebSocketProvider emits an event to `eth_chainId` right after establishing a connection
    else if (method === 'eth_chainId') {
      ws.send(
        JSON.stringify({
          id: request.id,
          result: {
            result: CHAIN_ID,
          },
          jsonrpc: '2.0',
        })
      );
    }

    // Handle other methods
  });

  ws.on('error', console.error);

  ws.on('close', function () {
    // remove subscriptions from cache
  });
});
```

### Client side

```javascript
var subscription = web3.eth.subscribe(
  'logs',
  {
    address: '0x123456..',
    topics: ['0x12345...'],
  },
  function (error, result) {
    if (!error) console.log(result);
  }
);

// unsubscribes the subscription
if (success) {
  console.log('Successfully unsubscribed!');
}
```

### Mirror node polling:

1. Maintain a list of all live socket connections. This can be done with a `key-value` store where the `key` is a unique identifier (some ws libraries provide such an id, but if needed it can be generated by the relay) of the socket object, and the `value` is the socket object itself.
2. Maintain a list of all active subscriptions and the corresponding socket objects. It should have the following structure:

```javascript
  subscriptions: [
    {
      method: string, // newHeads, logs, etc
      params: any,
      subscribers: [{   // a list of all active subscriptions to the specific `method + params` combination
        socketId: string,
        subscription: string
      }],
      lastUpdated: BlockNumber // The latest block number at which this subscription was updated
    }
  ]

```

3. Create a scheduled job that loops through all saved subscriptions and calls the Mirror node Rest API and sends the response to all `subscribers`. It should be possible to configure the time interval. A throttling mechanism can be implemetented that limits the consecutive calls to the Mirror node, and at every interval only X subscriptions with the oldest `lastUpdated` should be polled.
4. Whenever a connection is closed all corresponding subscriptions should be deleted from memory.

## Error Codes

|  Error Codes  |                                                      Error message                                                       |                                                                Solution                                                                 |
|:-------------:|:------------------------------------------------------------------------------------------------------------------------:|:---------------------------------------------------------------------------------------------------------------------------------------:|
|     32607     | The maximum batch size that can be sent over a websocket connection is 10. Please decrease the batch size and try again. |                             Occurs when user attempts to send high-volume JSON-RPC traffic over Websockets.                             |
|     32608     |                       The maximum number of socket connections is reached. Please try again later.                       |     Occurs when a new connection is established, but that exceeds the limit of allowed live connections (controlled by an env var).     |
|     32609     |                                                 Invalid subscription id                                                  | Occurs when user tries to unsubscribe from a non-existing subscription or one that is not associated with the active socket connection. |
|     32610     |                                    Invalid subscription parameters: {detailed reason}                                    |               Occurs when there is an error due to the provided subscription parameters, i.e. the address does not exist.               |
|     32611     |                                                   Subscription aborted                                                   |                          Occurs when the subscription is aborted by the relay, i.e. a maximum TTL is reached.                           |

## Rate Limits

Active subscriptions should be limited in some way. We should create a flexible and configurable system for limiting subscriptions on a global and an IP level. This should be done by extending the existing `RateLimit` class as needed.

1. Add a configurable global limit on the total active subscriptions. Initial default of 10.
2. Add a configurable limit on the total active subscriptions per IP. Initial default of 1.
3. Add a TTL to subscriptions, i. e. automatically terminate a subscription after a configurable time period. Initial default of 5 minutes.
4. Make it possible to disable all of those limits if needed.


## Metric Capturing

Capture metrics for the following:

1. Log every call to `eth_subscribe` and `eth_unsubscribe`, as a total amount and broken down by IP.
2. The duration of active subscriptions.
3. The total amount of requests to the mirror node per subscription.
4. The amount of requests to the mirror node per subscription that have returned non-null data.

## Tests

The following test cases should be covered but additional tests would be welcome.

1. Connecting to the ws-server works.
2. Subscribing to the `logs` event with all possible filter combinations - no filters, by address, by topics, multiple addresses, etc..
3. Unsubscribing from an active subscription.
4. Receiving the correct log data after an async process generates logs for that match/don't match the subscription filters.
5. Multiple active subscriptions and each of them receives their appropriate log data.
6. Exceeding the global subscription limit.
7. Exceeding the IP subscription limit.
8. Unsubscribing due to automatic subscription termination.
9. E2E test using popular libraries (`ethers.js WebSocketProvider`) that include - connecting, subscribing, receiving data, unsubscribing

## Non-Functional Requirements

Users should be required to renew their subscription in the case of an error or if the subscription was closed from the relay side. If for some reason the relay is restarted it should not automatically try to restore all previous connections and subscriptions.

## Deployment

The ws-server process will run in the same docker container.
A feature flag should be added to specify whether the `server`, `ws-server` or both should be running.

## Answered Questions

1. How will we implement the `subscribe` and `unsubscribe` flow?
2. How will the relay poll the mirror node?
3. How will the relay send subscription results to users in real time?
4. What kind of limits will be implemented?

## Tasks (in suggested order):

#### Milestone 1

1. Finalize design document

#### Milestone 2

1. Create a separate `ws-server` package.
2. Implement library for websocket support in the server.
3. Extend current koa server logic.
4. Introduce `eth_subscribe` and `eth_unsubscribe` to both server and relay part.
5. Add logic to save all subsciption IDs.
6. Add logic to save addresses to which clients are subscribed.
7. Expand logic with topic filters.
8. Expand logic to work with multiple contracts.
9. Add scheduled job function for looping through all saved filters and returns result to it's corresponding socket with the respective subscription id.
10. Extend current rate limiter class to support websocket limitation.
11. Add logic to delete subsciption upon connection break or request.
12. Implement global subscription limits.
13. Implement IP based subscription limits.
14. Implement TTL to subscriptions.
15. Determine the reasonable default limits for ip based limits and global limits. This should be done after the connection logic is implemented so that we can measure the average resources used by a single connection.

#### Milestone 3 (use Mirror-Node GraphQL API)

1. Remove scheduled job, as this is going to be handled by the mirror-node graphql module.
2. Forward all requests for every corresponding subscription id to the mirror node and the response back to the requester.