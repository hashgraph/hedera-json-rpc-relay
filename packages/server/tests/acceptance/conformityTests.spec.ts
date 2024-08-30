/*
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import fs from 'fs';
import { bytecode } from '../contracts/Basic.json';
import path from 'path';
const directoryPath = path.resolve(__dirname, '../../../../node_modules/execution-apis/tests');
import axios from 'axios';
import openRpcData from '../../../../docs/openrpc.json';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { signTransaction } from '../../../relay/tests/helpers';
import { expect } from 'chai';
import { config } from 'dotenv';
import WebSocket from 'ws';
import LogsContract from '../contracts/Logs.json';
import CallerContract from '../contracts/Caller.json';
config();

let currentBlockHash;
let legacyTransactionAndBlockHash;
let transaction2930AndBlockHash;
let transaction1559AndBlockHash;
let createContractLegacyTransactionAndBlockHash;
const sendAccountAddress = '0xc37f417fA09933335240FCA72DD257BFBdE9C275';
const receiveAccountAddress = '0x67D8d32E9Bf1a9968a5ff53B87d777Aa8EBBEe69';
const relayUrl = 'http://127.0.0.1:7546';
const wsRelayUrl = 'ws://127.0.0.1:8546';
const gasPrice = '0x2C68AF0BB14000';
const gasLimit = '0x3D090';
const value = '0x2E90EDD000';
const localNodeAccountPrivateKey = '0x6e9d61a325be3f6675cf8b7676c70e4a004d2308e3e182370a41f5653d52c6bd';
const ACCESS_LIST_FILE_NAME = 'get-access-list.io';
const DYNAMIC_FEE_FILE_NAME = 'get-dynamic-fee.io';
const EMPTY_TX_FILE_NAME = 'get-empty-tx.io';
const LEGACY_CREATE_FILE_NAME = 'get-legacy-create.io';
const LEGACY_INPUT_FILE_NAME = 'get-legacy-input.io';
const LEGACY_CONTRACT_FILE_NAME = 'get-legacy-contract.io';
const LEGACY_TX_FILE_NAME = 'get-legacy-tx.io';
const LEGACY_RECEIPT_FILE_NAME = 'get-legacy-receipt.io';
const NOT_FOUND_TX_FILE_NAME = 'get-notfound-tx.io';
const ETHEREUM_NETWORK_BLOCK_HASH = '0xac5c61edb087a51279674fe01d5c1f65eac3fd8597f9bea215058e745df8088e';
const ETHEREUM_NETWORK_SIGNED_TRANSACTION =
  '0xf86709843b9aca018261a894aa000000000000000000000000000000000000000a825544820a95a0281582922adf6475f5b2241f0a4f886dafa947ecdc5913703b7840344a566b45a05f685fc099161126637a12308f278a8cd162788a6c6d5aee4d425cde261ba35d';
const ETHEREUM_NETWORK_ACCOUNT_HASH = '0x5C41A21F14cFe9808cBEc1d91b55Ba75ed327Eb6';
const EMPTY_TX_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const NONEXISTENT_TX_HASH = '0x00000000000000000000000000000000000000000000000000000000deadbeef';
const ajv = new Ajv({ strict: false });
addFormats(ajv);
let execApisOpenRpcData;
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

  const response = await sendRequestToRelay(request, false);

  return response.result;
}

async function getLatestBlockHash() {
  const request = {
    jsonrpc: '2.0',
    method: 'eth_getBlockByNumber',
    params: ['latest', false],
    id: 0,
  };

  const response = await sendRequestToRelay(request, false);

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
  const filteredLines = lines.filter((line) => line != '' && !line.startsWith('//')).map((line) => line.slice(3));

  return { request: filteredLines[0], response: filteredLines[1] };
}

async function sendRequestToRelay(request, needError) {
  try {
    const response = await axios.post(relayUrl, request);
    return response.data;
  } catch (error) {
    console.error(error);
    if (needError) {
      return error;
    } else {
      throw error;
    }
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

  const response = await sendRequestToRelay(request, false);
  const requestTransactionReceipt = {
    id: 'test_id',
    jsonrpc: '2.0',
    method: 'eth_getTransactionReceipt',
    params: [response.result],
  };
  const transactionReceipt = await sendRequestToRelay(requestTransactionReceipt, false);
  return {
    transactionHash: response.result,
    blockHash: transactionReceipt.result.blockHash,
    transactionIndex: transactionReceipt.result.transactionIndex,
    blockNumber: transactionReceipt.result.blockNumber,
    contractAddress: transactionReceipt.result.contractAddress,
  };
}

async function checkRequestBody(fileName, request) {
  /**
   * Modifies a request object for compatability with our network.
   *
   * @param {string} fileName - The name of the file associated with the request.
   * @param {Object} request - The request object to be modified.
   * @returns {Object} - The modified request object.
   */
  if (
    (request.method === 'eth_getBlockByHash' && request.params[0] === ETHEREUM_NETWORK_BLOCK_HASH) ||
    (request.method === 'eth_sendRawTransaction' && request.params[0] === ETHEREUM_NETWORK_SIGNED_TRANSACTION)
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
    if (request.params[0] === ETHEREUM_NETWORK_SIGNED_TRANSACTION) {
      request.params[0] = currentBlockHash;
    } else {
      legacyTransaction.nonce = parseInt(await getTransactionCount(), 16);
      const transactionHash = await signTransaction(legacyTransaction, localNodeAccountPrivateKey);
      request.params[0] = transactionHash;
    }
  }
  if (request.method === 'eth_getBalance') {
    request.params[0] = ETHEREUM_NETWORK_ACCOUNT_HASH;
    request.params[1] = currentBlockHash;
  }
  if (request.method === 'eth_getTransactionByHash' || request.method === 'eth_getTransactionReceipt') {
    request = formatTransactionByHashAndReceiptRequests(fileName, request);
  }
  return request;
}

