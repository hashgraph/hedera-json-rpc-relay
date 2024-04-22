#!/bin/bash
set -e

echo "hedera stop"
npx hedera stop
sleep 5

echo "hedera start"
npx hedera start --network local-test --detached=true
sleep 1

echo "hardhat prepare"
npx hardhat prepare
sleep 1

echo "graph-local-clean"
npm run graph-local-clean
sleep 1

echo "graph-local"
npm run graph-local -- --detach
sleep 10

echo "create-local"
npm run create-local
sleep 1

echo "deploy-local"
npm run deploy-local -- --network local
