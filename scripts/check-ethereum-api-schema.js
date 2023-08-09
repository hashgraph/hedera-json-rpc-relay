const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const axios = require('axios');

// Create an instance of Octokit and authenticate (you can use a personal access token or OAuth token)
const octokit = new Octokit({
    auth: process.env.GITHUB_PERSONAL_TOKEN
});

async function getEthereumExecApis(relaySupportedMethods) {
    const response = await octokit.repos.getContent({
        owner: 'ethereum',
        repo: 'execution-apis',
        path: '/tests', // The root path of the repository (to get all contents)
      });
    const names = response.data.filter(object => relaySupportedMethods.includes(object.name));

    return names;
}

async function getSupportedMethods() {
    return new Promise((resolve, reject) => {
        fs.readFile('../docs/openrpc.json', 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            const jsonData = JSON.parse(data);
            resolve(jsonData);
        });
    });
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

    const reqAndExpectedRes = splitReqAndRes(fileContents);
    await sendRequestToRelay(reqAndExpectedRes);
}

function splitReqAndRes(contents) {
    const newContents = [];
    contents.forEach((inputString) => {
        const lines = inputString.split('\n');
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

async function sendRequestToRelay(reqAndExpectedRes) {
    const requests = [];
    const url = 'http://127.0.0.1:7546';
    //Need to get a hash
    const hederaBlockHash = '0x43da6a71f66d6d46d2b487c8231c04f01b3ba3bd91d165266d8eb39de3c0152b';
    for (const item of reqAndExpectedRes) {
        const request = JSON.parse(item.request);
        // if((request.method === 'eth_getBlockByHash' && request.params[0] === '0x7cb4dd3daba1f739d0c1ec7d998b4a2f6fd83019116455afa54ca4f49dfa0ad4') ||
        // (request.method === 'eth_sendRawTransaction' && request.params[0] === '0xf86709843b9aca018261a894aa000000000000000000000000000000000000000a825544820a95a0281582922adf6475f5b2241f0a4f886dafa947ecdc5913703b7840344a566b45a05f685fc099161126637a12308f278a8cd162788a6c6d5aee4d425cde261ba35d')) {
        //     request.params[0] = hederaBlockHash;
        // }
        requests.push(axios.post(url, request));
    }
    try {
        const responses = await Promise.all(requests);
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          checkResponse(response.data, JSON.parse(reqAndExpectedRes[i].response));
        }
    
        return responses.map(response => response.data);
      } catch (error) {
        console.error('Error:', error.message);
        throw error;
      }
}

function checkResponse(actualReponse, expectedResponse) {
    const actualResponseKeys = extractKeys(actualReponse);
    const expectedResponseKeys = extractKeys(expectedResponse);
    const missingKeys = expectedResponseKeys.filter(key => !actualResponseKeys.includes(key));

    const areEqual = actualResponseKeys.length === expectedResponseKeys.length && actualResponseKeys.every(item => expectedResponseKeys.includes(item));

    if (!areEqual) {
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

async function fetchData() {
    try {
        const openRpcData = await getSupportedMethods();
        const relaySupportedMethodNames = openRpcData.methods.map(method => method.name);
        const ethSupportedMethods = await getEthereumExecApis(relaySupportedMethodNames);
        const folders = ethSupportedMethods.map(each => each.path);
        //getBalance - not working with blockHash only with Number and Tag
        //sendRawTransaction - make it work with heder hash of transaction
        //blockByHash missing withdrawal and withdrawalRoot
        //blockByNumber missing withdrawal and withdrawalRoot
        const excludedValues = ['tests/eth_getBalance','tests/eth_sendRawTransaction'];
        const filteredFolders = folders.filter(folderName => !excludedValues.includes(folderName));
        for (const folder of filteredFolders) {
            console.log("Executing test for", folder.slice(6));
            await getFolderContent(folder);
        }
    }
    catch (error) {
       console.error(error);
    }
}

fetchData();
