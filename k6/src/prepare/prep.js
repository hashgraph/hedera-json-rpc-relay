import Greeter from './contracts/Greeter.json' assert { type: "json" };
import { ethers } from 'ethers';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logPayloads = process.env.DEBUG_MODE === "true";


class LoggingProvider extends ethers.providers.JsonRpcProvider {
    send(method, params) {

        if(logPayloads){
            const request = {
                method: method,
                params: params,
                id: (this._nextId++),
                jsonrpc: "2.0"
            };

            console.log(">>>", method, "-->", JSON.stringify(request));
        }

        return super.send(method, params).then((result) => {
            if(logPayloads){
                console.log("<<<", method, "-->", result);
            }
            return result;
        });
    }
}

async function getSignedTxs(mainWallet, greeterContract) {

    const amount = process.env.SIGNED_TXS ? process.env.SIGNED_TXS : 5;
    console.log(`Generating (${amount}) Txs for Performance Test...`)

    let nonce = await mainWallet.getTransactionCount();
    const chainId = await mainWallet.getChainId();
    const gasPrice = await mainWallet.getGasPrice();

    const signedTxCollection = [];

    for (let i = 0; i < amount; i++) {
        const msg = `Greetings from Automated Test Number ${i}, Hello!`;
        const trx = await greeterContract.populateTransaction.setGreeting(msg);
        trx.gasLimit = await greeterContract.estimateGas.setGreeting(msg);
        trx.gasLimit = ethers.utils.hexValue(trx.gasLimit*1.5); // extra
        trx.chainId = chainId;
        trx.gasPrice = ethers.utils.hexValue(gasPrice*1.5); // with extra
        trx.nonce = nonce + i;
        const signedTx = await mainWallet.signTransaction(trx);
        signedTxCollection.push(signedTx);
    }

    return signedTxCollection;
}

(async () => {
    const mainPrivateKeyString = process.env.PRIVATE_KEY;
    const mainWallet = new ethers.Wallet(mainPrivateKeyString, new LoggingProvider(process.env.RELAY_BASE_URL));
    console.log("Address: " + mainWallet.address);

    const contractFactory = new ethers.ContractFactory(Greeter.abi, Greeter.bytecode, mainWallet);
    console.log("Deploying Greeter SC...")
    const contract = await contractFactory.deploy("Hey World!");
    const receipt = await contract.deployTransaction.wait();
    const contractAddress = receipt.contractAddress;
    console.log(`Greeter SC Address: ${contractAddress}`);

    let call = await contract.greet();
    console.log('Greet: ' + call);
    console.log('Updating Greeter... ');
    await contract.setGreeting("Hello Future!");
    call = await contract.greet();
    console.log('Greet: ' + call);

    const signedTxCollection = JSON.stringify(await getSignedTxs(mainWallet, contract));

    console.log("Creating smartContractParams.json file...");
    fs.writeFileSync(path.resolve(__dirname) + '/.smartContractParams.json',
        `{"from":"${mainWallet.address}", "contractAddress":"${contractAddress}", "signedTxs": ${signedTxCollection}  }`);
})();

