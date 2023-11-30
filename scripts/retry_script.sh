#!/bin/bash
set -v
set +e
hedera stop
sleep 5
ls -lah $(dirname $(readlink -f $(which hedera)))/../network-logs
sudo rm -rf $(dirname $(readlink -f $(which hedera)))/../network-logs
sleep 5
hedera restart -d
docker stop json-rpc-relay json-rpc-relay-ws