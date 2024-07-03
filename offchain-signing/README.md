# Off-chain and offline account deletion transaction signing

This project gives us an ability to sign an AccountDeleteTransaction completely off-chain and offline that will be executed afterwards by another executor. One of the main application of this might be the reseting of an accounts nonce to allow flows that require initial nonces such as deterministic contract address.

Action steps:

```bash
npm install # install dependencies
cp .env.example .env # copy and fill the .env
node scripts/signAccountDeleteTransaction.js # run the script and get the signed transaction bytes
```

`.env.example` format:
```bash
DELETABLE_ACCOUNT_NUM=   # uint - the account id we want to delete - e.g. 6056440
DELETABLE_ACCOUNT_PK=    # hex encoded 32 bytes - the account's private key - e.g. 0x0e98be035c311a4053db957b088497e326e62964ecad8672ad797370506ff9bf
RECEIVER_ACCOUNT_NUM=    # uint - the account to transfer the remaining funds to - e.g. 5644001
VALID_START_DAYS_OFFSET= # uint - after how many days the transaction's validStart time will be set - e.g. 15 (default 30)
```
