import fs from 'fs';
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
  data: '0x608060405234801561001057600080fd5b506040516105fc3803806105fc83398101604081905261002f9161015f565b8051610042906000906020840190610080565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f0681604051610072919061020b565b60405180910390a150610279565b82805461008c9061023e565b90600052602060002090601f0160209004810192826100ae57600085556100f4565b82601f106100c757805160ff19168380011785556100f4565b828001600101855582156100f4579182015b828111156100f45782518255916020019190600101906100d9565b50610100929150610104565b5090565b5b808211156101005760008155600101610105565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561014a578181015183820152602001610132565b83811115610159576000848401525b50505050565b60006020828403121561017157600080fd5b81516001600160401b038082111561018857600080fd5b818401915084601f83011261019c57600080fd5b8151818111156101ae576101ae610119565b604051601f8201601f19908116603f011681019083821181831017156101d6576101d6610119565b816040528281528760208487010111156101ef57600080fd5b61020083602083016020880161012f565b979650505050505050565b602081526000825180602084015261022a81604085016020870161012f565b601f01601f19169190910160400192915050565b600181811c9082168061025257607f821691505b6020821081141561027357634e487b7160e01b600052602260045260246000fd5b50919050565b610374806102886000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a41368621461003b578063cfae321714610050575b600080fd5b61004e6100493660046101fd565b61006e565b005b6100586100bc565b60405161006591906102ae565b60405180910390f35b805161008190600090602084019061014e565b507fad181ee258ff92d26bf7ed2e6b571ef1cba3afc45f028b863b0f02adaffc2f06816040516100b191906102ae565b60405180910390a150565b6060600080546100cb90610303565b80601f01602080910402602001604051908101604052809291908181526020018280546100f790610303565b80156101445780601f1061011957610100808354040283529160200191610144565b820191906000526020600020905b81548152906001019060200180831161012757829003601f168201915b5050505050905090565b82805461015a90610303565b90600052602060002090601f01602090048101928261017c57600085556101c2565b82601f1061019557805160ff19168380011785556101c2565b828001600101855582156101c2579182015b828111156101c25782518255916020019190600101906101a7565b506101ce9291506101d2565b5090565b5b808211156101ce57600081556001016101d3565b634e487b7160e01b600052604160045260246000fd5b60006020828403121561020f57600080fd5b813567ffffffffffffffff8082111561022757600080fd5b818401915084601f83011261023b57600080fd5b81358181111561024d5761024d6101e7565b604051601f8201601f19908116603f01168101908382118183101715610275576102756101e7565b8160405282815287602084870101111561028e57600080fd5b826020860160208301376000928101602001929092525095945050505050565b600060208083528351808285015260005b818110156102db578581018301518582016040015282016102bf565b818111156102ed576000604083870101525b50601f01601f1916929092016040019392505050565b600181811c9082168061031757607f821691505b6020821081141561033857634e487b7160e01b600052602260045260246000fd5b5091905056fea2646970667358221220d450959bd13a5c79ab8546a400f6af65e1c3d24b6877b871e663861bbf17234664736f6c63430008090033000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000076e696b6f6c617900000000000000000000000000000000000000000000000000',
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
  const transactionCount = await getTransactionCount();
  transaction.nonce = parseInt(transactionCount, 16);
  const signed = await signTransaction(
    transaction,
    '0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd',
  );
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
  //This method changes params for request which wont work with the values from ethereum api tests
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
    const transactionCount = await getTransactionCount();
    legacyTransaction.nonce = parseInt(transactionCount, 16);
    const transactionHash = await signTransaction(
      legacyTransaction,
      '0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd',
    );
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
    return;
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

async function processFileContent(fileContent) {
  console.log('Executing for ', fileContent.fileName);
  const modifiedRequest = await checkRequestBody(fileContent.fileName, JSON.parse(fileContent.content.request));
  const response = await sendRequestToRelay(modifiedRequest);
  checkResponseFormat(fileContent.fileName, response, JSON.parse(fileContent.content.response));
}

describe('@api-conformity Ethereum execution apis tests', function () {
  before(async () => {
    legacyTransactionAndBlockHash = await signAndSendRawTransaction(legacyTransaction);
    transaction2930AndBlockHash = await signAndSendRawTransaction(transaction2930);
    transaction1559AndBlockHash = await signAndSendRawTransaction(transaction1559);
    createContractLegacyTransactionAndBlockHash = await signAndSendRawTransaction(createContractLegacyTransaction);
    currentBlockHash = await getLatestBlockHash();
  });

  let directories = fs.readdirSync(directoryPath);

  const relaySupportedMethodNames = openRpcData.methods.map((method) => method.name);
  directories = directories.filter((directory) => relaySupportedMethodNames.includes(directory));

  for (const directory of directories) {
    const filePath = path.join(directoryPath, directory);

    if (fs.statSync(filePath).isDirectory()) {
      const files = fs.readdirSync(path.resolve(directoryPath, directory));
      for (const file of files) {
        it(`Executing for ${file}`, async () => {
          const data = fs.readFileSync(path.resolve(directoryPath, directory, file));
          const missingKeys = processFileContent(file);
          expect(missingKeys).to.not.be.empty;
        });
      }
    }
  }
});
