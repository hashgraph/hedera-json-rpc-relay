const net = require("net");

(async function () {
    const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];
    const network = process.env.HEDERA_NETWORK || '{}';

    const isLocalNode = !supportedEnvs.includes(network.toLowerCase());
    if (isLocalNode) {
        let nodeStarted = false;
        const retries = 10;
        while (!nodeStarted && retries >= 0) {
            net
            .createConnection('5600', '127.0.0.1')
            .on("data", function () {
                nodeStarted = true;
                console.log('Local node has been succefully started!')
            })
            .on("error", (err) => {
                console.log(
                `Waiting for local node, retrying in 15 seconds...`
                );
            });

            await new Promise(r => setTimeout(r, 15000));
        }
    }
    process.exit(0);
})();

