# Account deletion hardhat script

This project demonstrates how to delete an already existing account. One of the main application of this might be the reseting of an accounts nonce to allow flows that require initial nonces such as deterministic contract address.

Action steps:

```bash
npm install # install dependencies
cp .env.example .env # copy and fill the .env
npx hardhat run scripts/deleteAccount.js # run the script, default network is testnet and can be changed by hardhat.config.js
```

`.env.example` format:
```bash
DELETABLE_ACCOUNT_PK=    # hex encoded     - the account we want to delete
OPERATOR_PK=             # hex encoded     - transaction executor private key
RECEIVER_ADDRESS=        # hex encoded     - the address of the account to transfer the remaining funds to
```