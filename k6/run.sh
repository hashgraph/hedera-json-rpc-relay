
testname=${1}

docker run --rm \
    -e DEFAULT_VUS="100"                                       \
    -e DEFAULT_DURATION="90s"                                \
    -e BASE_URL="https://previewnet.hashio.io/api"                         \
    -v ${PWD}:/mnt \
    loadimpact/k6 run /mnt/${testname}

