const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const openRpcData = require('../docs/openrpc.json');

// Create an instance of Octokit and authenticate (you can use a personal access token or OAuth token)
const octokit = new Octokit({
    auth: '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'
});
let currentBlockHash;
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
    const response = await axios.post(relayUrl, request);
    return response.data;
}

function checkRequestBody(request) {
    if((request.method === 'eth_getBlockByHash' && request.params[0] === '0x7cb4dd3daba1f739d0c1ec7d998b4a2f6fd83019116455afa54ca4f49dfa0ad4') ||
        (request.method === 'eth_sendRawTransaction' && request.params[0] === '0xf86709843b9aca018261a894aa000000000000000000000000000000000000000a825544820a95a0281582922adf6475f5b2241f0a4f886dafa947ecdc5913703b7840344a566b45a05f685fc099161126637a12308f278a8cd162788a6c6d5aee4d425cde261ba35d')
        || (request.method === 'eth_getTransactionByBlockHashAndIndex')) {
            request.params[0] = currentBlockHash;
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
        currentBlockHash = latestBlock.result.hash;
        const relaySupportedMethodNames = openRpcData.methods.map(method => method.name);
        const ethSupportedMethods = await getEthereumExecApis(relaySupportedMethodNames);
        const folders = ethSupportedMethods.map(each => each.path);
        //sendRawTransaction - make it work with hedera hash of transaction
        //excluding temorary these methods
        const excludedValues = ['tests/eth_getTransactionByBlockHashAndIndex', 'tests/eth_getBalance', 'tests/eth_getTransactionByBlockNumberAndIndex',
                                'tests/eth_getTransactionByHash', 'tests/eth_getTransactionReceipt', 'tests/eth_sendRawTransaction'];
        const filteredFolders = folders.filter(folderName => !excludedValues.includes(folderName));
        let fileContents = [];
        for (const folder of filteredFolders) {
            fileContents.push(await getFolderContent(folder));
        }
        const reqAndExpectedRes = splitReqAndRes(fileContents);

        for (const item of reqAndExpectedRes) {
            console.log("Executing test for", JSON.parse(item.request).method);
            const modifiedRequest = checkRequestBody(JSON.parse(item.request));
            const response = await sendRequestToRelay(modifiedRequest);
            checkResponseFormat(response, JSON.parse(item.response));
        }   
    }
    catch (error) {
       console.error(error);
    }
}

main();
