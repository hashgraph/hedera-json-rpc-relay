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

| Name                          | Default       | Description                                                   |
|-------------------------------|---------------|---------------------------------------------------------------|
| `CHAIN_ID`                    | ""            | The network chain id. Local and previewnet envs should use `0x12a` (298). Previewnet, Testnet and Mainnet should use `0x129` (297), `0x128` (296) and `0x127` (295) respectively. |
| `HBAR_RATE_LIMIT_DURATION`    | "60000"       | hbar budget limit duration. This creates a timestamp, which resets all limits, when it's reached. Default is to 60000 (1 minute).   |
| `HBAR_RATE_LIMIT_TINYBAR`    | "5000_000_000" | total hbar budget in tinybars.   |
| `HEDERA_NETWORK`              | ""                         | Which network to connect to. Automatically populates the main node & mirror node endpoints. Can be `MAINNET`, `PREVIEWNET`, `TESTNET` or a map of network IPs -> node accountIds e.g. `{"127.0.0.1:50211":"0.0.3"}`   |
| `INPUT_SIZE_LIMIT`            | "1mb"         | The [koa-jsonrpc](https://github.com/Bitclimb/koa-jsonrpc) maximum size allowed for requests   |
| `OPERATOR_ID_MAIN`            | ""            | Operator account ID used to pay for transactions.   |
| `OPERATOR_KEY_MAIN`           | ""            | Operator private key used to sign transactions in hex encoded DER format.  |
| `RATE_LIMIT_DISABLED`         | ""            | Flag to disable IP based rate limiting.   |
| `SERVER_PORT`                 | "7546"        | The RPC server port number to listen for requests on. Currently a static value defaulting to 7546. See [#955](https://github.com/hashgraph/hedera-json-rpc-relay/issues/955)  |


## Relay

The following table lists the available properties along with their default values for the [Relay package](/packages/relay/). 
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name                                  | Default       | Description                                                                                                                                                                                                                                                                                            |
|---------------------------------------|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CLIENT_TRANSPORT_SECURITY`           | "false"       | Flag to enable or disable TLS for both networks.                                                                                                                                                                                                                                                       |
| `CONSENSUS_MAX_EXECUTION_TIME`        | "15000"       | Maximum time in ms the SDK will wait when submitting a transaction/query before throwing a TIMEOUT error.                                                                                                                                                                                              |
| `DEFAULT_RATE_LIMIT`                  | "200"         | default fallback rate limit, if no other is configured.                                                                                                                                                                                                                                                |
| `ETH_CALL_CACHE_TTL`                  | "200"         | Maximum time in ms to cache an eth_call response.                                                                                                                                                                                                                                                      |
| `ETH_BLOCK_NUMBER_CACHE_TTL_MS`       | "1000"        | Time in ms to cache response from mirror node                                                                                                                                                                                                                                                          |
| `ETH_GET_BALANCE_CACHE_TTL_MS`        | "1000"        | Time in ms to cache balance returned                                                                                                                                                                                                                                                               |
| `ETH_CALL_DEFAULT_TO_CONSENSUS_NODE ` | "false"       | Flag to set if eth_call logic should first query the mirror node.                                                                                                                                                                                                                                      |
| `ETH_GET_LOGS_BLOCK_RANGE_LIMIT`      | "1000"        | The maximum block number range to consider during an eth_getLogs call.                                                                                                                                                                                                                                 |
| `FEE_HISTORY_MAX_RESULTS`             | "10"          | The maximum number of results to returns as part of `eth_feeHistory`.                                                                                                                                                                                                                                  |
| `GAS_PRICE_TINY_BAR_BUFFER`           | "10000000000" | The additional buffer range to allow during a relay precheck of gas price. This supports slight fluctuations in network gasprice calculations.                                                                                                                                                         |
| `LIMIT_DURATION`                      | "60000"       | The maximum duration in ms applied to IP-method based rate limits.                                                                                                                                                                                                                                     |
| `MIRROR_NODE_LIMIT_PARAM`             | "100"         | The mirror node custom limit value to be set on GET requests. This optimizes the flow to reduce the number of calls made to the mirror node by setting a limit larger than it's default limit.                                                                                                         |
| `MIRROR_NODE_RETRIES`                 | "3"           | The maximum number of retries on a GET request to the mirror node when an acceptable error code is returned.                                                                                                                                                                                           |
| `MIRROR_NODE_RETRY_DELAY`             | "250"         | The dealy in ms between retry requests.   |
| `MIRROR_NODE_URL`                     | ""            | The Mirror Node API endpoint. Official endpoints are Previewnet (https://previewnet.mirrornode.hedera.com), Testnet (https://testnet.mirrornode.hedera.com), Mainnet (https://mainnet-public.mirrornode.hedera.com). See [Mirror Node REST API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api) |
| `SDK_REQUEST_TIMEOUT`                 | "10000"       | The complete timeout for running the SDK `execute()` method. This controls the GRPC channel timeout config when querying with network nodes.                                                                                                                                                           |
| `TIER_1_RATE_LIMIT`                   | "100"         | Maximum restrictive request count limit used for expensive endpoints rate limiting.                                                                                                                                                                                                                    |
| `TIER_2_RATE_LIMIT`                   | "800"         | Maximum moderate request count limit used for non expensive endpoints.                                                                                                                                                                                                                                 |
| `TIER_3_RATE_LIMIT`                   | "1600"        | Maximum relaxed request count limit used for static return endpoints.                                                                                                                                                                                                                                  |


## Testing

The following table lists the available properties along with their default values for the tests utilized in the [Server](/packages/server/) and [Relay](/packages/relay/) packages. 
Unless you need to set a non-default value, it is recommended to only populate overridden properties in the custom `.env`.

| Name                          | Default       | Description                                                   |
|-------------------------------|---------------|---------------------------------------------------------|
| `LOCAL_NODE`      | ""        | Flag if relay is hosted in the Hedera local node setup.   |
| `E2E_RELAY_HOST`  | ""        | Remote relay url to point to.   |
| `DEV_MODE`        | "false"   | Flag if relay should operate in developer optimization mode.   |

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
MIRROR_NODE_LIMIT_PARAM = 100
INPUT_SIZE_LIMIT = 1
ETH_CALL_CACHE_TTL = 200
CONSENSUS_MAX_EXECUTION_TIME = 10000
SDK_REQUEST_TIMEOUT = 10000
CONNECTION_LIMIT = 10
````


> **_NOTE:_** Acceptance tests can be pointed at a remote locations (previewnet and testnet and custom environments). In this case configuration will require details for remote consensus node gRPC endpoints [previewnet / testnet](https://docs.hedera.com/hedera/networks/testnet/testnet-nodes) / [mainnet](https://docs.hedera.com/hedera/networks/mainnet/mainnet-nodes) and [Mirror Node REST API endpoints](https://docs.hedera.com/hedera/sdks-and-apis/rest-api), be sure to configure `HEDERA_NETWORK` and `MIRROR_NODE_URL` appropriately to point away from your local host and to valid deployed services. When pointing to previewnet and testnet, account Ids (`OPERATOR_ID_MAIN`) and private keys (`OPERATOR_KEY_MAIN`) for previewnet and tests may be obtained from the [Hedera Portal](http://portal.hedera.com).

> **_NOTE 2:_**: Read more about `DEV_MODE` [here](./dev-mode.md)
