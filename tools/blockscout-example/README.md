# Blockscout

BlockScout is an open-source blockchain explorer designed to provide users with a comprehensive interface for interacting with Ethereum-compatible networks, enhancing transparency and accessibility in blockchain ecosystems. It allows users to view and analyze blockchain data, including transactions, blocks, smart contracts, and token information, while providing real-time monitoring of transactions and block confirmations through a user-friendly interface and an API that enable both technical and non-technical users to easily interact with smart contracts and track various tokens and their transactions.

- Documentation: https://docs.blockscout.com/
- Repository: https://github.com/blockscout/blockscout/tree/master

## Requirements
Local node repository needed
```bash
git clone git@github.com:hiero-ledger/hiero-local-node.git
```

## Step 1: Set Up the Relay with Localnode

1. In the `.env` file of the local node set the following variable to true:

   ```env
   BATCH_REQUESTS_ENABLED=true
   ```
2. In the `docker-compose.yml` file in the local node:
- add `BATCH_REQUESTS_ENABLED` to the envorment of the relay:
    ```
    BATCH_REQUESTS_ENABLED: "${BATCH_REQUESTS_ENABLED}"
    ```

- adjust the port of **hedera-explorer** in order to free up the default port on which blockscout is running:
    ```
    ports:
      - "9080:8080"
    ```

3. Run the project:
    ```bash
    npm run start
    ```
## Step 2: Set Up Blockscout
1. Clone Blockscout repo
    ```git
    git clone git@github.com:blockscout/blockscout.git
    ```
2. Set these variables in `common-blockscout.env`:
    ```env
    ETHEREUM_JSONRPC_HTTP_URL=http://host.docker.internal:7546/
    ETHEREUM_JSONRPC_TRACE_URL=http://host.docker.internal:7546/
    NETWORK=Hedera
    COIN_NAME=HBAR
    COIN=HBAR
    NFT_MEDIA_HANDLER_ENABLED=false
    ```
3. Make these changes in `docker-compose.yml` --> in `services` find `backend` and for the `environment` set the following:
    ```
    environment:
        ETHEREUM_JSONRPC_HTTP_URL: http://host.docker.internal:7546/
        ETHEREUM_JSONRPC_TRACE_URL: http://host.docker.internal:7546/
        ETHEREUM_JSONRPC_WS_URL: ws://host.docker.internal:8546/
        CHAIN_ID: '298'
    ```
4. Build the project:
    ```bash
    cd ./docker-compose
    docker-compose up --build
    ```
5. Open [http://localhost](http://localhost)

## API request example
[Blockscout JSON RPC & ETH Compatible RPC Endpoints](https://docs.blockscout.com/devs/apis/rpc)

**curl example** for getting the balance of an address:
   - blockscout doc: https://docs.blockscout.com/devs/apis/rpc/account#get-the-native-token-balance-for-an-address
   - make sure to replace `instance_base_url` with `localhost`
   - when testing different modules make sure to give the correct value for `module`
   - choose an `accountAddress` from one of the accounts that the local node generates upon starting
   - curl request:
   ```bash
   curl --location 'http://localhost/api?module=account&action=balance&address={accountAddress}'
   ```