function checkResponseFormat(actualReponse, expectedResponse) {
  const actualResponseKeys = extractKeys(actualReponse);
  const expectedResponseKeys = extractKeys(expectedResponse);
  const missingKeys = expectedResponseKeys.filter((key) => !actualResponseKeys.includes(key));
  if (missingKeys.length > 0) {
    return true;
  } else {
    return false;
  }
}

function findSchema(file) {
  const schema = execApisOpenRpcData.methods.find((method) => method.name === file)?.result?.schema;

  return schema;
}

function isResponseValid(schema, response) {
  const validate = ajv.compile(schema);
  const valid = validate(response.result);

  expect(validate.errors).to.be.null;

  return valid;
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
    case ACCESS_LIST_FILE_NAME:
      request.params[0] = transaction2930AndBlockHash.transactionHash;
      break;
    case DYNAMIC_FEE_FILE_NAME:
      request.params[0] = transaction1559AndBlockHash.transactionHash;
      break;
    case EMPTY_TX_FILE_NAME:
      request.params[0] = EMPTY_TX_HASH;
      break;
    case LEGACY_CREATE_FILE_NAME:
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case LEGACY_INPUT_FILE_NAME:
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case LEGACY_CONTRACT_FILE_NAME:
      request.params[0] = createContractLegacyTransactionAndBlockHash.transactionHash;
      break;
    case LEGACY_TX_FILE_NAME:
      request.params[0] = legacyTransactionAndBlockHash.transactionHash;
      break;
    case LEGACY_RECEIPT_FILE_NAME:
      request.params[0] = legacyTransactionAndBlockHash.transactionHash;
      break;
    case NOT_FOUND_TX_FILE_NAME:
      request.params[0] = NONEXISTENT_TX_HASH;
      break;
  }
  return request;
}

