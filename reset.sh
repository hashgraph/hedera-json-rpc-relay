#!/bin/bash
rm -rf ./node_modules
rm -rf ./packages/relay/node_modules
rm -rf ./packages/server/node_modules
rm -rf ./packages/ws-server/node_modules
npm install
npm run setup
npm run build
