# Off-chain signed tx executor cron

This project gives us an ability to execute an already signed transaction when the transaction's validStart time occurs.

Action steps:

```bash
npm install # install dependencies
cp .env.example .env # copy and fill the .env
npm run start # run the cron that tracks when the transaction should be executed
```

`.env.example` format:
```bash
SIGNED_TX_BYTES= # hex encoded signed transaction bytes
```
