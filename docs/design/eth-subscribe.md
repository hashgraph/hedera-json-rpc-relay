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

- address (optional): [`string`] or [`array of strings`] Singular address or array of addresses. Only logs created from one of these addresses will be emitted.
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

### newHeads

     The newHeads subscription type emits an event any time a new header (block) is added to the chain, including during a chain reorganization.

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://<env>.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": ["newHeads"]}
```

#### Response

This response is sent whenever new data is available.

```javascript
{
   "method": "eth_subscription",
   "params": {
     "result": {
       "difficulty": "0x15d9223a23aa",
       "extraData": "0xd983010305844765746887676f312e342e328777696e646f7773",
       "gasLimit": "0x47e7c4",
       "gasUsed": "0x38658",
       "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
       "miner": "0xf8b483dba2c3b7176a3da549ad41a48bb3121069",
       "nonce": "0x084149998194cc5f",
       "number": "0x1348c9",
       "parentHash": "0x7736fab79e05dc611604d22470dadad26f56fe494421b5b333de816ce1f25701",
       "receiptRoot": "0x2fab35823ad00c7bb388595cb46652fe7886e00660a01e867824d3dceb1c8d36",
       "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
       "stateRoot": "0xb3346685172db67de536d8765c43c31009d0eb3bd9c501c9be3229203f15f378",
       "timestamp": "0x56ffeff8",
       "transactionsRoot": "0x0167ffa60e3ebc0b080cdb95f7c0087dd6c0e61413140e39d94d3468d7c9689f"
     },
   "subscription": SUBSCRIPTION_ID
   }
 }
```

### newPendingTransactions

     The newPendingTransactions subscription type subscribes to all pending transactions via WebSockets (regardless if you sent them or not), and returns their transaction hashes.

Returns the hash for all transactions that are added to the pending state (regardless if you sent them or not).

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://<env>.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 2, "method": "eth_subscribe", "params": ["newPendingTransactions"]}
```

#### Response

This response is sent whenever new data is available.

```javascript
{"id":1,"result":"0xc3b33aa549fb9a60e95d21862596617c","jsonrpc":"2.0"}

{
    "jsonrpc":"2.0",
    "method":"eth_subscription",
    "params":{
        "subscription": SUBSCRIPTION_ID,
        "result":"0xd6fdc5cc41a9959e922f30cb772a9aef46f4daea279307bc5f7024edc4ccd7fa"
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

// unsubscribes the subscriptionsubscription.unsubscribe(function(error, success){
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

## Non-Functional Requirements

WebSockets in general are resource intensive. We could implement a throttling mechanism. Every live socket connection would also result in additional requests to the Mirror Node every n seconds. This means that we need to introduce a rate limiting feature, like 5 concurrent connections by IP.

1. Implement an IP based limit for maximum concurrent connections.
2. Implement a global limit for maximum concurrent connections.
3. Explore the possibility of adding a TTL limit for every connection.
4. Explore the option to add a limit for the total subscribed time per IP ( `sum(connection * subscribed_time)` ). There could theoretically be a way to charge users to increase this limit, for example through via a smart contract. Alternatively users could be encouraged to run their own instances of the relay.
5. Users should be required to renew their subscription in the case of an error. If for some reason the relay is restarted it should not automatically try to restore all previous connections and subscriptions.

## Open Questions

1. How will we limit connections and subscriptions?
2. Is it reasonable to add a TTL timer to subscriptions?

## Answered Questions

1. How will we implement the `subscribe` and `unsubscribe` flow?
2. How will the relay poll the mirror node?
3. How will the relay send subscription results to users in real time?

## Tasks (in suggested order):

#### Milestone 1

1. Finalize design document

#### Milestone 2

1. Implement library for websocket support in the server.
2. Extend current koa server logic.
3. Introduce `eth_subscribe` and `eth_unsubscribe` to both server and relay part.
4. Add logic to save all subsciption IDs.
5. Add logic to save addresses to which clients are subscribed.
6. Expand logic with topic filters.
7. Expand logic to work with multiple contracts.
8. Add scheduled job function for looping through all saved filters and returns result to it's corresponding socket with the respective subscription id.
9. Extend current rate limiter class to support websocket limitation.
10. Add logic to delete subsciption upon connection break or request.
11. Determine the reasonable default limits for ip based limits and global limits. This should be done after the connection logic is implemented so that we can measure the average resources used by a single connection.

#### Milestone 3 (use Mirror-Node GraphQL API)

1. Remove scheduled job, as this is going to be handled by the mirror-node graphql module.
2. Forward all requests for every corresponding subscription id to the mirror node and the response back to the requester.