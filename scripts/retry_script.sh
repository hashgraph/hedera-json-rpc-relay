#!/bin/bash
set -v
set +e
# Temporary workaround until issue in local node is resolved
# https://github.com/hashgraph/hedera-local-node/issues/308#issue-1647448101
hedera stop
sleep 5
ls -lah $(dirname $(readlink -f $(which hedera)))/../network-logs
sudo rm -rf $(dirname $(readlink -f $(which hedera)))/../network-logs
sleep 5


hedera restart -d --verbose=trace
docker stop json-rpc-relay json-rpc-relay-ws