async function processFileContent(directory, file, content) {
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
  const needError = JSON.parse(content.response).error;
  const response = await sendRequestToRelay(modifiedRequest, needError);
  const schema = findSchema(directory);
  const valid = needError
    ? checkResponseFormat(response.response.data, content.response)
    : isResponseValid(schema, response);
  expect(valid).to.be.true;
}

describe('@api-conformity @conformity-batch-1 Ethereum execution apis tests', function () {
  this.timeout(240 * 1000);
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
        it(`Executing for ${directory} and ${file}`, async () => {
          //We are excluding these directories, since these tests in execution-apis repos
          //use set of contracts which are not deployed on our network
          if (directory === 'eth_getLogs' || directory === 'eth_call' || directory === 'eth_estimateGas') {
            return;
          }
          execApisOpenRpcData = require('../../../../openrpc_exec_apis.json');
          //Currently, we do not support blobs
          if (file.includes('blob')) {
            return;
          }
          const data = fs.readFileSync(path.resolve(directoryPath, directory, file));
          const content = splitReqAndRes(data.toString('utf-8'));
          await processFileContent(directory, file, content);
        });
      }
    }
  }
});

const synthesizeTestCases = (testCases, updateParamIfNeeded) => {
  for (const testName in testCases) {
    it(`${testName}`, async () => {
      const isErrorStatusExpected: boolean = !!(testCases[testName]?.status && testCases[testName].status != 200);
      try {
        const req = updateParamIfNeeded(testName, JSON.parse(testCases[testName].request));
        const res = await sendRequestToRelay(req, false);
        const hasMissingKeys: boolean = checkResponseFormat(res, JSON.parse(testCases[testName].response));
        expect(hasMissingKeys).to.be.false;
        expect(isErrorStatusExpected).to.be.false;
      } catch (e: any) {
        expect(isErrorStatusExpected).to.be.true;
        expect(e?.response?.status).to.equal(testCases[testName].status);
      }
    });
  }
};

