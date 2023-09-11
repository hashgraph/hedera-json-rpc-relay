import fs from 'fs';
const { bytecode } = require('../contracts/Basic.json');
const path = require('path');
const directoryPath = path.resolve(__dirname, '../../../../node_modules/execution-apis/tests');
const axios = require('axios');
const openRpcData = require('../../../../docs/openrpc.json');
require('dotenv').config();
import { signTransaction } from '../../../relay/tests/helpers';
import { expect } from 'chai';
let currentBlockHash;
let legacyTransactionAndBlockHash;
let transaction2930AndBlockHash;
let transaction1559AndBlockHash;
let createContractLegacyTransactionAndBlockHash;
const sendAccountAddress = '0xc37f417fA09933335240FCA72DD257BFBdE9C275';
const receiveAccountAddress = '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69';
const relayUrl = 'http://127.0.0.1:7546';
const gasPrice = '0x2C68AF0BB14000';
const gasLimit = '0x3D090';
const value = '0x2E90EDD000';
const localNodeAccountPrivateKey = '0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd';

let legacyTransaction = {
  chainId: 0x12a,
  to: receiveAccountAddress,
  from: sendAccountAddress,
  value,
  gasPrice,
  gasLimit: gasLimit,
  type: 0,
};

let transaction2930 = {
  chainId: 0x12a,
  to: receiveAccountAddress,
  from: sendAccountAddress,
  value,
  gasPrice,
  gasLimit: gasLimit,
  type: 1,
};

let transaction1559 = {
  chainId: 0x12a,
  to: receiveAccountAddress,
  from: sendAccountAddress,
  value,
  gasPrice,
  maxPriorityFeePerGas: gasPrice,
  maxFeePerGas: gasPrice,
  gasLimit: gasLimit,
  type: 2,
};

let createContractLegacyTransaction = {
  chainId: 0x12a,
  to: null,
  from: sendAccountAddress,
  gasLimit: gasLimit,
  gasPrice: gasPrice,
  type: 0,
  data: bytecode,
};

async function getTransactionCount() {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getTransactionCount',
    params: [sendAccountAddress, 'latest'],
  };

  const response = await sendRequestToRelay(request);

  return response.result;
}

async function getLatestBlockHash() {
  const request = {
    jsonrpc: '2.0',
    method: 'eth_getBlockByNumber',
    params: ['latest', false],
    id: 0,
  };

  const response = await sendRequestToRelay(request);

  return response.result.hash;
}

function splitReqAndRes(content) {
  /**
   * Splits a given input string into distinct segments representing the request and the response.
   *
   * @param {string} content - The input string to be segmented.
   * @returns {{ request: string, response: string }} - An object containing the separated request and response strings.
   */
  const lines = content.split('\n');
  const filteredLines = lines.filter((line) => line != '').map((line) => line.slice(3));

  return { request: filteredLines[0], response: filteredLines[1] };
}

