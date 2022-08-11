
testname=${1}

docker run --rm \
    -e DEFAULT_VUS="1"                                       \
    -e DEFAULT_DURATION="1s"                                \
    -e MIRROR_BASE_URL="https://testnet.mirrornode.hedera.com"                         \
    -e RELAY_BASE_URL="http://host.docker.internal:7546"                         \
    -v ${PWD}:/mnt \
    loadimpact/k6 run /mnt/${testname}