describe('@api-conformity @conformity-batch-2 Ethereum execution apis tests', async function () {
  this.timeout(240 * 1000);

  let existingBlockFilter: string;
  let existingContractFilter: string;

  before(async () => {
    existingBlockFilter = (
      await sendRequestToRelay(
        {
          jsonrpc: '2.0',
          method: 'eth_newBlockFilter',
          params: [],
          id: 1,
        },
        false,
      )
    ).result;

    const deployLogsContractTx = await signAndSendRawTransaction({
      chainId: 0x12a,
      to: null,
      from: sendAccountAddress,
      maxPriorityFeePerGas: gasPrice,
      maxFeePerGas: gasPrice,
      gasLimit: gasLimit,
      type: 2,
      data: LogsContract.bytecode,
    });

    existingContractFilter = (
      await sendRequestToRelay(
        {
          jsonrpc: '2.0',
          method: 'eth_newFilter',
          params: [
            {
              fromBlock: '0x1',
              toBlock: '0x160c',
              address: deployLogsContractTx.contractAddress,
            },
          ],
          id: 1,
        },
        false,
      )
    ).result;
  });

  const TEST_CASES = {
    eth_submitHashrate: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_submitHashrate"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_sign: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_sign"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_signTransaction: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_signTransaction"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_sendTransaction: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_sendTransaction"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_protocolVersion: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_protocolVersion"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_newPendingTransactionFilter: {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_newPendingTransactionFilter"}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32601}}',
    },
    eth_newBlockFilter: {
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_newBlockFilter"}',
      response: '{"jsonrpc":"2.0","id":1,"result":"0x33f5c9d2974eea142909a19906ef0548"}',
    },
    'eth_getFilterChanges - existing filter': {
      request:
        '{"jsonrpc":"2.0","id":1,"method":"eth_getFilterChanges","params":["0xb5c45fa0ece1ff79b115fc7cc490655b"]}',
      response:
        '{"jsonrpc":"2.0","id":1,"result":["0xc926f266c4a93e01cf6df220b5902b032adb38d70626835d8f53c9f8a648d747dd651af5e9c64201aad121a93c2304c4"]}',
    },
    'eth_getFilterChanges - no existing filter': {
      status: 400,
      request:
        '{"jsonrpc":"2.0","id":1,"method":"eth_getFilterChanges","params":["0x275220eef57cfbc06e932e043535d492"]}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32001}}',
    },
    eth_uninstallFilter: {
      request:
        '{"jsonrpc":"2.0","id":1,"method":"eth_uninstallFilter","params":["0x275220eef57cfbc06e932e043535d492"]}',
      response: '{"jsonrpc":"2.0","id":1,"result":false}',
    },
    eth_newFilter: {
      request:
        '{"jsonrpc":"2.0","id":1,"method":"eth_newFilter","params":[{"fromBlock": "0x1","toBlock": "0x160c","address": "0x281723C907113cbdEe8785F3480dD7496315312c"}]}',
      response: '{"jsonrpc":"2.0","id":1,"result":"0xd569b8fad2873edebd3033831f790dee"}',
    },
    'eth_getFilterLogs - existing filter': {
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_getFilterLogs","params":["0x65d84e9904db339e6a85340b9f7c3d3e"]}',
      response: '{"jsonrpc":"2.0","id":1,"result":[]}',
    },
    'eth_getFilterLogs - no existing filter': {
      status: 400,
      request: '{"jsonrpc":"2.0","id":1,"method":"eth_getFilterLogs","params":["0xb567d26e162027d80fd434e3bc3d6897"]}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32001}}',
    },
  };

  const updateParamIfNeeded = (testName, request) => {
    switch (testName) {
      case 'eth_getFilterChanges - existing filter':
        request.params = [existingBlockFilter];
        break;
      case 'eth_getFilterLogs - existing filter':
        request.params = [existingContractFilter];
        break;
    }

    return request;
  };

  synthesizeTestCases(TEST_CASES, updateParamIfNeeded);
});

