# Configuration

The packages of the JSON RPC Relay support loading of configuration from an `.env` file or via the
environment.

## Default Values

The default configuration allows users to quickly get up and running without having to configure anything. This provides
ease of use at the trade-off of some insecure default configuration. Most configuration settings have appropriate
defaults and can be left unchanged. It is recommended to browse the properties below and adjust to your needs.

A few properties omit a default value as they relate to account information and Hedera environment details.
These properties are noted below and should be custom set per deployment.

- `CHAIN_ID`
- `HEDERA_NETWORK`
- `MIRROR_NODE_URL`
- `OPERATOR_ID_MAIN`
- `OPERATOR_KEY_MAIN`
- `SERVER_PORT`

## Server

The following table lists the available properties along with their default values for the [Server package](/packages/server/).
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name                          | Default        | Description                                                                                                                                  |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAIN_ID`                    | ""             | The network chain id. Local and previewnet envs should use `0x12a` (298). Previewnet, Testnet and Mainnet should use `0x129` (297), `0x128` (296) and `0x127` (295) respectively.                                   |
| `HBAR_RATE_LIMIT_DURATION`    | "60000"        | hbar budget limit duration. This creates a timestamp, which resets all limits, when it's reached. Default is to 60000 (1 minute).                                                                                   |
| `HBAR_RATE_LIMIT_TINYBAR`     | "5000_000_000" | total hbar budget in tinybars.                                                                                                                                                                                      |
| `HEDERA_NETWORK`              | ""             | Which network to connect to. Automatically populates the main node & mirror node endpoints. Can be `previewnet`, `testnet`, `mainnet` or a map of network IPs -> node accountIds e.g. `{"127.0.0.1:50211":"0.0.3"}` |
| `INPUT_SIZE_LIMIT`            | "1mb"          | The [koa-jsonrpc](https://github.com/Bitclimb/koa-jsonrpc) maximum size allowed for requests                                                                                                                        |
| `MAX_BLOCK_RANGE`             | ""             | The maximum block number greater than the mirror node's latest block to query for                                  
| `OPERATOR_ID_MAIN`            | ""             | Operator account ID used to pay for transactions. In `S.R.N` format, e.g. `0.0.1001`. |
| `OPERATOR_KEY_MAIN`           | ""             | Operator private key used to sign transactions in hex encoded DER format. This may be either an ED22519 private key or an ECDSA private key. The private key must be associated with/used to derive `OPERATOR_ID_MAIN`. |
| `RATE_LIMIT_DISABLED`         | ""             | Flag to disable IP based rate limiting.                                                                                                                                                                             |
| `REQUEST_ID_IS_OPTIONAL`      | ""    | Flag to set it the JSON RPC request id field in the body should be optional. Note, this breaks the API spec and is not advised and is provided for test purposes only where some wallets may be non compliant |  
| `SERVER_PORT`                 | "7546"         | The RPC server port number to listen for requests on. Currently a static value defaulting to 7546. See [#955](https://github.com/hashgraph/hedera-json-rpc-relay/issues/955)                                        |

## Relay

The following table lists the available properties along with their default values for the [Relay package](/packages/relay/).
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name                                  | Default       | Description                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------- |--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ALLOW_INVALID_HEX_RESPONSE`          | "true"        | Account for the benign 400 response with message 'data field invalid hexadecimal string' coming back from the mirror node when deploying a contract.
| `CACHE_MAX`                           | "1000"        | The maximum number (or size) of items that remain in the cache (assuming no TTL pruning or explicit deletions).                                                                                                                                                                                        |
| `CACHE_TTL`                           | "3_600_000"   | Max time to live in ms, for items before they are considered stale. Default is one hour in milliseconds                                                                                                                                                                                                |
| `CLIENT_TRANSPORT_SECURITY`           | "false"       | Flag to enable or disable TLS for both networks.                                                                                                                                                                                                                                                       |
| `CONTRACT_CALL_GAS_LIMIT`             | "15_000_000"  | Maximum gas limit applied to eth_call endpoint networks.                                                                                                                                                                                                                                               |
| `CONSENSUS_MAX_EXECUTION_TIME`        | "15000"       | Maximum time in ms the SDK will wait when submitting a transaction/query before throwing a TIMEOUT error.                                                                                                                                                                                              |
| `DEFAULT_RATE_LIMIT`                  | "200"         | default fallback rate limit, if no other is configured.                                                                                                                                                                                                                                                |
| `ETH_CALL_CACHE_TTL`                  | "200"         | Maximum time in ms to cache an eth_call response.                                                                                                                                                                                                                                                      |
| `ETH_BLOCK_NUMBER_CACHE_TTL_MS`       | "1000"        | Time in ms to cache response from mirror node                                                                                                                                                                                                                                                          |
| `ETH_GET_BALANCE_CACHE_TTL_MS`        | "1000"        | Time in ms to cache balance returned                                                                                                                                                                                                                                                                   |
| `ETH_GET_BLOCK_BY_RESULTS_BATCH_SIZE` | "25"        | The number of contract results to request from the Mirror Node per batch durin an eth_getBlockByHash or eth_getBlockByNumber call                                                                                                                                                                      |
| `ETH_CALL_DEFAULT_TO_CONSENSUS_NODE ` | "false"       | Flag to set if eth_call logic should first query the mirror node.                                                                                                                                                                                                                                      
| `ETH_GET_LOGS_BLOCK_RANGE_LIMIT`      | "1000"        | The maximum block number range to consider during an eth_getLogs call.                                                                                                                                                                                                                                 
| `ETH_GET_TRANSACTION_COUNT_MAX_BLOCK_RANGE`      | "1000"   | The maximum number of transactions to return when running eth_getBlockByHash or eth_getBlockByNumber with transaction objects set to true call.                                                                                                                                                        
| `FEE_HISTORY_MAX_RESULTS`             | "10"          | The maximum number of results to returns as part of `eth_feeHistory`.                                                                                                                                                                                                                                  |
| `ETH_FEE_HISTORY_FIXED`               | "true"        | Flag to set if eth_feeHistory should return a fixed fee for the set of results.                                                                                                                                                                                                                        |
| `GAS_PRICE_TINY_BAR_BUFFER`           | "10000000000" | The additional buffer range to allow during a relay precheck of gas price. This supports slight fluctuations in network gasprice calculations.                                                                                                                                                         |
| `HAPI_CLIENT_DURATION_RESET`          | "3600000"     | Time until client reinitialization. (ms)                                                                                                                                                                                                                                                               |
| `HAPI_CLIENT_ERROR_RESET`             | [50]          | Array of status codes, which when encountered will trigger a reinitialization. Status codes are availble [here](https://github.com/hashgraph/hedera-protobufs/blob/main/services/response_code.proto).                                                                                                 |
| `HAPI_CLIENT_TRANSACTION_RESET`       | "50"          | Number of transaction executions, until client reinitialization.                                                                                                                                                                                                                                       |
| `LIMIT_DURATION`                      | "60000"       | The maximum duration in ms applied to IP-method based rate limits.                                                                                                                                                                                                                                     |
| `MIRROR_NODE_CONTRACT_RESULTS_PG_MAX` | "25"          | The maximum number of pages to be requested for contract results from the mirror node.                                                                                                                                                                                                                 |
| `MIRROR_NODE_LIMIT_PARAM`             | "100"         | The mirror node custom limit value to be set on GET requests. This optimizes the flow to reduce the number of calls made to the mirror node by setting a limit larger than it's default limit.                                                                                                         |
| `MIRROR_NODE_RETRIES`                 | "3"           | The maximum number of retries on a GET request to the mirror node when an acceptable error code is returned.                                                                                                                                                                                           |
| `MIRROR_NODE_RETRY_CODES`             | "[404]"       | The acceptable error codes to retry on a request to the mirror node. If more than 1 error is defined value should be like ie: [400,404,500]                                                                                                                                                            |
| `MIRROR_NODE_RETRY_DELAY`             | "250"         | The delay in ms between retry requests.                                                                                                                                                                                                                                                                |
| `MIRROR_NODE_RETRIES_DEVMODE`         | "5"           | The maximum number of retries on a GET request to the mirror node when an acceptable error code is returned in dev mode.                                                                                                                                                                               |
| `MIRROR_NODE_RETRY_DELAY_DEVMODE`     | "200"         | The delay in ms between retry requests in dev mode.                                                                                                                                                                                                                                                    |
| `MIRROR_NODE_URL`                     | ""            | The Mirror Node API endpoint. Official endpoints are Previewnet (https://previewnet.mirrornode.hedera.com), Testnet (https://testnet.mirrornode.hedera.com), Mainnet (https://mainnet-public.mirrornode.hedera.com). See [Mirror Node REST API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api) |
| `MIRROR_NODE_URL_HEADER_X_API_KEY`    | ""            | Authentication for a `MIRROR_NODE_URL` that requires authentication via the `x-api-key` header.                                                                                                                                                                                                        |
| `MIRROR_NODE_GET_CONTRACT_RESULTS_RETRIES`    | "3"            | Maximun amount of retries to repeat on `GetContractResults` `contracts/results/)` requests when fetching contract results after eth_sendRawTransaction submission. *Note that this in addition and multiplies the configured Axios retries values.                                                     |
| `SDK_REQUEST_TIMEOUT`                 | "10000"       | The complete timeout for running the SDK `execute()` method. This controls the GRPC channel timeout config when querying with network nodes.                                                                                                                                                           |
| `CONTRACT_QUERY_TIMEOUT_RETRIES`      | "3"           | Maximum retries for failed contract call query with timeout exceeded error                                                                                                                                                                                                                             |
| `TIER_1_RATE_LIMIT`                   | "100"         | Maximum restrictive request count limit used for expensive endpoints rate limiting.                                                                                                                                                                                                                    |
| `TIER_2_RATE_LIMIT`                   | "800"         | Maximum moderate request count limit used for non expensive endpoints.                                                                                                                                                                                                                                 |
| `TIER_3_RATE_LIMIT`                   | "1600"        | Maximum relaxed request count limit used for static return endpoints.                                                                                                                                                                                                                                  |
| `TX_DEFAULT_GAS`                      | "400000"      | Default gas for transactions that do not specify gas.                                                                                                                                                                                                                                                  |
| `FILE_APPEND_MAX_CHUNKS`                      | "20"      | Default maximum number of chunks for the `HAPI` `FileAppendTransaction` to use during contract creation submissions to consensus nodes as part of `eth_sendRawTransactionsaction`.                                                                                                                     |

## WS-Server

The following table lists the available properties along with their default values for the [Ws-server package](/packages/ws-server/).
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name                            | Default  | Description                                                                             |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `SUBSCRIPTIONS_ENABLED`         | "false"  | If enabled eth_subscribe will be enabled using WebSockets.                              |
| `WS_MAX_CONNECTION_TTL`         | "300000" | Time in ms that the web socket connection is allowed to stay open, currently 5 minutes. |
| `WS_CONNECTION_LIMIT`           | "10"     | Maximum amount of concurrent web socket connections allowed.                            |
| `WS_POLLING_INTERVAL`           | "500"    | Time in ms in between each poll to mirror node while there are subscriptions.           |
| `WEB_SOCKET_PORT`               | "8546"   | Port for the web socket connections                                                     |
| `WEB_SOCKET_HTTP_PORT`          | "8547"   | Port for standard http server, used for metrics and health status endpoints             |
| `WS_SUBSCRIPTION_LIMIT`         | "10"     | Maximum amount of subscriptions per single connection                                   |
| `WS_CONNECTION_LIMIT_PER_IP`    | "10"     | Maximum amount of connections from a single IP address                                  |
| `WS_MULTIPLE_ADDRESSES_ENABLED` | "false"  | If enabled eth_subscribe will allow subscription to multiple contract address.          |
| `WS_CACHE_TTL`                  | "20000"  | The time to live for cached entries.                                                    |

## Sample for connecting to Hedera Environments

**Hedera Mainnet**

```.env
HEDERA_NETWORK=mainnet
OPERATOR_ID_MAIN=<...redacted...>
OPERATOR_KEY_MAIN=<...redacted...>
CHAIN_ID=0x127
MIRROR_NODE_URL=https://mainnet-public.mirrornode.hedera.com/
```

See [`.env.mainnet.sample`](./examples/.env.mainnet.sample).

**Hedera Testnet**

```.env
HEDERA_NETWORK=testnet
OPERATOR_ID_MAIN=<...redacted...>
OPERATOR_KEY_MAIN=<...redacted...>
CHAIN_ID=0x128
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/
```

See [`.env.testnet.sample`](./examples/.env.testnet.sample).

**Hedera Previewnet**

```.env
HEDERA_NETWORK=previewnet
OPERATOR_ID_MAIN=<...redacted...>
OPERATOR_KEY_MAIN=<...redacted...>
CHAIN_ID=0x129
MIRROR_NODE_URL=https://previewnet.mirrornode.hedera.com/
```

See [`.env.previewnet.sample`](./examples/.env.previewnet.sample).

- **_NOTE:_** Replace the redacted operator ID and keys with your own.
- **_NOTE 2:_** Default values for all other keys are sufficient, no need to set them.
- **_NOTE 3:_** The above files have been provided for your convenience within the examples directory of this repo. For example, for the Hedera Testnet configuration, run this command in the root directory of this project: `cp ./docs/examples/.env.testnet.sample ./.env`

## Testing

The following table lists the available properties along with their default values for the tests utilized in the [Server](/packages/server/) and [Relay](/packages/relay/) packages.
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name             | Default | Description                                                  |
| ---------------- | ------- | ------------------------------------------------------------ |
| `LOCAL_NODE`     | ""      | Flag if relay is hosted in the Hedera local node setup.      |
| `E2E_RELAY_HOST` | ""      | Remote relay url to point to.                                |
| `DEV_MODE`       | "false" | Flag if relay should operate in developer optimization mode. |
| `TEST_WS_SERVER` | "false" | Flag config for enable or disable the WS server tests.       |

For test context additional fields need to be set. The following example showcases a `hedera-local-node` instance (where values match those noted on [Local Node Network Variables](https://github.com/hashgraph/hedera-local-node#network-variables)

```.env
HEDERA_NETWORK={"127.0.0.1:50211":"0.0.3"}
OPERATOR_ID_MAIN=0.0.2
OPERATOR_KEY_MAIN=302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137
CHAIN_ID=0x12a
MIRROR_NODE_URL=http://127.0.0.1:5551
LOCAL_NODE=true
SERVER_PORT=7546
E2E_RELAY_HOST=http://127.0.0.1:7546
DEFAULT_RATE_LIMIT: 200
TIER_1_RATE_LIMIT: 100
TIER_2_RATE_LIMIT: 800
TIER_3_RATE_LIMIT: 1600
LIMIT_DURATION = 60000
HBAR_RATE_LIMIT_TINYBAR = 6000000000
HBAR_RATE_LIMIT_DURATION = 60000
RATE_LIMIT_DISABLED = false
DEV_MODE = false
GAS_PRICE_TINY_BAR_BUFFER = 10000000000
MIRROR_NODE_RETRIES = 3
MIRROR_NODE_RETRY_DELAY = 250
MIRROR_NODE_RETRIES_DEVMODE = 5
MIRROR_NODE_RETRY_DELAY_DEVMODE = 200
MIRROR_NODE_LIMIT_PARAM = 100
INPUT_SIZE_LIMIT = 1
ETH_CALL_CACHE_TTL = 200
CONSENSUS_MAX_EXECUTION_TIME = 10000
SDK_REQUEST_TIMEOUT = 10000
CONTRACT_QUERY_TIMEOUT_RETRIES = 3
CONNECTION_LIMIT = 10
CLIENT_TRANSACTION_RESET= 400000
CLIENT_DURATION_RESET= 21600
CLIENT_ERROR_RESET= 100
MAX_CHUNKS=20
```

> **_NOTE:_** Acceptance tests can be pointed at a remote locations (previewnet and testnet and custom environments). In this case configuration will require details for remote consensus node gRPC endpoints [previewnet / testnet](https://docs.hedera.com/hedera/networks/testnet/testnet-nodes) / [mainnet](https://docs.hedera.com/hedera/networks/mainnet/mainnet-nodes) and [Mirror Node REST API endpoints](https://docs.hedera.com/hedera/sdks-and-apis/rest-api), be sure to configure `HEDERA_NETWORK` and `MIRROR_NODE_URL` appropriately to point away from your local host and to valid deployed services. When pointing to previewnet and testnet, account Ids (`OPERATOR_ID_MAIN`) and private keys (`OPERATOR_KEY_MAIN`) for previewnet and tests may be obtained from the [Hedera Portal](http://portal.hedera.com).

> **_NOTE 2:_**: Read more about `DEV_MODE` [here](./dev-mode.md)
