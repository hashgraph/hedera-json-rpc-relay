/*-
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

import Axios, { AxiosInstance } from 'axios';
import { expect } from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import sinon from 'sinon';
import { Server } from 'http';
import { GCProfiler } from 'v8';
dotenv.config({ path: path.resolve(__dirname, './test.env') });

import Assertions from '../helpers/assertions';
import app from '../../src/server';
import { TracerType, Validator } from '../../src/validator';
import RelayCalls from '../../tests/helpers/constants';
import * as Constants from '../../src/validator/constants';
import { Utils } from '../helpers/utils';
import { predefined } from '@hashgraph/json-rpc-relay';
import { contractAddress1, contractAddress2, contractHash1, contractId1 } from '../../../relay/tests/helpers';
import { MirrorNodeClient } from '@hashgraph/json-rpc-relay/dist/lib/clients';

const MISSING_PARAM_ERROR = 'Missing value for required parameter';

describe('RPC Server', function () {
  let testServer: Server;
  let testClient: AxiosInstance;

  before(function () {
    testServer = app.listen(process.env.E2E_SERVER_PORT);
    testClient = BaseTest.createTestClient();
  });

  after(function () {
    testServer.close((err) => {
      if (err) {
        console.error(err);
      }
    });
  });

  // leak detection middleware
  if (process.env.MEMWATCH_ENABLED === 'true') {
    Utils.captureMemoryLeaks(new GCProfiler());
  }

  this.timeout(5000);

  it('should execute "eth_chainId"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
  });

  it('validates enforcement of request id', async function () {
    try {
      await testClient.post('/', {
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.invalidRequestSpecError(error.response, -32600, `Invalid Request`);
    }
  });

  xit('supports optionality of request id when configured', async function () {
    const app2 = require('../../src/server').default;
    const port = `1${process.env.E2E_SERVER_PORT}`;
    const testServer2 = app2.listen(port);
    const testClient2 = BaseTest.createTestClient(port);

    try {
      process.env.REQUEST_ID_IS_OPTIONAL = 'true';
      const response = await testClient2.post('/', {
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
        params: [null],
      });

      expect(response.status).to.eq(200);
      expect(response.statusText).to.eq('OK');
      expect(response, "Default response: Should have 'data' property").to.have.property('data');
      expect(response.data, "Default response: 'data' should have 'id' property").to.have.property('id');
      expect(response.data, "Default response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
      expect(response.data, "Default response: 'data' should have 'result' property").to.have.property('result');
      expect(response.data.id, "Default response: 'data.id' should equal '2'").to.be.equal('2');
      expect(response.data.jsonrpc, "Default response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
      expect(response.data.result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
    } catch (error: any) {
      expect(true, `Unexpected error: ${error.message}`).to.eq(false);
    }

    process.env.REQUEST_ID_IS_OPTIONAL = 'false';
    testServer2.close();
  });

  it('should execute "eth_accounts"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_ACCOUNTS,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.an('Array');
    expect(res.data.result.length).to.be.equal(0);
  });

  it('should execute "web3_clientVersion"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.WEB3_CLIENTVERSION,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('relay/' + process.env.npm_package_version);
  });

  it('should execute "eth_getTransactionByHash with missing transaction"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
        params: ['0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7237170ae5e5e7957eb6392'],
      });
    } catch (error: any) {
      expect(error.message).to.equal('Request failed with status code 500');
    }
  });

  it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_HASH,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_NUMBER,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_hashrate"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_HASH_RATE,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_mining"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_MINING,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_submitWork"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_WORK,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_syncing"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_SYNCING,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "net_listening"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.NET_LISTENING,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('false');
  });

  it('should execute "web3_sha"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.WEB3_SHA,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.methodNotFoundCheck(error.response, RelayCalls.ETH_ENDPOINTS.WEB3_SHA);
    }
  });

  it('should execute "net_peerCount"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.NET_PEER_COUNT,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.methodNotFoundCheck(error.response, RelayCalls.ETH_ENDPOINTS.NET_PEER_COUNT);
    }
  });

  it('should execute "eth_submitHashrate"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_HASH_RATE,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_signTypedData"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TYPED_DATA,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.methodNotFoundCheck(error.response, RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TYPED_DATA);
    }
  });

  it('should execute "eth_signTransaction"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TRANSACTION,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_sign"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_SIGN,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_sendTransaction"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_SEND_TRANSACTION,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_protocolVersion"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_PROTOCOL_VERSION,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_getProof"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_GET_PROOF,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.methodNotFoundCheck(error.response, RelayCalls.ETH_ENDPOINTS.ETH_GET_PROOF);
    }
  });

  it('should execute "eth_coinbase"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_COINBASE,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_getWork"', async function () {
    try {
      await testClient.post('/', {
        id: '2',
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_GET_WORK,
        params: [null],
      });

      Assertions.expectedError();
    } catch (error: any) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_maxPriorityFeePerGas"', async function () {
    const res = await testClient.post('/', {
      id: '2',
      jsonrpc: '2.0',
      method: RelayCalls.ETH_ENDPOINTS.ETH_MAX_PRIORITY_FEE_PER_GAS,
      params: [null],
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  describe('batchRequest Test Cases', async function () {
    const batchRequestEnabledValue = process.env.BATCH_REQUESTS_ENABLED;

    this.beforeAll(function () {
      process.env.BATCH_REQUESTS_ENABLED = 'true';
    });

    this.afterAll(function () {
      process.env.BATCH_REQUESTS_ENABLED = batchRequestEnabledValue;
    });

    function getEthChainIdRequest(id) {
      return {
        id: `${id}`,
        jsonrpc: '2.0',
        method: RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
        params: [null],
      };
    }

    function getEthAccountsRequest(id) {
      if (id == null) {
        return {
          jsonrpc: '2.0',
          method: RelayCalls.ETH_ENDPOINTS.ETH_ACCOUNTS,
          params: [null],
        };
      } else {
        return {
          id: `${id}`,
          jsonrpc: '2.0',
          method: RelayCalls.ETH_ENDPOINTS.ETH_ACCOUNTS,
          params: [null],
        };
      }
    }

    function getNonExistingMethodRequest(id) {
      return {
        id: `${id}`,
        jsonrpc: '2.0',
        method: 'non_existent_method',
        params: [null],
      };
    }

    it('should execute "eth_chainId" in batch request', async function () {
      // 3 request of eth_chainId
      const response = await testClient.post('/', [
        getEthChainIdRequest(2),
        getEthChainIdRequest(3),
        getEthChainIdRequest(4),
      ]);

      // verify response
      BaseTest.baseDefaultResponseChecks(response);

      // verify response for each request
      for (let i = 0; i < response.data.length; i++) {
        expect(response.data[i].id).to.be.equal((i + 2).toString());
        expect(response.data[i].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
      }
    });

    it('should execute "eth_chainId" and "eth_accounts" in batch request', async function () {
      // 3 request of eth_chainId
      const response = await testClient.post('/', [
        getEthChainIdRequest(2),
        getEthAccountsRequest(3),
        getEthChainIdRequest(4),
      ]);

      // verify response
      BaseTest.baseDefaultResponseChecks(response);

      // verify response for each result
      expect(response.data[0].id).to.be.equal('2');
      expect(response.data[0].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
      // verify eth_accounts result
      expect(response.data[1].id).to.be.equal('3');
      expect(response.data[1].result).to.be.an('Array');
      expect(response.data[1].result.length).to.be.equal(0);
      // verify eth_chainId result
      expect(response.data[2].id).to.be.equal('4');
      expect(response.data[2].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
    });

    it('should execute "eth_chainId" and "eth_accounts" in batch request with invalid request id', async function () {
      const response = await testClient.post('/', [getEthChainIdRequest(2), getEthAccountsRequest(null)]);

      // verify response
      BaseTest.baseDefaultResponseChecks(response);

      // verify response for each result
      expect(response.data[0].id).to.be.equal('2');
      expect(response.data[0].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
      // verify eth_accounts result
      expect(response.data[1].id).to.be.equal(null);
      expect(response.data[1].error).to.be.an('Object');
      expect(response.data[1].error.code).to.be.equal(-32600);
      expect(response.data[1].error.message).to.be.equal('Invalid Request');
    });

    it('should execute "eth_chainId" and method not found in batch request', async function () {
      const response = await testClient.post('/', [
        getEthChainIdRequest(2),
        getNonExistingMethodRequest(3),
        getEthChainIdRequest(4),
      ]);

      // verify response
      BaseTest.baseDefaultResponseChecks(response);

      // verify eth_chainId result on position 0
      expect(response.data[0].id).to.be.equal('2');
      expect(response.data[0].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
      // verify method not found error on position 1
      expect(response.data[1].id).to.be.equal('3');
      expect(response.data[1].error).to.be.an('Object');
      expect(response.data[1].error.code).to.be.equal(-32601);
      expect(response.data[1].error.message).to.be.equal('Method non_existent_method not found');
      // verify eth_chainId result on position 2
      expect(response.data[2].id).to.be.equal('4');
      expect(response.data[2].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
    });

    it('should execute "eth_chainId" and method not found and params error in batch request', async function () {
      const response = await testClient.post('/', [
        getEthChainIdRequest(2),
        getNonExistingMethodRequest(3),
        {
          id: '4',
          jsonrpc: '2.0',
          method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
          params: [null],
        },
      ]);

      // verify response
      BaseTest.baseDefaultResponseChecks(response);

      // verify eth_chainId result on position 0
      expect(response.data[0].id).to.be.equal('2');
      expect(response.data[0].result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
      // verify method not found error on position 1
      expect(response.data[1].id).to.be.equal('3');
      expect(response.data[1].error).to.be.an('Object');
      expect(response.data[1].error.code).to.be.equal(-32601);
      expect(response.data[1].error.message).to.be.equal('Method non_existent_method not found');
      // verify
      expect(response.data[2].id).to.be.equal('4');
      expect(response.data[2].error).to.be.an('Object');
      expect(response.data[2].error.code).to.be.equal(-32602);
      expect(
        response.data[2].error.message.endsWith('Invalid parameter 0: The value passed is not valid: null.'),
        'Invalid parameter 0: The value passed is not valid: null.',
      ).to.be.equal(true);
    });

    it('should hit batch request limit', async function () {
      // prepare 101 requests chain id requests
      const requests: any[] = [];
      for (let i = 0; i < 101; i++) {
        requests.push(getEthChainIdRequest(i + 1));
      }

      // execute batch request
      try {
        await testClient.post('/', requests);
        Assertions.expectedError();
      } catch (error: any) {
        BaseTest.batchRequestLimitError(error.response, requests.length, 100);
      }
    });

    it('should not execute batch request when disabled', async function () {
      // disable batch request
      process.env.BATCH_REQUESTS_ENABLED = 'false';

      // do batch request
      try {
        await testClient.post('/', [getEthChainIdRequest(2), getEthAccountsRequest(3), getEthChainIdRequest(4)]);
        Assertions.expectedError();
      } catch (error: any) {
        BaseTest.batchDisabledErrorCheck(error.response);
      }

      // enable batch request again
      process.env.BATCH_REQUESTS_ENABLED = 'true';
    });

    it('batch request be disabled by default', async function () {
      // disable batch request
      process.env.BATCH_REQUESTS_ENABLED = undefined;

      // do batch request
      try {
        await testClient.post('/', [getEthChainIdRequest(2), getEthAccountsRequest(3), getEthChainIdRequest(4)]);
        Assertions.expectedError();
      } catch (error: any) {
        BaseTest.batchDisabledErrorCheck(error.response);
      }

      // enable batch requests again
      process.env.BATCH_REQUESTS_ENABLED = 'true';
    });
  });

  describe('Validator', async function () {
    describe('eth_estimateGas', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is TransactionObject', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: ['0x0'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, 'Expected TransactionObject, value: 0x0');
        }
      });

      it('validates Transaction `to` param is address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ to: '0x1' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'to' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`,
          );
        }
      });

      it('validates Transaction `from` param is address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ from: '0x1' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'from' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`,
          );
        }
      });

      it('validates Transaction `gas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ gas: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'gas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `gasPrice` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ gasPrice: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'gasPrice' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ maxPriorityFeePerGas: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'maxPriorityFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `maxFeePerGas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ maxFeePerGas: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'maxFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `value` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ value: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'value' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `data` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ data: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'data' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Block param is valid block hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, '123'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
          );
        }
      });

      it('validates Block param is valid tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`,
          );
        }
      });
    });

    describe('eth_getBalance', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is of type Address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            params: ['0x0'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, Validator.ADDRESS_ERROR + ', value: 0x0');
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            params: ['0x0000000000000000000000000000000000000001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            params: ['0x0000000000000000000000000000000000000001', '123'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `The value passed is not valid: 123. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });

      it('validates parameter 1 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            params: ['0x0000000000000000000000000000000000000001', 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `The value passed is not valid: newest. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });
    });

    describe('eth_getCode', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            params: ['0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            params: ['0x0000000000000000000000000000000000000001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            params: ['0x0000000000000000000000000000000000000001', '123'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: The value passed is not valid: 123. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });

      it('validates parameter 1 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: 'eth_getCode',
            params: ['0x0000000000000000000000000000000000000001', 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: The value passed is not valid: newest. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });
    });

    describe('eth_getBlockByNumber', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            params: [1],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 1`,
          );
        }
      });

      it('validates parameter 0 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            params: ['newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            params: ['0x1'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is boolean', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            params: ['0x1', 'true'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: Expected boolean type, value: true`,
          );
        }
      });
    });

    describe('eth_getBlockByHash', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is a block hash', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            params: ['0x1'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            params: ['0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is boolean', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            params: ['0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6', 'true'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: Expected boolean type, value: true`,
          );
        }
      });
    });

    describe('eth_getTransactionCount', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is an address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            params: ['0x0001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0x0001`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            params: ['0x0000000000000000000000000000000000000001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is a valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            params: ['0x0000000000000000000000000000000000000001', 123],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: The value passed is not valid: 123. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });

      it('validates parameter 1 is a valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            params: ['0x0000000000000000000000000000000000000001', 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: The value passed is not valid: newest. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });
    });

    describe('eth_call', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is TransactionObject', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: ['0x0'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, 'Expected TransactionObject, value: 0x0');
        }
      });

      it('validates Transaction `to` param is address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ to: '0x1' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'to' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`,
          );
        }
      });

      it('validates Transaction `from` param is address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ from: '0x1' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'from' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`,
          );
        }
      });

      it('validates Transaction `gas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ gas: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'gas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `gasPrice` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ gasPrice: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'gasPrice' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ maxPriorityFeePerGas: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'maxPriorityFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `maxFeePerGas` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ maxFeePerGas: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'maxFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `value` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ value: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'value' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Transaction `data` param is hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ data: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'data' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`,
          );
        }
      });

      it('validates Block param is non valid block hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, '123'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.BLOCK_PARAMS_ERROR}, value: 123`,
          );
        }
      });

      it('validates Block param is non valid tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.BLOCK_PARAMS_ERROR}, value: newest`,
          );
        }
      });

      it('validates Block param is non valid block hash', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, { blockHash: '0x123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'blockHash' for BlockHashObject: ${Validator.BLOCK_HASH_ERROR}, value: 0x123`,
          );
        }
      });

      it('validates Block param is non valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            params: [{ to: '0x0000000000000000000000000000000000000001' }, { blockNumber: '123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'blockNumber' for BlockNumberObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
          );
        }
      });
    });

    describe('eth_sendRawTransaction', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
            params: ['f868'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.DEFAULT_HEX_ERROR}, value: f868`,
          );
        }
      });
    });

    describe('eth_getTransactionByHash', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block hash', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });
    });

    describe('eth_feeHistory', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            params: ['0x5'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 2 is array', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            params: ['0x5', 'latest', {}],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: Expected Array, value: {}`,
          );
        }
      });
    });

    describe('eth_getBlockTransactionCountByHash', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block hash', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
            params: ['0x1234'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1234`,
          );
        }
      });
    });

    describe('eth_getBlockTransactionCountByNumber', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            params: ['1234'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 1234`,
          );
        }
      });

      it('validates parameter 0 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            params: ['newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`,
          );
        }
      });
    });

    describe('eth_getStorageAt', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid address', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0000000000000000000000000000000000000001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0000000000000000000000000000000000000001`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0x0000000000000000000000000000000000000001'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0x0000000000000000000000000000000000000001', 1234],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.HASH_ERROR}, value: 1234`,
          );
        }
      });

      it('validates parameter 2 is valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0x0000000000000000000000000000000000000001', '0x1', 123],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: The value passed is not valid: 123. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });

      it('validates parameter 2 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0x0000000000000000000000000000000000000001', '0x1', 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: The value passed is not valid: newest. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });

      it('validates parameter 2 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            params: ['0x0000000000000000000000000000000000000001', '0x1', 'newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: The value passed is not valid: newest. ${Constants.BLOCK_NUMBER_ERROR} OR ${Constants.BLOCK_HASH_ERROR}`,
          );
        }
      });
    });

    describe('eth_getTransactionByBlockHashAndIndex', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block hash', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            params: ['0x1a2b3c'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1a2b3c`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            params: ['0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: 'eth_getTransactionByBlockHashAndIndex',
            params: ['0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35', '08'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}, value: 08`,
          );
        }
      });
    });

    describe('eth_getTransactionByBlockNumberAndIndex', async function () {
      it('validates parameter 0 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            params: [],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block number', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            params: [123],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
          );
        }
      });

      it('validates parameter 0 is valid block tag', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            params: ['newest'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`,
          );
        }
      });

      it('validates parameter 1 exists', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            params: ['0x5BAD55'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            params: ['0x5BAD55', '08'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}, value: 08`,
          );
        }
      });
    });

    describe('eth_getLogs', async () => {
      it('validates parameter 0 is Filter Object', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: ['0x1'],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: ${Validator.TYPES['filter'].error}, value: 0x1`,
          );
        }
      });

      it('validates parameter Filter Object does not contain both block hash and fromBlock/toBlock', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ blockHash: '0x123', toBlock: 'latest' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: Can't use both blockHash and toBlock/fromBlock`,
          );
        }
      });

      it('validates blockHash filter', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ blockHash: '0x123' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'blockHash' for FilterObject: ${Validator.BLOCK_HASH_ERROR}, value: 0x123`,
          );
        }
      });

      it('validates toBlock filter', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ toBlock: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'toBlock' for FilterObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
          );
        }
      });

      it('validates toBlock filter', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ fromBlock: 123 }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'fromBlock' for FilterObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`,
          );
        }
      });

      it('validates address filter', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ address: '0x012345' }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'address' for FilterObject: ${Validator.TYPES.addressFilter.error}, value: 0x012345`,
          );
        }
      });

      it('validates topics filter is array', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ topics: {} }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: {}`,
          );
        }
      });

      it('validates topics filter is array of topic hashes', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ topics: [123] }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: [123]`,
          );
        }
      });

      it('validates topics filter is array of array of topic hashes', async function () {
        try {
          await testClient.post('/', {
            id: '2',
            jsonrpc: '2.0',
            method: RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            params: [{ topics: [[123]] }],
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: [[123]]`,
          );
        }
      });

      it('should execute HTTP OPTIONS cors preflight check', async function () {
        const response = await testClient.options('/');

        BaseTest.validResponseCheck(response, { status: 204, statusText: 'No Content' });
        BaseTest.validCorsCheck(response);
      });

      it('should execute metrics collection', async function () {
        const response = await testClient.get('/metrics');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
      });

      it('should execute successful health readiness check', async function () {
        const response = await testClient.get('/health/readiness');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
        expect(response, "Default response: Should have 'data' property").to.have.property('data');
        expect(response.data, "Default response: 'data' should equal 'OK'").to.be.equal('OK');
      });

      it('should execute successful health liveness check', async function () {
        const response = await testClient.get('/health/readiness');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
        expect(response, "Default response: Should have 'data' property").to.have.property('data');
        expect(response.data, "Default response: 'data' should equal 'OK'").to.be.equal('OK');
      });
    });

    describe('debug_traceTransaction', async function () {
      const contractResult = {
        address: contractAddress1,
        amount: 0,
        call_result: '0x2',
        error_message: null,
        from: contractAddress2,
        function_parameters: '0x1',
        gas_limit: 300000,
        gas_used: 240000,
        result: 'SUCCESS',
      };

      const contractActions = {
        actions: [
          {
            call_depth: 0,
            call_operation_type: 'CREATE',
            call_type: 'CREATE',
            caller: '0.0.1016',
            caller_type: 'ACCOUNT',
            from: '0x00000000000000000000000000000000000003f8',
            gas: 247000,
            gas_used: 77324,
            index: 0,
            input: '0x',
            recipient: '0.0.1033',
            recipient_type: 'CONTRACT',
            result_data: '0x',
            result_data_type: 'OUTPUT',
            timestamp: '1696438011.462526383',
            to: '0x0000000000000000000000000000000000000409',
            value: 0,
          },
        ],
      };

      const contractOpcodes = {
        address: contractAddress1,
        contract_id: contractId1,
        gas: 247000,
        failed: false,
        return_value: '0x2',
        opcodes: [
          {
            pc: 0,
            op: 'PUSH1',
            gas: 247000,
            gas_cost: 3,
            depth: 0,
            stack: [],
            storage: {},
            memory: [],
          },
        ],
      };

      let getAccount: sinon.SinonStub;
      let getContract: sinon.SinonStub;
      let getContractResults: sinon.SinonStub;
      let getContractActions: sinon.SinonStub;
      let getContractOpcodes: sinon.SinonStub;

      beforeEach(() => {
        getAccount = sinon.stub(MirrorNodeClient.prototype, 'getAccount').resolves({ balance: 1000 });
        getContract = sinon.stub(MirrorNodeClient.prototype, 'getContract').resolves({ address: contractAddress1 });
        getContractResults = sinon
          .stub(MirrorNodeClient.prototype, 'getContractResultWithRetry')
          .resolves(contractResult);
        getContractActions = sinon
          .stub(MirrorNodeClient.prototype, 'getContractsResultsActions')
          .resolves(contractActions);
        getContractOpcodes = sinon
          .stub(MirrorNodeClient.prototype, 'getContractsResultsOpcodes')
          .resolves(contractOpcodes);
      });

      afterEach(() => {
        getAccount.restore();
        getContract.restore();
        getContractResults.restore();
        getContractActions.restore();
        getContractOpcodes.restore();
      });

      it('should execute with CallTracer type and valid CallTracerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer, { onlyTopCall: true }],
            id: 1,
          }),
        ).to.not.throw;
      });

      it('should execute with OpcodeLogger type and valid OpcodeLoggerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [
              contractHash1,
              TracerType.OpcodeLogger,
              { disableStack: false, disableStorage: false, enableMemory: true },
            ],
            id: 1,
          }),
        ).to.not.throw;
      });

      it('should execute with valid hash', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with valid hash and valid TracerType string', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with valid hash, valid TracerType and empty TracerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer, {}],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with valid hash, no TracerType and no TracerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with unknown property in TracerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { disableMemory: true, disableStack: true }],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with unknown property in TracerConfigWrapper.tracerConfig', async () => {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { tracerConfig: { disableMemory: true, disableStorage: true } }],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should execute with empty TracerConfigWrapper.tracerConfig', async function () {
        expect(
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { tracerConfig: {} }],
            id: '2',
          }),
        ).to.not.throw;
      });

      it('should fail with missing transaction hash', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('should fail with invalid hash', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: ['invalidHash', TracerType.OpcodeLogger],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 0: The value passed is not valid: invalidHash. ${Validator.TRANSACTION_HASH_ERROR} OR ${Validator.TRANSACTION_ID_ERROR}`,
          );
        }
      });

      it('should fail with valid hash and invalid TracerType string', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, 'invalidTracerType'],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 1: The value passed is not valid: invalidTracerType. ${Validator.TYPES.tracerType.error} OR ${Validator.TYPES.tracerConfig.error} OR ${Validator.TYPES.tracerConfigWrapper.error}`,
          );
        }
      });

      it('should fail with valid hash, valid tracer type and invalid tracer configuration', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer, { invalidConfig: true }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: ${Validator.TYPES.tracerConfig.error}, value: ${JSON.stringify({
              invalidConfig: true,
            })}`,
          );
        }
      });

      it('should fail with valid hash and invalid type for TracerConfig.enableMemory', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { enableMemory: 'must be a boolean' }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'enableMemory' for OpcodeLoggerConfig: ${Validator.TYPES.boolean.error}, value: must be a boolean`,
          );
        }
      });

      it('should fail with valid hash and invalid type for TracerConfig.disableStack', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { disableStack: 'must be a boolean' }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'disableStack' for OpcodeLoggerConfig: ${Validator.TYPES.boolean.error}, value: must be a boolean`,
          );
        }
      });

      it('should fail with valid hash and invalid type for TracerConfig.disableStorage', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { disableStorage: 'must be a boolean' }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'disableStorage' for OpcodeLoggerConfig: ${Validator.TYPES.boolean.error}, value: must be a boolean`,
          );
        }
      });

      it('should fail with valid hash and invalid type for TracerConfigWrapper.tracer', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { tracer: 'invalidTracerType' }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'tracer' for TracerConfigWrapper: ${Validator.TYPES.tracerType.error}, value: invalidTracerType`,
          );
        }
      });

      it('should fail with valid hash and invalid type for TracerConfigWrapper.tracerConfig', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, { tracer: TracerType.OpcodeLogger, tracerConfig: 'invalidTracerConfig' }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 'tracerConfig' for TracerConfigWrapper: ${Validator.TYPES.tracerConfig.error}, value: invalidTracerConfig`,
          );
        }
      });

      it('should fail with empty TracerConfig containing invalid properties', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer, { invalidProperty: true }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            Validator.ERROR_CODE,
            `Invalid parameter 2: ${Validator.TYPES.tracerConfig.error}, value: ${JSON.stringify({
              invalidProperty: true,
            })}`,
          );
        }
      });

      it('should fail with invalid JSON-RPC method name', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '2.0',
            method: 'invalid_method',
            params: [contractHash1, TracerType.CallTracer, { onlyTopCall: true }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(
            error.response,
            predefined.UNSUPPORTED_METHOD.code,
            `Method invalid_method not found`,
          );
        }
      });

      it('should fail with invalid JSON-RPC version', async () => {
        try {
          await testClient.post('/', {
            jsonrpc: '1.0',
            method: 'debug_traceTransaction',
            params: [contractHash1, TracerType.CallTracer, { onlyTopCall: true }],
            id: '2',
          });

          Assertions.expectedError();
        } catch (error: any) {
          BaseTest.invalidParamError(error.response, predefined.INVALID_REQUEST.code, `Invalid Request`);
        }
      });
    });
  });
});

class BaseTest {
  static createTestClient(port = process.env.E2E_SERVER_PORT) {
    return Axios.create({
      baseURL: 'http://localhost:' + port,
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      timeout: 5 * 1000,
    });
  }

  static validRequestIdCheck(response) {
    const requestIdHeaderName = 'X-Request-Id'.toLowerCase();
    expect(
      response.headers,
      `Default response: headers should have '${requestIdHeaderName}' property`,
    ).to.have.property(requestIdHeaderName);
    expect(
      response.headers[requestIdHeaderName],
      `Default response: 'headers[${requestIdHeaderName}]' should not be null`,
    ).not.to.be.null;
    expect(
      response.headers[requestIdHeaderName],
      `Default response: 'headers[${requestIdHeaderName}]' should not be undefined`,
    ).not.to.be.undefined;
  }

  static validResponseCheck(response, options: any = { status: 200, statusText: 'OK' }) {
    expect(response.status).to.eq(options.status);
    expect(response.statusText).to.eq(options.statusText);
  }

  static validCorsCheck(response) {
    // ensure cors headers are set
    expect(
      response.headers,
      "Default response: headers should have 'access-control-allow-origin' property",
    ).to.have.property('access-control-allow-origin');
    expect(
      response.headers['access-control-allow-origin'],
      "Default response: 'headers[access-control-allow-origin]' should equal '*'",
    ).to.be.equal('*');
    expect(
      response.headers,
      "Default response: headers should have 'access-control-allow-methods' property",
    ).to.have.property('access-control-allow-methods');
    expect(
      response.headers['access-control-allow-methods'],
      "Default response: 'headers[access-control-allow-methods]' should equal 'GET,HEAD,PUT,POST,DELETE'",
    ).to.be.equal('GET,HEAD,PUT,POST,DELETE');
  }

  static defaultResponseChecks(response) {
    BaseTest.baseDefaultResponseChecks(response);

    expect(response.data, "Default response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Default response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data, "Default response: 'data' should have 'result' property").to.have.property('result');
    expect(response.data.id, "Default response: 'data.id' should equal '2'").to.be.equal('2');
    expect(response.data.jsonrpc, "Default response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
    expect(response, "Default response should have 'headers' property").to.have.property('headers');
  }

  static baseDefaultResponseChecks(response) {
    BaseTest.validResponseCheck(response);
    BaseTest.validCorsCheck(response);
    BaseTest.validRequestIdCheck(response);
    expect(response, "Default response: Should have 'data' property").to.have.property('data');
  }

  static errorResponseChecks(response, code, message) {
    BaseTest.validRequestIdCheck(response);
    expect(response, "Error response: should have 'data' property").to.have.property('data');
    expect(response.data, "Error response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Error response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data.id, "Error response: 'data.id' should equal '2'").to.be.equal('2');
    expect(response.data.jsonrpc, "Error response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
    expect(response.data, "Error response: 'data' should have 'error' property").to.have.property('error');
    expect(response.data.error, "Error response: 'data.error' should have 'code' property").to.have.property('code');
    expect(response.data.error.code, "Error response: 'data.error.code' should equal passed 'code' value").to.be.equal(
      code,
    );
    expect(response.data.error, "Error response: 'error' should have 'message' property").to.have.property('message');
    expect(response.data.error.message).to.contain(message);
  }

  static unsupportedJsonRpcMethodChecks(response: any) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    this.errorResponseChecks(response, -32601, 'Unsupported JSON-RPC method');
  }

  static batchDisabledErrorCheck(response: any) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');

    expect(response.data.error.message).to.eq('Batch requests are disabled');
    expect(response.data.error.code).to.eq(-32202);
  }

  static methodNotFoundCheck(response: any, methodName: string) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    this.errorResponseChecks(response, -32601, `Method ${methodName} not found`);
  }

  static batchRequestLimitError(response: any, amount: number, max: number) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    expect(response.data.error.message).to.eq(`Batch request amount ${amount} exceeds max ${max}`);
    expect(response.data.error.code).to.eq(-32203);
  }

  static invalidParamError(response: any, code: number, message: string) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    this.errorResponseChecks(response, code, message);
  }

  static invalidRequestSpecError(response: any, code: number, message: string) {
    BaseTest.validRequestIdCheck(response);
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    expect(response, "Default response: Should have 'data' property").to.have.property('data');
    expect(response.data, "Default response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Default response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data.jsonrpc, "Default response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
    expect(response.data.error, "Error response: 'data.error' should have 'code' property").to.have.property('code');
    expect(response.data.error.code, "Error response: 'data.error.code' should equal passed 'code' value").to.be.equal(
      code,
    );
    expect(response.data.error, "Error response: 'error' should have 'message' property").to.have.property('message');
    expect(
      response.data.error.message.endsWith(message),
      "Error response: 'data.error.message' should end with passed 'message' value",
    ).to.be.true;
  }
}
