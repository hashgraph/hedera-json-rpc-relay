const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const openRpcData = require('../docs/openrpc.json');
require('ts-node/register');
const helper = require('../packages/relay/tests/helpers.ts');

// Create an instance of Octokit and authenticate (you can use a personal access token or OAuth token)
const octokit = new Octokit({
    auth: process.env.GITHUB_PERSONAL_TOKEN
});
let currentBlockHash;
let transactionAndBlockHash;
const relayUrl = 'http://127.0.0.1:7546';
const body = {
    "jsonrpc": "2.0",
    "method": "eth_getBlockByNumber",
    "params": [
        "latest",
        true
    ],
    "id": 0
};
const gasPrice = '0x2C68AF0BB14000';
const gasLimit = "0x3D090";
const value = '0x2E90EDD000';
let transaction = {
    nonce: 0,
    chainId: 0x12a,
    to: "0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69",
    from: "0xc37f417fA09933335240FCA72DD257BFBdE9C275",
    value,
    gasPrice,
    gasLimit: gasLimit,
};

async function getEthereumExecApis(relaySupportedMethods) {
    const response = await octokit.repos.getContent({
        owner: 'ethereum',
        repo: 'execution-apis',
        path: '/tests', // The root path of the repository (to get all contents)
      });

    return response.data.filter(object => relaySupportedMethods.includes(object.name));
}

async function getFolderContent(path) {
    const response = await octokit.repos.getContent({
        owner: 'ethereum',
        repo: 'execution-apis',
        path: `/${path}`,
    });

    let fileContents = [];
    if (response.data.length > 1) {
        for (const dataEntry of response.data) {
            const fileContent = await getFileContent(dataEntry.path);
            fileContents.push(fileContent);
        }
    } else {
        const fileContent = await getFileContent(response.data[0].path);
        fileContents.push(fileContent);
    }
    return fileContents;
}

function splitReqAndRes(contents) {
    const newContents = [];
    contents.forEach((inputString) => {
        const lines = inputString[0].split('\n');
        const filteredLines = lines.filter(line => line != '').map(line => line.slice(3));
    
        return newContents.push({request: filteredLines[0], response: filteredLines[1]});
    });
    return newContents;
}

async function getFileContent(path) {
    const response = await octokit.repos.getContent({
        owner: 'ethereum',
        repo: 'execution-apis',
        path: `/${path}`,
    });

    const content = Buffer.from(response.data.content, 'base64').toString();

    return content;
}

async function sendRequestToRelay(request) {
    try {
        const response = await axios.post(relayUrl, request);
        return response.data;
    } catch(error) {
        console.error(error);
    }
    
}

async function signAndSendRawTransaction() {
    const signed = await helper.signTransaction(transaction, "0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd");
    const request = {"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":[signed]};
    const response = await sendRequestToRelay(request);
    const requestTransactionReceipt = {
        "id": "test_id",
        "jsonrpc": "2.0",
        "method": "eth_getTransactionReceipt",
        "params": [response.result]
    };
    const transactionReceipt = await sendRequestToRelay(requestTransactionReceipt);
    return {transactionHash: response.result, blockHash: transactionReceipt.result.blockHash,
            transactionIndex: transactionReceipt.result.transactionIndex, blockNumber: transactionReceipt.result.blockNumber };
}

async function checkRequestBody(request) {
    //This method changes params for request which wont work with the values from ethereum api tests
    if((request.method === 'eth_getBlockByHash' && request.params[0] === '0x7cb4dd3daba1f739d0c1ec7d998b4a2f6fd83019116455afa54ca4f49dfa0ad4') ||
        (request.method === 'eth_sendRawTransaction'
            && request.params[0] === '0xf86709843b9aca018261a894aa000000000000000000000000000000000000000a825544820a95a0281582922adf6475f5b2241f0a4f886dafa947ecdc5913703b7840344a566b45a05f685fc099161126637a12308f278a8cd162788a6c6d5aee4d425cde261ba35d')) {
            request.params[0] = currentBlockHash;
    }
    if((request.method === 'eth_getTransactionByBlockHashAndIndex')) {
        request.params[0] = transactionAndBlockHash.blockHash;
        request.params[1] = transactionAndBlockHash.transactionIndex;
    }
    if (request.method === 'eth_getTransactionByBlockNumberAndIndex') {
        request.params[0] = transactionAndBlockHash.blockNumber;
        request.params[1] = transactionAndBlockHash.transactionIndex;
    }
    if (request.method === 'eth_getTransactionByHash' || request.method === 'eth_getTransactionReceipt') {
        request.params[0] = transactionAndBlockHash.transactionHash;
    }
    if (request.method === 'eth_sendRawTransaction') {
        transaction.nonce = 1;
        const transactionHash = await helper.signTransaction(transaction, "0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd");
        request.params[0] = transactionHash;
    }
    return request;
}

function checkResponseFormat(actualReponse, expectedResponse) {
    const actualResponseKeys = extractKeys(actualReponse);
    const expectedResponseKeys = extractKeys(expectedResponse);
    const missingKeys = expectedResponseKeys.filter(key => !actualResponseKeys.includes(key));

    if (missingKeys.length) {
        throw Error(`Response format is not matching, the response is missing ${missingKeys}`);
    }
}

function extractKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        keys.push(newKey);
  
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          keys = keys.concat(extractKeys(obj[key], newKey));
        }
      }
    }
  
    return keys;
}

async function main() {
    try {
        const latestBlock = await sendRequestToRelay(body);
        transactionAndBlockHash = await signAndSendRawTransaction();
        currentBlockHash = latestBlock.result.hash;
        const relaySupportedMethodNames = openRpcData.methods.map(method => method.name);
        const ethSupportedMethods = await getEthereumExecApis(relaySupportedMethodNames);
        const folders = ethSupportedMethods.map(each => each.path);
        //temporary excluding these methods
        //transaction by hash missing accessList and yParity
        //get transaction receipt missing type
        const excludedValues = ['tests/eth_getBalance', 'tests/eth_getTransactionByHash', 'tests/eth_getTransactionReceipt'];
        const filteredFolders = folders.filter(folderName => !excludedValues.includes(folderName));
        let fileContents = [];
        for (const folder of filteredFolders) {
            fileContents.push(await getFolderContent(folder));
        }
        const reqAndExpectedRes = splitReqAndRes(fileContents);

        for (const item of reqAndExpectedRes) {
            console.log("Executing test for", JSON.parse(item.request).method);
            const modifiedRequest = await checkRequestBody(JSON.parse(item.request));
            const response = await sendRequestToRelay(modifiedRequest);
            checkResponseFormat(response, JSON.parse(item.response));
        }   
    }
    catch (error) {
       console.error(error);
    }
}

main();
