
# K6 Performance Tests

This module covers the [k6](https://k6.io/) based performance tests for the Hedera JSON RPC Relay.

## Install k6

The k6 test engine is needed to run the tests. Please follow
the [official documentation](https://k6.io/docs/getting-started/installation/) to install k6.

## Run The Tests

The tests are organized in files matching their method.
You can run the tests of an API as a test suite, you can also run tests one at a time.

### Test Suite

To run a test suite, use the following command when pointing to testnet.

```shell
DEFAULT_DURATION=1s \
DEFAULT_VUS=1 \
MIRROR_BASE_URL=https://testnet.mirrornode.hedera.com \
RELAY_BASE_URL=https://testnet.hashio.io/api \
DEFAULT_LIMIT=100 k6 run src/scenarios/apis.js
```

For non domain specific parameters like:

- DEFAULT_DURATION
- DEFAULT_VUS
- MIRROR_BASE_URL
- RELAY_BASE_URL
- DEFAULT_LIMIT
- DEFAULT_CONTRACT_ADDRESS

The value can be set via environment variables. If no value is set, then a sane default will be used.

For domain specific parameters the following rule is used:
When the value of a parameter is set with an environment variable, the value will be used, but if no value is set for a
particular parameter, then its value will be found by querying either the rest or rosetta APIs.

#### Full Suite Test

To run all tests, just do

```shell
k6 run src/sceanrios/apis.js
```

The test suite will run the tests sequentially with a configurable graceful stop time in between, so they don't
interfere with each other.

Once the tests complete, `k6` will show a summary report.

```
          /\      |‾‾| /‾‾/   /‾‾/
     /\  /  \     |  |/  /   /  /
    /  \/    \    |     (   /   ‾‾\
   /          \   |  |\  \ |  (‾)  |
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: /mnt/src/json-rpc-relay/apis.js
     output: -

  scenarios: (100.00%) 39 scenarios, 1 max VUs, 4m0s max duration (incl. graceful stop):
           * eth_accounts: 1 looping VUs for 1s (exec: run, gracefulStop: 5s)
           * eth_blockNumber: 1 looping VUs for 1s (exec: run, startTime: 6s, gracefulStop: 5s)
           * eth_call: 1 looping VUs for 1s (exec: run, startTime: 12s, gracefulStop: 5s)
           * eth_chainId: 1 looping VUs for 1s (exec: run, startTime: 18s, gracefulStop: 5s)
           * eth_coinbase: 1 looping VUs for 1s (exec: run, startTime: 24s, gracefulStop: 5s)
           * eth_estimateGas: 1 looping VUs for 1s (exec: run, startTime: 30s, gracefulStop: 5s)
           * eth_feeHistory: 1 looping VUs for 1s (exec: run, startTime: 36s, gracefulStop: 5s)
           * eth_gasPrice: 1 looping VUs for 1s (exec: run, startTime: 42s, gracefulStop: 5s)
           * eth_getBalance: 1 looping VUs for 1s (exec: run, startTime: 48s, gracefulStop: 5s)
           * eth_getBlockByHash: 1 looping VUs for 1s (exec: run, startTime: 54s, gracefulStop: 5s)
           * eth_getBlockByNumber: 1 looping VUs for 1s (exec: run, startTime: 1m0s, gracefulStop: 5s)
           * eth_getBlockTransactionCountByHash: 1 looping VUs for 1s (exec: run, startTime: 1m6s, gracefulStop: 5s)
           * eth_getBlockTransactionCountByNumber: 1 looping VUs for 1s (exec: run, startTime: 1m12s, gracefulStop: 5s)
           * eth_getCode: 1 looping VUs for 1s (exec: run, startTime: 1m18s, gracefulStop: 5s)
           * eth_getLogs: 1 looping VUs for 1s (exec: run, startTime: 1m24s, gracefulStop: 5s)
           * eth_getStorageAt: 1 looping VUs for 1s (exec: run, startTime: 1m30s, gracefulStop: 5s)
           * eth_getTransactionByBlockHashAndIndex: 1 looping VUs for 1s (exec: run, startTime: 1m36s, gracefulStop: 5s)
           * eth_getTransactionByBlockNumberAndIndex: 1 looping VUs for 1s (exec: run, startTime: 1m42s, gracefulStop: 5s)
           * eth_getTransactionByHash: 1 looping VUs for 1s (exec: run, startTime: 1m48s, gracefulStop: 5s)
           * eth_getTransactionCount: 1 looping VUs for 1s (exec: run, startTime: 1m54s, gracefulStop: 5s)
           * eth_getTransactionReceipt: 1 looping VUs for 1s (exec: run, startTime: 2m0s, gracefulStop: 5s)
           * eth_getUncleByBlockHashAndIndex: 1 looping VUs for 1s (exec: run, startTime: 2m6s, gracefulStop: 5s)
           * eth_getUncleByBlockNumberAndIndex: 1 looping VUs for 1s (exec: run, startTime: 2m12s, gracefulStop: 5s)
           * eth_getUncleCountByBlockHash: 1 looping VUs for 1s (exec: run, startTime: 2m18s, gracefulStop: 5s)
           * eth_getUncleCountByBlockNumber: 1 looping VUs for 1s (exec: run, startTime: 2m24s, gracefulStop: 5s)
           * eth_getWork: 1 looping VUs for 1s (exec: run, startTime: 2m30s, gracefulStop: 5s)
           * eth_hashrate: 1 looping VUs for 1s (exec: run, startTime: 2m36s, gracefulStop: 5s)
           * eth_mining: 1 looping VUs for 1s (exec: run, startTime: 2m42s, gracefulStop: 5s)
           * eth_protocolVersion: 1 looping VUs for 1s (exec: run, startTime: 2m48s, gracefulStop: 5s)
           * eth_sendRawTransaction: 1 looping VUs for 1s (exec: run, startTime: 2m54s, gracefulStop: 5s)
           * eth_sendTransaction: 1 looping VUs for 1s (exec: run, startTime: 3m0s, gracefulStop: 5s)
           * eth_sign: 1 looping VUs for 1s (exec: run, startTime: 3m6s, gracefulStop: 5s)
           * eth_signTransaction: 1 looping VUs for 1s (exec: run, startTime: 3m12s, gracefulStop: 5s)
           * eth_submitHashrate: 1 looping VUs for 1s (exec: run, startTime: 3m18s, gracefulStop: 5s)
           * eth_submitWork: 1 looping VUs for 1s (exec: run, startTime: 3m24s, gracefulStop: 5s)
           * eth_syncing: 1 looping VUs for 1s (exec: run, startTime: 3m30s, gracefulStop: 5s)
           * net_listening: 1 looping VUs for 1s (exec: run, startTime: 3m42s, gracefulStop: 5s)
           * web3_clientVersion: 1 looping VUs for 1s (exec: run, startTime: 3m48s, gracefulStop: 5s)
           * web3_client_version: 1 looping VUs for 1s (exec: run, startTime: 3m54s, gracefulStop: 5s)


running (4m00.3s), 0/1 VUs, 575 complete and 26 interrupted iterations
eth_accounts                   ✓ [ 100% ] 1 VUs  1s
eth_blockNumber                ✓ [ 100% ] 1 VUs  1s
eth_call                       ✓ [ 100% ] 1 VUs  1s
eth_chainId                    ✓ [ 100% ] 1 VUs  1s
eth_coinbase                   ✓ [ 100% ] 1 VUs  1s
eth_estimateGas                ✓ [ 100% ] 1 VUs  1s
eth_feeHistory                 ✓ [ 100% ] 1 VUs  1s
eth_gasPrice                   ✓ [ 100% ] 1 VUs  1s
eth_getBalance                 ✓ [ 100% ] 1 VUs  1s
eth_getBlockByHash             ✓ [ 100% ] 1 VUs  1s
eth_getBlockByNumber           ✓ [ 100% ] 1 VUs  1s
eth_getBlockTransactionCoun... ✓ [ 100% ] 1 VUs  1s
eth_getBlockTransactionCoun... ✓ [ 100% ] 1 VUs  1s
eth_getCode                    ✓ [ 100% ] 1 VUs  1s
eth_getLogs                    ✓ [ 100% ] 1 VUs  1s
eth_getStorageAt               ✓ [ 100% ] 1 VUs  1s
eth_getTransactionByBlockHa... ✓ [ 100% ] 1 VUs  1s
eth_getTransactionByBlockNu... ✓ [ 100% ] 1 VUs  1s
eth_getTransactionByHash       ✓ [ 100% ] 1 VUs  1s
eth_getTransactionCount        ✓ [ 100% ] 1 VUs  1s
eth_getTransactionReceipt      ✓ [ 100% ] 1 VUs  1s
eth_getUncleByBlockHashAndI... ✓ [ 100% ] 1 VUs  1s
eth_getUncleByBlockNumberAn... ✓ [ 100% ] 1 VUs  1s
eth_getUncleCountByBlockHash   ✓ [ 100% ] 1 VUs  1s
eth_getUncleCountByBlockNumber ✓ [ 100% ] 1 VUs  1s
eth_getWork                    ✓ [ 100% ] 1 VUs  1s
eth_hashrate                   ✓ [ 100% ] 1 VUs  1s
eth_mining                     ✓ [ 100% ] 1 VUs  1s
eth_protocolVersion            ✓ [ 100% ] 1 VUs  1s
eth_sendRawTransaction         ✓ [ 100% ] 1 VUs  1s
eth_sendTransaction            ✓ [ 100% ] 1 VUs  1s
eth_sign                       ✓ [ 100% ] 1 VUs  1s
eth_signTransaction            ✓ [ 100% ] 1 VUs  1s
eth_submitHashrate             ✓ [ 100% ] 1 VUs  1s
eth_submitWork                 ✓ [ 100% ] 1 VUs  1s
eth_syncing                    ✓ [ 100% ] 1 VUs  1s
net_listening                  ✓ [ 100% ] 1 VUs  1s
web3_clientVersion             ✓ [ 100% ] 1 VUs  1s
web3_client_version            ✓ [ 100% ] 1 VUs  1s
     ✓ eth_accounts
     ✓ eth_blockNumber
     ✓ eth_call
     ✓ eth_chainId
     ✓ eth_coinbase
     ✓ eth_estimateGas
     ✓ eth_feeHistory
     ✓ eth_gasPrice
     ✓ eth_getBalance
     ✓ eth_getBlockByNumber
     ✓ eth_getBlockTransactionCountByHash
     ✓ eth_getBlockTransactionCountByNumber
     ✓ eth_getCode
     ✓ eth_getLogs
     ✓ eth_getTransactionByBlockHashAndIndex
     ✓ eth_getTransactionByBlockNumberAndIndex
     ✓ eth_getTransactionByHash
     ✓ eth_getTransactionCount
     ✓ eth_getTransactionReceipt
     ✓ eth_getUncleByBlockHashAndIndex
     ✓ eth_getUncleByBlockNumberAndIndex
     ✓ eth_getUncleCountByBlockHash
     ✓ eth_getUncleCountByBlockNumber
     ✓ eth_getWork
     ✓ eth_hashrate
     ✓ eth_mining
     ✓ eth_protocolVersion
     ✓ eth_sendRawTransaction
     ✓ eth_sendTransaction
     ✓ eth_sign
     ✓ eth_signTransaction
     ✓ eth_submitHashrate
     ✓ eth_submitWork
     ✓ eth_syncing
     ✓ net_listening
     ✓ web3_clientVersion

     checks..........................................................................: 100.00% ✓ 572      ✗ 0
     ✓ { scenario:eth_accounts }.....................................................: 100.00% ✓ 3        ✗ 0
     ✓ { scenario:eth_blockNumber }..................................................: 100.00% ✓ 11       ✗ 0
     ✓ { scenario:eth_call }.........................................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_chainId }......................................................: 100.00% ✓ 16       ✗ 0
     ✓ { scenario:eth_coinbase }.....................................................: 100.00% ✓ 100      ✗ 0
     ✓ { scenario:eth_estimateGas }..................................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_feeHistory }...................................................: 100.00% ✓ 5        ✗ 0
     ✓ { scenario:eth_gasPrice }.....................................................: 100.00% ✓ 30       ✗ 0
     ✓ { scenario:eth_getBalance }...................................................: 100.00% ✓ 3        ✗ 0
     ✓ { scenario:eth_getBlockByHash }...............................................: NaN%    ✓ 0        ✗ 0
     ✓ { scenario:eth_getBlockByNumber }.............................................: 100.00% ✓ 6        ✗ 0
     ✓ { scenario:eth_getBlockTransactionCountByHash }...............................: 100.00% ✓ 1        ✗ 0
     ✓ { scenario:eth_getBlockTransactionCountByNumber }.............................: 100.00% ✓ 6        ✗ 0
     ✓ { scenario:eth_getCode }......................................................: 100.00% ✓ 4        ✗ 0
     ✓ { scenario:eth_getLogs }......................................................: 100.00% ✓ 2        ✗ 0
     ✓ { scenario:eth_getStorageAt }.................................................: NaN%    ✓ 0        ✗ 0
     ✓ { scenario:eth_getTransactionByBlockHashAndIndex }............................: 100.00% ✓ 11       ✗ 0
     ✓ { scenario:eth_getTransactionByBlockNumberAndIndex }..........................: 100.00% ✓ 6        ✗ 0
     ✓ { scenario:eth_getTransactionByHash }.........................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_getTransactionCount }..........................................: NaN%    ✓ 0        ✗ 0
     ✓ { scenario:eth_getTransactionReceipt }........................................: 100.00% ✓ 7        ✗ 0
     ✓ { scenario:eth_getUncleByBlockHashAndIndex }..................................: 100.00% ✓ 8        ✗ 0
     ✓ { scenario:eth_getUncleByBlockNumberAndIndex }................................: 100.00% ✓ 37       ✗ 0
     ✓ { scenario:eth_getUncleCountByBlockHash }.....................................: 100.00% ✓ 39       ✗ 0
     ✓ { scenario:eth_getUncleCountByBlockNumber }...................................: 100.00% ✓ 13       ✗ 0
     ✓ { scenario:eth_getWork }......................................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_hashrate }.....................................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_mining }.......................................................: 100.00% ✓ 26       ✗ 0
     ✓ { scenario:eth_protocolVersion }..............................................: 100.00% ✓ 63       ✗ 0
     ✓ { scenario:eth_sendRawTransaction }...........................................: 100.00% ✓ 1        ✗ 0
     ✓ { scenario:eth_sendTransaction }..............................................: 100.00% ✓ 25       ✗ 0
     ✓ { scenario:eth_signTransaction }..............................................: 100.00% ✓ 26       ✗ 0
     ✓ { scenario:eth_sign }.........................................................: 100.00% ✓ 26       ✗ 0
     ✓ { scenario:eth_submitHashrate }...............................................: 100.00% ✓ 9        ✗ 0
     ✓ { scenario:eth_submitWork }...................................................: 100.00% ✓ 26       ✗ 0
     ✓ { scenario:eth_syncing }......................................................: 100.00% ✓ 5        ✗ 0
     ✓ { scenario:net_listening }....................................................: NaN%    ✓ 0        ✗ 0
     ✓ { scenario:web3_clientVersion }...............................................: 100.00% ✓ 12       ✗ 0
     ✓ { scenario:web3_client_version }..............................................: NaN%    ✓ 0        ✗ 0
     data_received...................................................................: 412 kB  1.7 kB/s
     data_sent.......................................................................: 142 kB  589 B/s
     http_req_blocked................................................................: avg=1.1ms    min=0s       med=515.67µs max=80.48ms  p(90)=948.14µs p(95)=1.27ms
     http_req_connecting.............................................................: avg=783.84µs min=0s       med=454.98µs max=30.29ms  p(90)=850.55µs p(95)=1.04ms
     http_req_duration...............................................................: avg=33.12ms  min=0s       med=790.55µs max=4.01s    p(90)=95.83ms  p(95)=175.37ms
       { expected_response:true }....................................................: avg=33.18ms  min=598.25µs med=790.69µs max=4.01s    p(90)=95.83ms  p(95)=175.74ms
     ✓ { scenario:eth_accounts,expected_response:true }..............................: avg=1.39ms   min=963.61µs med=1.38ms   max=1.83ms   p(90)=1.74ms   p(95)=1.79ms
     ✓ { scenario:eth_blockNumber,expected_response:true }...........................: avg=96.46ms  min=90.2ms   med=96.27ms  max=101.65ms p(90)=99.67ms  p(95)=100.66ms
     ✓ { scenario:eth_call,expected_response:true }..................................: avg=114.76ms min=80.26ms  med=95.82ms  max=171.4ms  p(90)=162.47ms p(95)=166.94ms
     ✓ { scenario:eth_chainId,expected_response:true }...............................: avg=866.91µs min=647.69µs med=723.15µs max=1.57ms   p(90)=1.35ms   p(95)=1.52ms
     ✓ { scenario:eth_coinbase,expected_response:true }..............................: avg=827.47µs min=615.57µs med=723.84µs max=3.98ms   p(90)=1.05ms   p(95)=1.27ms
     ✓ { scenario:eth_estimateGas,expected_response:true }...........................: avg=943.05µs min=769.06µs med=864.2µs  max=1.29ms   p(90)=1.1ms    p(95)=1.2ms
     ✓ { scenario:eth_feeHistory,expected_response:true }............................: avg=93.21ms  min=89.8ms   med=92.8ms   max=96.36ms  p(90)=96.05ms  p(95)=96.2ms
     ✓ { scenario:eth_gasPrice,expected_response:true }..............................: avg=946.84µs min=680.74µs med=835.82µs max=2.73ms   p(90)=1.18ms   p(95)=1.46ms
     ✓ { scenario:eth_getBalance,expected_response:true }............................: avg=403.61ms min=383.77ms med=401.22ms max=425.85ms p(90)=420.92ms p(95)=423.38ms
     ✓ { scenario:eth_getBlockByHash,expected_response:true }........................: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     ✓ { scenario:eth_getBlockByNumber,expected_response:true }......................: avg=189.51ms min=185.77ms med=189.29ms max=193.27ms p(90)=193ms    p(95)=193.13ms
     ✗ { scenario:eth_getBlockTransactionCountByHash,expected_response:true }........: avg=4.01s    min=4.01s    med=4.01s    max=4.01s    p(90)=4.01s    p(95)=4.01s
     ✓ { scenario:eth_getBlockTransactionCountByNumber,expected_response:true }......: avg=186.61ms min=182.3ms  med=184.41ms max=198.97ms p(90)=193.01ms p(95)=195.99ms
     ✓ { scenario:eth_getCode,expected_response:true }...............................: avg=260.51ms min=223.06ms med=243.43ms max=332.11ms p(90)=311.56ms p(95)=321.84ms
     ✗ { scenario:eth_getLogs,expected_response:true }...............................: avg=575.58ms min=522.24ms med=575.58ms max=628.93ms p(90)=618.26ms p(95)=623.59ms
     ✓ { scenario:eth_getStorageAt,expected_response:true }..........................: avg=1.01ms   min=997.94µs med=1.01ms   max=1.02ms   p(90)=1.02ms   p(95)=1.02ms
     ✓ { scenario:eth_getTransactionByBlockHashAndIndex,expected_response:true }.....: avg=93.99ms  min=88.16ms  med=93.58ms  max=99.87ms  p(90)=99.62ms  p(95)=99.74ms
     ✓ { scenario:eth_getTransactionByBlockNumberAndIndex,expected_response:true }...: avg=191.01ms min=185.7ms  med=191.67ms max=196.24ms p(90)=195.65ms p(95)=195.94ms
     ✓ { scenario:eth_getTransactionByHash,expected_response:true }..................: avg=116.04ms min=93.89ms  med=99.87ms  max=175.01ms p(90)=153.74ms p(95)=164.38ms
     ✓ { scenario:eth_getTransactionCount,expected_response:true }...................: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     ✓ { scenario:eth_getTransactionReceipt,expected_response:true }.................: avg=145.5ms  min=107.33ms med=143.25ms max=166.25ms p(90)=165.18ms p(95)=165.71ms
     ✓ { scenario:eth_getUncleByBlockHashAndIndex,expected_response:true }...........: avg=1.04ms   min=687µs    med=934.31µs max=1.6ms    p(90)=1.59ms   p(95)=1.59ms
     ✓ { scenario:eth_getUncleByBlockNumberAndIndex,expected_response:true }.........: avg=955.21µs min=682.45µs med=747.72µs max=5.1ms    p(90)=1.25ms   p(95)=1.51ms
     ✓ { scenario:eth_getUncleCountByBlockHash,expected_response:true }..............: avg=905.14µs min=598.25µs med=747.93µs max=4.26ms   p(90)=1.16ms   p(95)=1.65ms
     ✓ { scenario:eth_getUncleCountByBlockNumber,expected_response:true }............: avg=902.6µs  min=674.63µs med=789.47µs max=1.55ms   p(90)=1.3ms    p(95)=1.43ms
     ✓ { scenario:eth_getWork,expected_response:true }...............................: avg=934.55µs min=766.8µs  med=899.61µs max=1.39ms   p(90)=1.18ms   p(95)=1.29ms
     ✓ { scenario:eth_hashrate,expected_response:true }..............................: avg=870.11µs min=728.18µs med=819.59µs max=1.06ms   p(90)=1ms      p(95)=1.03ms
     ✓ { scenario:eth_mining,expected_response:true }................................: avg=957.12µs min=706.2µs  med=834.18µs max=3.04ms   p(90)=1.14ms   p(95)=1.37ms
     ✓ { scenario:eth_protocolVersion,expected_response:true }.......................: avg=806.74µs min=622.13µs med=723.82µs max=2.37ms   p(90)=921.07µs p(95)=1.1ms
     ✗ { scenario:eth_sendRawTransaction,expected_response:true }....................: avg=2.11s    min=2.11s    med=2.11s    max=2.11s    p(90)=2.11s    p(95)=2.11s
     ✓ { scenario:eth_sendTransaction,expected_response:true }.......................: avg=964.94µs min=673.42µs med=752.42µs max=4.87ms   p(90)=1.18ms   p(95)=1.25ms
     ✓ { scenario:eth_sign,expected_response:true }..................................: avg=860.63µs min=644.51µs med=748.86µs max=1.91ms   p(90)=1.19ms   p(95)=1.37ms
     ✓ { scenario:eth_signTransaction,expected_response:true }.......................: avg=881.66µs min=659.03µs med=781.68µs max=1.98ms   p(90)=1.02ms   p(95)=1.73ms
     ✓ { scenario:eth_submitHashrate,expected_response:true }........................: avg=939.02µs min=692.24µs med=791.24µs max=1.42ms   p(90)=1.37ms   p(95)=1.39ms
     ✓ { scenario:eth_submitWork,expected_response:true }............................: avg=1.03ms   min=643µs    med=814.83µs max=3.96ms   p(90)=1.49ms   p(95)=1.6ms
     ✓ { scenario:eth_syncing,expected_response:true }...............................: avg=928.2µs  min=858.71µs med=921.4µs  max=1.01ms   p(90)=983.64µs p(95)=996.82µs
     ✓ { scenario:net_listening,expected_response:true }.............................: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     ✓ { scenario:web3_clientVersion,expected_response:true }........................: avg=1.25ms   min=880.04µs med=1.15ms   max=2.17ms   p(90)=1.74ms   p(95)=1.96ms
     ✓ { scenario:web3_client_version,expected_response:true }.......................: avg=0s       min=0s       med=0s       max=0s       p(90)=0s       p(95)=0s
     http_req_failed.................................................................: 0.17%   ✓ 1        ✗ 579
     http_req_receiving..............................................................: avg=160.49µs min=0s       med=114.22µs max=8.01ms   p(90)=202.93µs p(95)=248.76µs
     http_req_sending................................................................: avg=63.07µs  min=0s       med=51.2µs   max=291.21µs p(90)=108.63µs p(95)=125.79µs
     http_req_tls_handshaking........................................................: avg=225.73µs min=0s       med=0s       max=35.2ms   p(90)=0s       p(95)=0s
     http_req_waiting................................................................: avg=32.9ms   min=0s       med=618.45µs max=4.01s    p(90)=95.51ms  p(95)=175.1ms
     http_reqs.......................................................................: 580     2.413892/s
     ✓ { scenario:eth_accounts }.....................................................: 3       0.012486/s
     ✓ { scenario:eth_blockNumber }..................................................: 11      0.045781/s
     ✓ { scenario:eth_call }.........................................................: 9       0.037457/s
     ✓ { scenario:eth_chainId }......................................................: 16      0.06659/s
     ✓ { scenario:eth_coinbase }.....................................................: 100     0.416188/s
     ✓ { scenario:eth_estimateGas }..................................................: 9       0.037457/s
     ✓ { scenario:eth_feeHistory }...................................................: 5       0.020809/s
     ✓ { scenario:eth_gasPrice }.....................................................: 30      0.124856/s
     ✓ { scenario:eth_getBalance }...................................................: 3       0.012486/s
     ✗ { scenario:eth_getBlockByHash }...............................................: 0       0/s
     ✓ { scenario:eth_getBlockByNumber }.............................................: 6       0.024971/s
     ✓ { scenario:eth_getBlockTransactionCountByHash }...............................: 1       0.004162/s
     ✓ { scenario:eth_getBlockTransactionCountByNumber }.............................: 6       0.024971/s
     ✓ { scenario:eth_getCode }......................................................: 4       0.016648/s
     ✓ { scenario:eth_getLogs }......................................................: 2       0.008324/s
     ✓ { scenario:eth_getStorageAt }.................................................: 3       0.012486/s
     ✓ { scenario:eth_getTransactionByBlockHashAndIndex }............................: 11      0.045781/s
     ✓ { scenario:eth_getTransactionByBlockNumberAndIndex }..........................: 6       0.024971/s
     ✓ { scenario:eth_getTransactionByHash }.........................................: 9       0.037457/s
     ✗ { scenario:eth_getTransactionCount }..........................................: 0       0/s
     ✓ { scenario:eth_getTransactionReceipt }........................................: 7       0.029133/s
     ✓ { scenario:eth_getUncleByBlockHashAndIndex }..................................: 8       0.033295/s
     ✓ { scenario:eth_getUncleByBlockNumberAndIndex }................................: 37      0.15399/s
     ✓ { scenario:eth_getUncleCountByBlockHash }.....................................: 39      0.162313/s
     ✓ { scenario:eth_getUncleCountByBlockNumber }...................................: 13      0.054104/s
     ✓ { scenario:eth_getWork }......................................................: 9       0.037457/s
     ✓ { scenario:eth_hashrate }.....................................................: 10      0.041619/s
     ✓ { scenario:eth_mining }.......................................................: 26      0.108209/s
     ✓ { scenario:eth_protocolVersion }..............................................: 63      0.262199/s
     ✓ { scenario:eth_sendRawTransaction }...........................................: 1       0.004162/s
     ✓ { scenario:eth_sendTransaction }..............................................: 25      0.104047/s
     ✓ { scenario:eth_signTransaction }..............................................: 26      0.108209/s
     ✓ { scenario:eth_sign }.........................................................: 26      0.108209/s
     ✓ { scenario:eth_submitHashrate }...............................................: 9       0.037457/s
     ✓ { scenario:eth_submitWork }...................................................: 26      0.108209/s
     ✓ { scenario:eth_syncing }......................................................: 5       0.020809/s
     ✗ { scenario:net_listening }....................................................: 0       0/s
     ✓ { scenario:web3_clientVersion }...............................................: 12      0.049943/s
     ✗ { scenario:web3_client_version }..............................................: 0       0/s
     iteration_duration..............................................................: avg=34.66ms  min=1.13ms   med=1.49ms   max=4.01s    p(90)=97.17ms  p(95)=183.51ms
     iterations......................................................................: 575     2.393083/s
     scenario_duration...............................................................: 37      min=2      max=4020
     ✓ { scenario:eth_accounts }.....................................................: 9       min=5      max=9
     ✓ { scenario:eth_blockNumber }..................................................: 1078    min=101    max=1078
     ✓ { scenario:eth_call }.........................................................: 1045    min=173    max=1045
     ✓ { scenario:eth_chainId }......................................................: 26      min=3      max=26
     ✓ { scenario:eth_coinbase }.....................................................: 155     min=4      max=155
     ✓ { scenario:eth_estimateGas }..................................................: 16      min=3      max=16
     ✓ { scenario:eth_feeHistory }...................................................: 475     min=97     max=475
     ✓ { scenario:eth_gasPrice }.....................................................: 56      min=3      max=56
     ✓ { scenario:eth_getBalance }...................................................: 1217    min=406    max=1217
     ✗ { scenario:eth_getBlockByHash }...............................................: 0       min=0      max=0
     ✓ { scenario:eth_getBlockByNumber }.............................................: 1146    min=195    max=1146
     ✓ { scenario:eth_getBlockTransactionCountByHash }...............................: 4020    min=4020   max=4020
     ✓ { scenario:eth_getBlockTransactionCountByNumber }.............................: 1128    min=188    max=1128
     ✓ { scenario:eth_getCode }......................................................: 1048    min=334    max=1048
     ✓ { scenario:eth_getLogs }......................................................: 1155    min=631    max=1155
     ✓ { scenario:eth_getStorageAt }.................................................: 6       min=2      max=6
     ✓ { scenario:eth_getTransactionByBlockHashAndIndex }............................: 1052    min=98     max=1052
     ✓ { scenario:eth_getTransactionByBlockNumberAndIndex }..........................: 1153    min=198    max=1153
     ✓ { scenario:eth_getTransactionByHash }.........................................: 1054    min=176    max=1054
     ✗ { scenario:eth_getTransactionCount }..........................................: 0       min=0      max=0
     ✓ { scenario:eth_getTransactionReceipt }........................................: 1031    min=145    max=1031
     ✓ { scenario:eth_getUncleByBlockHashAndIndex }..................................: 15      min=3      max=15
     ✓ { scenario:eth_getUncleByBlockNumberAndIndex }................................: 63      min=3      max=63
     ✓ { scenario:eth_getUncleCountByBlockHash }.....................................: 63      min=3      max=63
     ✓ { scenario:eth_getUncleCountByBlockNumber }...................................: 24      min=5      max=24
     ✓ { scenario:eth_getWork }......................................................: 19      min=6      max=19
     ✓ { scenario:eth_hashrate }.....................................................: 20      min=4      max=20
     ✓ { scenario:eth_mining }.......................................................: 46      min=5      max=46
     ✓ { scenario:eth_protocolVersion }..............................................: 99      min=5      max=99
     ✓ { scenario:eth_sendRawTransaction }...........................................: 2118    min=2118   max=2118
     ✓ { scenario:eth_sendTransaction }..............................................: 44      min=3      max=44
     ✓ { scenario:eth_signTransaction }..............................................: 49      min=5      max=49
     ✓ { scenario:eth_sign }.........................................................: 41      min=3      max=41
     ✓ { scenario:eth_submitHashrate }...............................................: 16      min=3      max=16
     ✓ { scenario:eth_submitWork }...................................................: 51      min=6      max=51
     ✓ { scenario:eth_syncing }......................................................: 10      min=3      max=10
     ✗ { scenario:net_listening }....................................................: 0       min=0      max=0
     ✓ { scenario:web3_clientVersion }...............................................: 37      min=9      max=37
     ✗ { scenario:web3_client_version }..............................................: 0       min=0      max=0
     vus.............................................................................: 1       min=0      max=1
     vus_max.........................................................................: 1       min=1      max=1   time="2022-08-11T00:59:43Z" level=error msg="some thresholds have failed"
```

Note: disregard the per scenario RPS reported in the `http_reqs` section since it's calculated as the total requests in
a scenario divided by the run time of the test suite.

With the test suite mode, a simplified markdown format report `report.md` will also be generated.

| Scenario | VUS | Pass% | RPS | Pass RPS | Avg. Req Duration | Comment |
|----------|-----|-------|-----|----------|-------------------|---------|
| eth_accounts | 1 | 100.00 | 2166.00/s | 2166.00/s | 0.25ms | |
| eth_blockNumber | 1 | 100.00 | 10.51/s | 10.51/s | 94.58ms | |
| eth_call | 1 | 100.00 | 8.35/s | 8.35/s | 119.28ms | |
| eth_chainId | 1 | 100.00 | 2012.49/s | 2012.49/s | 0.27ms | |
| eth_coinbase | 1 | 100.00 | 1494.00/s | 1494.00/s | 0.36ms | |
| eth_estimateGas | 1 | 100.00 | 1535.00/s | 1535.00/s | 0.36ms | |
| eth_feeHistory | 1 | 100.00 | 10.60/s | 10.60/s | 93.87ms | |
| eth_gasPrice | 1 | 100.00 | 1345.33/s | 1345.33/s | 0.46ms | |
| eth_getBalance | 1 | 100.00 | 2.50/s | 2.50/s | 399.48ms | |
| eth_getBlockByHash | 1 | 0.00 | NaN/s | NaN/s | 0.00ms | |
| eth_getBlockByNumber | 1 | 100.00 | 5.28/s | 5.28/s | 188.62ms | |
| eth_getBlockTransactionCountByHash | 1 | 0.00 | NaN/s | NaN/s | 0.00ms | |
| eth_getBlockTransactionCountByNumber | 1 | 100.00 | 4.97/s | 4.97/s | 200.67ms | |
| eth_getCode | 1 | 100.00 | 3.39/s | 3.39/s | 293.59ms | |
| eth_getLogs | 1 | 100.00 | 1.99/s | 1.99/s | 502.48ms | |
| eth_getStorageAt | 1 | 0.00 | 1737.13/s | 0.00/s | 0.33ms | |
| eth_getTransactionByBlockHashAndIndex | 1 | 100.00 | 10.48/s | 10.48/s | 94.86ms | |
| eth_getTransactionByBlockNumberAndIndex | 1 | 100.00 | 5.17/s | 5.17/s | 193.04ms | |
| eth_getTransactionByHash | 1 | 100.00 | 5.46/s | 5.46/s | 182.31ms | |
| eth_getTransactionCount | 1 | 100.00 | 2.77/s | 2.77/s | 360.07ms | |
| eth_getTransactionReceipt | 1 | 100.00 | 8.37/s | 8.37/s | 118.73ms | |
| eth_getUncleByBlockHashAndIndex | 1 | 100.00 | 2325.50/s | 2325.50/s | 0.24ms | |
| eth_getUncleByBlockNumberAndIndex | 1 | 100.00 | 2336.83/s | 2336.83/s | 0.23ms | |
| eth_getUncleCountByBlockHash | 1 | 100.00 | 2352.00/s | 2352.00/s | 0.22ms | |
| eth_getUncleCountByBlockNumber | 1 | 100.00 | 472.89/s | 472.89/s | 0.34ms | |
| eth_getWork | 1 | 100.00 | 1.71/s | 1.71/s | 0.58ms | |
| eth_hashrate | 1 | 100.00 | 2300.35/s | 2300.35/s | 0.24ms | |
| eth_mining | 1 | 100.00 | 2135.00/s | 2135.00/s | 0.25ms | |
| eth_protocolVersion | 1 | 100.00 | 2283.50/s | 2283.50/s | 0.23ms | |
| eth_sendRawTransaction | 1 | 100.00 | 0.44/s | 0.44/s | 2292.06ms | |
| eth_sendTransaction | 1 | 100.00 | 538.55/s | 538.55/s | 0.27ms | |
| eth_sign | 1 | 100.00 | 2271.36/s | 2271.36/s | 0.24ms | |
| eth_signTransaction | 1 | 100.00 | 895.51/s | 895.51/s | 0.24ms | |
| eth_submitHashrate | 1 | 100.00 | 2249.00/s | 2249.00/s | 0.24ms | |
| eth_submitWork | 1 | 100.00 | 18.46/s | 18.46/s | 0.31ms | |
| eth_syncing | 1 | 100.00 | 553.25/s | 553.25/s | 0.23ms | |
| net_listening | 1 | 100.00 | 2372.81/s | 2372.81/s | 0.23ms | |
| web3_clientVersion | 1 | 100.00 | 2328.00/s | 2328.00/s | 0.23ms | |
| web3_client_version | 1 | 100.00 | 859.18/s | 859.18/s | 0.23ms | |

#### Single Test

To run a single test, such as the `eth_chainid` test, just do

```shell
k6 run src/sceanrios/test/eth_chainid.js
```

When it completes, k6 will show a similar summary report. However, there won't be a `report.md` report.
