
testname=${1}

docker run --rm \
    -e DEFAULT_VUS="100"                                       \
    -e DEFAULT_DURATION="90s"                                \
    -e MIRROR_BASE_URL="https://testnet.mirrornode.hedera.com"                         \
    -e RELAY_BASE_URL="https://testnet.hashio.io/api"                         \
    -v ${PWD}:/mnt \
    loadimpact/k6 run /mnt/${testname}