async function sendRequestToRelay(request) {
  try {
    const response = await axios.post(relayUrl, request);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function signAndSendRawTransaction(transaction) {
  transaction.nonce = parseInt(await getTransactionCount(), 16);
  const signed = await signTransaction(transaction, localNodeAccountPrivateKey);
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_sendRawTransaction',
    params: [signed],
  };

  const response = await sendRequestToRelay(request);
  const requestTransactionReceipt = {
    id: 'test_id',
    jsonrpc: '2.0',
    method: 'eth_getTransactionReceipt',
    params: [response.result],
  };
  const transactionReceipt = await sendRequestToRelay(requestTransactionReceipt);
  return {
    transactionHash: response.result,
    blockHash: transactionReceipt.result.blockHash,
    transactionIndex: transactionReceipt.result.transactionIndex,
    blockNumber: transactionReceipt.result.blockNumber,
  };
}

async function checkRequestBody(fileName, request) {
  /**
   * Modifies a request object for compatability with our relay.
   *
   * @param {string} fileName - The name of the file associated with the request.
   * @param {Object} request - The request object to be modified.
   * @returns {Object} - The modified request object.
   */
  if (
    (request.method === 'eth_getBlockByHash' &&
      request.params[0] === '0x7cb4dd3daba1f739d0c1ec7d998b4a2f6fd83019116455afa54ca4f49dfa0ad4') ||
    (request.method === 'eth_sendRawTransaction' &&
      request.params[0] ===
        '0xf86709843b9aca018261a894aa000000000000000000000000000000000000000a825544820a95a0281582922adf6475f5b2241f0a4f886dafa947ecdc5913703b7840344a566b45a05f685fc099161126637a12308f278a8cd162788a6c6d5aee4d425cde261ba35d')
  ) {
    request.params[0] = currentBlockHash;
  }
  if (request.method === 'eth_getTransactionByBlockHashAndIndex') {
    request.params[0] = legacyTransactionAndBlockHash.blockHash;
    request.params[1] = legacyTransactionAndBlockHash.transactionIndex;
  }
  if (request.method === 'eth_getTransactionByBlockNumberAndIndex') {
    request.params[0] = legacyTransactionAndBlockHash.blockNumber;
    request.params[1] = legacyTransactionAndBlockHash.transactionIndex;
  }
  if (request.method === 'eth_sendRawTransaction') {
    legacyTransaction.nonce = parseInt(await getTransactionCount(), 16);
    const transactionHash = await signTransaction(legacyTransaction, localNodeAccountPrivateKey);
    request.params[0] = transactionHash;
  }
  if (request.method === 'eth_getBalance') {
    request.params[0] = '0x5C41A21F14cFe9808cBEc1d91b55Ba75ed327Eb6';
    request.params[1] = currentBlockHash;
  }
  if (request.method === 'eth_getTransactionByHash' || request.method === 'eth_getTransactionReceipt') {
    request = formatTransactionByHashAndReceiptRequests(fileName, request);
  }
  return request;
}

function checkResponseFormat(fileName, actualReponse, expectedResponse) {
  const actualResponseKeys = extractKeys(actualReponse);
  const expectedResponseKeys = extractKeys(expectedResponse);
  const missingKeys = expectedResponseKeys.filter((key) => !actualResponseKeys.includes(key));
  if ((fileName === 'get-dynamic-fee.io' || fileName === 'get-access-list.io') && missingKeys[0] === 'result.v') {
    return [];
  }

  return missingKeys;
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

function formatTransactionByHashAndReceiptRequests(fileName, request) {
  /**
   * Formats a specific request by incorporating actual transaction and block hashes based on the provided file name.
   *
   * @param {string} fileName - The name of the file being processed.
   * @param {Object} request - The specific request to be formatted.
   * @returns {Object} - The formatted request containing updated transaction and block hashes.
   */
  switch (fileName) {
    case 'get-access-list.io':
      request.params[0] = transaction2930AndBlockHash.transactionHash;
      break;
    case 'get-dynamic-fee.io':
      request.params[0] = transaction1559AndBlockHash.transactionHash;
      break;
    case 'get-empty-tx.io':
      request.params[0] = '0x0000000000000000000000000000000000000000000000000000000000000000';
      break;
    case 'get-legacy-create.io':
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case 'get-legacy-input.io':
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case 'get-legacy-contract.io':
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case 'get-legacy-tx.io':
      request.params[0] = legacyTransactionAndBlockHash.transactionHash;
      break;
    case 'get-legacy-receipt.io':
      request.params[0] = legacyTransactionAndBlockHash.transactionHash;
      break;
    case 'get-notfound-tx.io':
      request.params[0] = '0x00000000000000000000000000000000000000000000000000000000deadbeef';
      break;
  }
  return request;
}

async function processFileContent(file, content) {
  /**
   * Processes a file from the execution apis repo
   * containing test request and response data.
   *
   * @param {string} file - The name of the file being processed.
   * @param {Object} content - The content of the file, consisting of request and response data.
   * @returns {Array<string>} - An array of missing keys in the response data.
   */
  console.log('Executing for ', file);
  const modifiedRequest = await checkRequestBody(file, JSON.parse(content.request));
  const response = await sendRequestToRelay(modifiedRequest);
  const missingKeys = checkResponseFormat(file, response, JSON.parse(content.response));

  return missingKeys;
}

describe('@api-conformity Ethereum execution apis tests', function () {
  before(async () => {
    legacyTransactionAndBlockHash = await signAndSendRawTransaction(legacyTransaction);
    transaction2930AndBlockHash = await signAndSendRawTransaction(transaction2930);
    transaction1559AndBlockHash = await signAndSendRawTransaction(transaction1559);
    createContractLegacyTransactionAndBlockHash = await signAndSendRawTransaction(createContractLegacyTransaction);
    currentBlockHash = await getLatestBlockHash();
  });
  //Reading the directories within the ethereum execution api repo
  let directories = fs.readdirSync(directoryPath);

  const relaySupportedMethodNames = openRpcData.methods.map((method) => method.name);

  //Filtering in order to use only the tests for methods we support in our relay
  directories = directories.filter((directory) => relaySupportedMethodNames.includes(directory));

  for (const directory of directories) {
    const filePath = path.join(directoryPath, directory);

    if (fs.statSync(filePath).isDirectory()) {
      const files = fs.readdirSync(path.resolve(directoryPath, directory));
      for (const file of files) {
        it(`Executing for ${directory}`, async () => {
          const data = fs.readFileSync(path.resolve(directoryPath, directory, file));
          const content = splitReqAndRes(data.toString('utf-8'));
          const missingKeys = await processFileContent(file, content);
          expect(missingKeys).to.be.empty;
        });
      }
    }
  }
});
