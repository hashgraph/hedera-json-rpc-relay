# Subscription design

## Problems in current design

JSON-RPC Relay currently doesn't support subscription using websocket, which makes:

- pooling for event logs, new blocks and transactions very hard for developers

## Goal

1. Implement websocket subscription in the server
2. Introduce to new methods - `eth_subscribe` and `eth_unsubscribe`
3. Support subscription for event logs.

## Subscription Type

|   Subscription Type    |                                  Description                                   |           Support           |
| :--------------------: | :----------------------------------------------------------------------------: | :-------------------------: |
|          logs          |      Emits logs attached to a new block that match certain topic filters.      |       Yes, initially        |
|        newHeads        |               Emits new blocks that are added to the blockchain.               | No, maybe in future release |
| newPendingTransactions | Emits transaction hashes that are sent to the network and marked as `pending`. | No, maybe in future release |

### Logs

     The logs subscription type emits logs that match a specified topic filter and are included in newly added blocks.

#### Parameters

An object with the following fields:

- address (optional): [`string`] or [`array of strings`] Singular address or array of addresses. Only logs created from one of these addresses will be emitted.
- topics: an array of topic specifiers.
  - Each topic specifier is either null, a single string, or an array of strings.
  - For every non null topic, a log will be emitted when activity associated with that topic occurs.

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://testnet.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": ["logs", {"address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]}]}
```

#### Response

```json
{
  "jsonrpc": "2.0",
  "method": "eth_subscription",
  "params": {
    "subscription": "0x4a8a4c0517381924f9838102c5a4dcb7",
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

     The newHeads subscription type emits an event any time a new header (block) is added to the chain, including during a chain reorganization.

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://testnet.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 1, "method": "eth_subscribe", "params": ["newHeads"]}
```

#### Response

```json
{"jsonrpc":"2.0", "id":1, "result":"0x9ce59a13059e417087c02d3236a0b1cc"}

{
   "jsonrpc": "2.0",
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
   "subscription": "0x9ce59a13059e417087c02d3236a0b1cc"
   }
 }
```

### newPendingTransactions

     The newPendingTransactions subscription type subscribes to all pending transactions via WebSockets (regardless if you sent them or not), and returns their transaction hashes.

Returns the hash for all transactions that are added to the pending state (regardless if you sent them or not).

#### Request

```javascript
// initiate websocket stream first
wscat -c wss://testnet.hashio.io/api

// then call subscription
{"jsonrpc":"2.0","id": 2, "method": "eth_subscribe", "params": ["newPendingTransactions"]}
```

#### Response

```json
{"id":1,"result":"0xc3b33aa549fb9a60e95d21862596617c","jsonrpc":"2.0"}

{
    "jsonrpc":"2.0",
    "method":"eth_subscription",
    "params":{
        "subscription":"0xc3b33aa549fb9a60e95d21862596617c",
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

## Error Codes

| Error Codes |                                                       Error message                                                        |                                    Solution                                     |
| :---------: | :------------------------------------------------------------------------------------------------------------------------: | :-----------------------------------------------------------------------------: |
|    32600    | "The maximum batch size that can be sent over a websocket connection is 10. Please decrease the batch size and try again.” | Occurs when user attempts to send high-volume JSON-RPC traffic over Websockets. |

## Limits:

1. WebSockets in general are resource intensive. We could implement a throttling mechanism. Every live socket connection would also result in additional requests to the Mirror Node every n seconds. This means that we need to introduce a rate limiting feature, like 5 concurrent connections by IP.

## Tasks (in suggested order):

#### Milestone 1 (done)

1. Finalize design document

#### Milestone 2

1. Implement library for websocket support in the server.
2. Extend current koa server logic.
3. Introduce `eth_subscribe` and `eth_unsubscribe` to both server and relay part.
4. Add logic to save all subsciption IDs and it's corresponding filter to a cache.
5. Add scheduled job function for looping through all saved filters and returns result to it's corresponding socket with the respective subscription id.
6. Extend current ratelimiter class to support websocket limitation.
7. Add logic to delete subsciption upon connection break or request.

#### Milestone 3 (use Mirror-Node GraphQL API)

1. Remove scheduled job, as this is going to be handled by the mirror-node graphql module.
2. Forward all request for every coresponsing subscription id to the mirror node and the response back to the requester.
