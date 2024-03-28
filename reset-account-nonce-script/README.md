# Account deletion hardhat script

This project demonstrates how to delete an already existing ECDSA account.

Action steps:

```bash
npm install # install dependencies
cp .env.example .env # copy and fill the .env
npx hardhat run scripts/deleteAccount.js # run the script, default network is testnet and can be changed by hardhat.config.js
```

`.env.example` format:
```bash
DELETABLE_ACCOUNT_PK=    # hex encoded     - the account we want to delete
OPERATOR_ID=             # format 0.0.9999 - transaction executor id
OPERATOR_PK=             # hex encoded     - transaction executor private key
RECEIVER_ID=             # format 0.0.9999 - the id of the account to transfer the remaining funds to
```

PS: `OPERATOR_ID` can be retrieved by:
- searching by account's address in https://hashscan.io/<[mainnet,testnet,previewnet]>
- direct mirror node REST API call to `https://<[mainnet-public,testnet,previewnet]>.mirrornode.hedera.com/api/v1/accounts/<account_address>`