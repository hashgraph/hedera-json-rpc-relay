# Running the Relay with Blockscout

## Step 1: Set Up the Relay with Localnode

1. Ensure you have the **localnode** running with our relay.
2. In the `.env` file of the local node set the following variable to true:

   ```env
   BATCH_REQUESTS_ENABLED=true
4. Run the project:
    ```bash
    npm run start
3. Stop the **hedera-explorer** process currently listening on port **8080**. You can do this using one of the following methods:
    - If you are using Docker:
      ```bash
      docker stop hedera-explorer
      ```
    - Alternatively:
      ```bash
      sudo lsof -i :8080
      sudo kill <PID>
      ```
## Step 2: Set Up Blockscout
1. Clone Blockscout repo
    ```git
    git clone git@github.com:blockscout/blockscout.git
2. Set these variables in `common-blockscout.env`:
    ```env
    ETHEREUM_JSONRPC_HTTP_URL=http://host.docker.internal:7546/
    ETHEREUM_JSONRPC_TRACE_URL=http://host.docker.internal:7546/
    NETWORK=Hedera
    COIN_NAME=HBAR
    COIN=HBAR
    NFT_MEDIA_HANDLER_ENABLED=false
3. Make these changes in `docker-compose.yml` --> in `services` find `backend` and for the `environment` set the following:
    ```
    environment:
        ETHEREUM_JSONRPC_HTTP_URL: http://host.docker.internal:7546/
        ETHEREUM_JSONRPC_TRACE_URL: http://host.docker.internal:7546/
        ETHEREUM_JSONRPC_WS_URL: ws://host.docker.internal:8546/
        CHAIN_ID: '298'
4. Build the project:
    ```bash
    cd ./docker-compose
    docker-compose up --build
5. Open [http://localhost](http://localhost)