describe('@api-conformity @conformity-batch-3 Ethereum execution apis tests', async function () {
  this.timeout(240 * 1000);

  let txHash;

  before(async () => {
    txHash = (await signAndSendRawTransaction(transaction1559)).transactionHash;
  });

  const TEST_CASES = {
    eth_submitWork: {
      request:
        '{"jsonrpc":"2.0", "method":"eth_submitWork","params":["0x0000000000000001","0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef","0xD1FE5700000000000000000000000000D1FE5700000000000000000000000000"],"id":1}',
      response: '{"jsonrpc":"2.0","id":1,"result":false}',
    },
    net_listening: {
      request: '{"jsonrpc":"2.0","id":1,"method":"net_listening","params":[]}',
      response: '{"jsonrpc":"2.0","id":1,"result":"false"}',
    },
    net_version: {
      request: '{"jsonrpc":"2.0","id":1,"method":"net_version","params":[]}',
      response: '{"jsonrpc":"2.0","id":1,"result":"298"}',
    },
    web3_clientVersion: {
      request: '{"jsonrpc":"2.0","id":1,"method":"web3_clientVersion","params":[]}',
      response: '{"jsonrpc":"2.0","id":1,"result":"relay/0.55.0-SNAPSHOT"}',
    },
    'debug_traceTransaction - existing tx': {
      request:
        '{"jsonrpc":"2.0","method":"debug_traceTransaction","params":["0x75a7d81c08d33daf327635bd62b7ecaf33c6d3c8cc17d8b19224e7f3e6811cb8",{"tracer":"callTracer","tracerConfig":{"onlyTopCall":true}}],"id":1}',
      response:
        '{"result":{"type":"CALL","from":"0xc37f417fa09933335240fca72dd257bfbde9c275","to":"0x67d8d32e9bf1a9968a5ff53b87d777aa8ebbee69","value":"0x14","gas":"0x3d090","gasUsed":"0x30d40","input":"0x","output":"0x"},"jsonrpc":"2.0","id":1}',
    },
    'debug_traceTransaction - no existing tx': {
      status: 400,
      request:
        '{"jsonrpc":"2.0","method":"debug_traceTransaction","params":["0x75a7d81c08d33daf327635bd62b7ecaf33c6d3c8cc17d8b19224e7f3e6811cb8",{"tracer":"callTracer","tracerConfig":{"onlyTopCall":true}}],"id":1}',
      response: '{"jsonrpc":"2.0","id":1,"error":{"code":-32001}}',
    },
  };

  const updateParamIfNeeded = (testName, request) => {
    switch (testName) {
      case 'debug_traceTransaction - existing tx':
        request.params = [
          txHash,
          {
            tracer: 'callTracer',
            tracerConfig: {
              onlyTopCall: true,
            },
          },
        ];
        break;
    }

    return request;
  };

  synthesizeTestCases(TEST_CASES, updateParamIfNeeded);

  describe('ws related rpc methods', async function () {
    let webSocket: WebSocket;
    let contractAddress: string;

    before(async () => {
      contractAddress = (
        await signAndSendRawTransaction({
          chainId: 0x12a,
          to: null,
          from: sendAccountAddress,
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: gasLimit,
          type: 2,
          data: CallerContract.bytecode,
        })
      ).contractAddress;
    });

    beforeEach(() => {
      webSocket = new WebSocket(wsRelayUrl);
    });

    afterEach(() => {
      webSocket.close();
    });

    const TEST_CASES = {
      'eth_subscribe - newPendingTransactions': {
        request: '{"jsonrpc":"2.0","method":"eth_subscribe","params":["newPendingTransactions"],"id":1}',
        response: '{"error":{"code":-32601,"message":"Unsupported JSON-RPC method"},"jsonrpc":"2.0","id":1}',
      },
      'eth_subscribe - non existing contract': {
        request:
          '{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["logs",{"address":"0x678d3e4c7b6b8e9617e9b3487352ec63c54dbf81"}]}',
        response: '{"error":{"code":-32602},"jsonrpc":"2.0","id":1}',
      },
      'eth_subscribe - existing contract': {
        request:
          '{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["logs",{"address":"0x12833e4c7a6b1e9512e9a32873321c13cb4dbfef"}]}',
        response: '{"result":"0xa4e1803ab025341ed7668eb13ca71f3c","jsonrpc":"2.0","id":1}',
      },
      eth_unsubscribe: {
        request: '{"jsonrpc":"2.0","method":"eth_unsubscribe","params":["0x2c9c38d1200d30208fcdad52ed71fbff"],"id":1}',
        response: '{"result":false,"jsonrpc":"2.0","id":1}',
      },
    };

    const updateParamIfNeeded = (testName, request) => {
      switch (testName) {
        case 'eth_subscribe - existing contract':
          request.params = [
            'logs',
            {
              address: contractAddress,
            },
          ];
          break;
      }

      return request;
    };

    const synthesizeWsTestCases = (testCases, updateParamIfNeeded) => {
      for (const testName in testCases) {
        it(`${testName}`, async () => {
          const req = updateParamIfNeeded(testName, JSON.parse(testCases[testName].request));

          let response: any = {};
          webSocket.on('message', function incoming(data) {
            response = JSON.parse(data);
          });
          webSocket.on('open', function open() {
            webSocket.send(JSON.stringify(req));
          });
          await new Promise((r) => setTimeout(r, 500));

          const hasMissingKeys: boolean = checkResponseFormat(response, JSON.parse(testCases[testName].response));
          expect(hasMissingKeys).to.be.false;
        });
      }
    };

    synthesizeWsTestCases(TEST_CASES, updateParamIfNeeded);
  });
});
