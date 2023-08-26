/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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

import Axios from 'axios';
import { expect } from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import Assertions from '../helpers/assertions';
import app from '../../src/server';
import { Validator } from '../../src/validator';
import RelayCalls from '../../tests/helpers/constants';
dotenv.config({ path: path.resolve(__dirname, './test.env') });

const MISSING_PARAM_ERROR = "Missing value for required parameter";

before(function() {
  this.timeout(60 * 1000);
  this.testServer = app.listen(process.env.E2E_SERVER_PORT);
  this.testClient = BaseTest.createTestClient();
});

after(function() {
  this.testServer.close();
});

describe('RPC Server', async function() {
  this.timeout(5000);

  it('should execute "eth_chainId"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
  });

  it('validates enforcement of request id', async function() {
    try {
      await this.testClient.post('/', {
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.invalidRequestSpecError(error.response, -32600, `Invalid Request`);
    }
  });

  xit('supports optionality of request id when configured', async function() {

    const app2 = require('../../src/server').default;
    const port = `1${process.env.E2E_SERVER_PORT}`;
    const testServer2 = app2.listen(port);
    const testClient2 = BaseTest.createTestClient(port);

    try {
      process.env.REQUEST_ID_IS_OPTIONAL = 'true';
      const response = await testClient2.post('/', {
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_CHAIN_ID,
        'params': [null]
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
    } catch (error) {
      expect(true, `Unexpected error: ${error.message}`).to.eq(false);
    }
    
    process.env.REQUEST_ID_IS_OPTIONAL = 'false';
    testServer2.close();
  });

  it('should execute "eth_accounts"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_ACCOUNTS,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.an('Array');
    expect(res.data.result.length).to.be.equal(0);
  });

  it('should execute "web3_clientVersion"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.WEB3_CLIENTVERSION,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('relay/' + process.env.npm_package_version);
  });

  it('should execute "eth_getTransactionByHash with missing transaction"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
        'params': ['0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7237170ae5e5e7957eb6392']
      });
    } catch (error) {
      expect(error.message).to.equal('Request failed with status code 500');
    }
  });


  it('should execute "eth_getUncleByBlockHashAndIndex"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_HASH_AND_INDEX,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_BY_BLOCK_NUMBER_AND_INDEX,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_HASH,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_UNCLE_COUNT_BY_BLOCK_NUMBER,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_hashrate"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_HASH_RATE,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_mining"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_MINING,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_submitWork"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_WORK,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_syncing"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_SYNCING,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "net_listening"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.NET_LISTENING,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('false');
  });

  it('should execute "web3_sha"', async function() {
    try{
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.WEB3_SHA,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.methodNotFoundCheck(error.response);
    }
  });

  it('should execute "net_peerCount"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.NET_PEER_COUNT,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.methodNotFoundCheck(error.response);
    }
  });

  it('should execute "eth_submitHashrate"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_SUBMIT_HASH_RATE,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_signTypedData"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TYPED_DATA,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.methodNotFoundCheck(error.response);
    }
  });

  it('should execute "eth_signTransaction"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_SIGN_TRANSACTION,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_sign"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_SIGN,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_sendTransaction"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_SEND_TRANSACTION,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_protocolVersion"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_PROTOCOL_VERSION,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_getProof"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_PROOF,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.methodNotFoundCheck(error.response);
    }
  });

  it('should execute "eth_coinbase"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_COINBASE,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_getWork"', async function() {
    try {
      await this.testClient.post('/', {
        'id': '2',
        'jsonrpc': '2.0',
        'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_WORK,
        'params': [null]
      });

      Assertions.expectedError();
    } catch (error) {
      BaseTest.unsupportedJsonRpcMethodChecks(error.response);
    }
  });

  it('should execute "eth_maxPriorityFeePerGas"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': RelayCalls.ETH_ENDPOINTS.ETH_MAX_PRIORITY_FEE_PER_GAS,
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  describe('Validator', async function() {
    describe('eth_estimateGas', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + " 0");
        }
      });

      it('validates parameter 0 is TransactionObject', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': ["0x0"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, "Expected TransactionObject, value: 0x0");
        }
      });

      it('validates Transaction `to` param is address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"to": "0x1"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'to' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`);
        }      });

      it('validates Transaction `from` param is address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"from": '0x1'}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'from' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`);
        }
      });

      it('validates Transaction `gas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"gas": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'gas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }

      });

      it('validates Transaction `gasPrice` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"gasPrice": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'gasPrice' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }

      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"maxPriorityFeePerGas": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'maxPriorityFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }

      });

      it('validates Transaction `maxFeePerGas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"maxFeePerGas": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'maxFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `value` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"value": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'value' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `data` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"data": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'data' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Block param is valid block hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, "123"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates Block param is valid tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_ESTIMATE_GAS,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_getBalance', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is of type Address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            'params': ["0x0"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, Validator.ADDRESS_ERROR + ', value: 0x0');
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            'params': ["0x0000000000000000000000000000000000000001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            'params': ["0x0000000000000000000000000000000000000001", "123"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `The value passed is not a valid blockHash/blockNumber/blockTag value: 123`);

        }
      });

      it('validates parameter 1 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BALANCE,
            'params': ["0x0000000000000000000000000000000000000001", "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, 'The value passed is not a valid blockHash/blockNumber/blockTag value: newest');
        }
      });
    });

    describe('eth_getCode', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');

        }
      });

      it('validates parameter 0 is address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            'params': ['0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35']
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            'params': ["0x0000000000000000000000000000000000000001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_CODE,
            'params': ["0x0000000000000000000000000000000000000001", "123"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates parameter 1 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getCode',
            'params': ["0x0000000000000000000000000000000000000001", "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_getBlockByNumber', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            'params': [1]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 1`);
        }
      });

      it('validates parameter 0 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            'params': ["newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            'params': ["0x1"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is boolean', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
            'params': ["0x1", "true"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: Expected boolean type, value: true`);
        }
      });
    });

    describe('eth_getBlockByHash', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is a block hash', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            'params': ['0x1']
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            'params': ["0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is boolean', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
            'params': ["0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6", "true"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: Expected boolean type, value: true`);
        }
      });
    });

    describe('eth_getTransactionCount', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is an address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            'params': ["0x0001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0x0001`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            'params': ["0x0000000000000000000000000000000000000001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is a valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            'params': ["0x0000000000000000000000000000000000000001", 123]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates parameter 1 is a valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_COUNT,
            'params': ["0x0000000000000000000000000000000000000001", 'newest']
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_call', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is TransactionObject', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': ["0x0"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, "Expected TransactionObject, value: 0x0");
        }
      });

      it('validates Transaction `to` param is address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"to": "0x1"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'to' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`);
        }      });

      it('validates Transaction `from` param is address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"from": '0x1'}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'from' for TransactionObject: ${Validator.ADDRESS_ERROR}, value: 0x1`);
        }
      });

      it('validates Transaction `gas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"gas": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'gas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `gasPrice` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"gasPrice": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'gasPrice' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"maxPriorityFeePerGas": 123}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'maxPriorityFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `maxFeePerGas` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"maxFeePerGas": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'maxFeePerGas' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `value` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"value": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'value' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Transaction `data` param is hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"data": "123"}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'data' for TransactionObject: ${Validator.DEFAULT_HEX_ERROR}, value: 123`);
        }
      });

      it('validates Block param is non valid block hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, "123"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_PARAMS_ERROR}, value: 123`);
        }
      });

      it('validates Block param is non valid tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_PARAMS_ERROR}, value: newest`);
        }
      });

      it('validates Block param is non valid block hash', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, { "blockHash": "0x123" }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'blockHash' for BlockHashObject: ${Validator.BLOCK_HASH_ERROR}, value: 0x123`);
        }
      });

      it('validates Block param is non valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_CALL,
            'params': [{"to": "0x0000000000000000000000000000000000000001"}, { "blockNumber": "123" }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'blockNumber' for BlockNumberObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });
    });

    describe('eth_sendRawTransaction', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION,
            'params': ['f868']
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.DEFAULT_HEX_ERROR}, value: f868`);
        }
      });
    });

    describe('eth_getTransactionByHash', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block hash', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });
    });

    describe('eth_feeHistory', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            'params': ["0x5"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 2 is array', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_FEE_HISTORY,
            'params': ["0x5", "latest", {}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 2: Expected Array, value: [object Object]`);
        }
      });
    });

    describe('eth_getBlockTransactionCountByHash', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block hash', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
            'params': ["0x1234"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1234`);
        }
      });
    });

    describe('eth_getBlockTransactionCountByNumber', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            'params': ["1234"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 1234`);
        }
      });

      it('validates parameter 0 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
            'params': ["newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_getStorageAt', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid address', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': ["0000000000000000000000000000000000000001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}, value: 0000000000000000000000000000000000000001`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': ["0x0000000000000000000000000000000000000001"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': ["0x0000000000000000000000000000000000000001", 1234]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}, value: 1234`);
        }
      });

      it('validates parameter 2 is valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': ["0x0000000000000000000000000000000000000001", "0x1", 123]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 2: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates parameter 2 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_STORAGE_AT,
            'params': ["0x0000000000000000000000000000000000000001", "0x1", "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 2: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_getTransactionByBlockHashAndIndex', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block hash', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            'params': ["0x1a2b3c"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}, value: 0x1a2b3c`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
            'params': ["0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionByBlockHashAndIndex',
            'params': ["0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35", "08"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}, value: 08`);
        }
      });
    });

    describe('eth_getTransactionByBlockNumberAndIndex', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            'params': []
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
        }
      });

      it('validates parameter 0 is valid block number', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            'params': [123]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates parameter 0 is valid block tag', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            'params': ["newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });

      it('validates parameter 1 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            'params': ["0x5BAD55"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
        }
      });

      it('validates parameter 1 is valid hex', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
            'params': ["0x5BAD55", "08"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}, value: 08`);
        }
      });
    });

    describe('eth_getLogs', async () => {
      it('validates parameter 0 is Filter Object', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': ["0x1"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.TYPES['filter'].error}, value: 0x1`);
        }
      });

      it('validates parameter Filter Object does not contain both block hash and fromBlock/toBlock', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "blockHash": "0x123", "toBlock": "latest" }]
          });

          Assertions.expectedError();
        } catch (error) {
          console.log(error.response.data);
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: Can't use both blockHash and toBlock/fromBlock`);
        }
      });

      it('validates blockHash filter', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "blockHash": "0x123" }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'blockHash' for FilterObject: ${Validator.BLOCK_HASH_ERROR}, value: 0x123`);
        }
      });

      it('validates toBlock filter', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "toBlock": 123 }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'toBlock' for FilterObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates toBlock filter', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "fromBlock": 123 }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'fromBlock' for FilterObject: ${Validator.BLOCK_NUMBER_ERROR}, value: 123`);
        }
      });

      it('validates address filter', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "address": '0x012345' }]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'address' for FilterObject: ${Validator.TYPES.addressFilter.error}, value: 0x012345`);
        }
      });

      it('validates topics filter is array', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "topics": {}}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: [object Object]`);
        }
      });

      it('validates topics filter is array of topic hashes', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "topics": [123]}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: 123`);
        }
      });

      it('validates topics filter is array of array of topic hashes', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            'params': [{ "topics": [[123]]}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: 123`);
        }
      });

      it('should execute HTTP OPTIONS cors preflight check', async function() {
        const response = await this.testClient.options('/');
    
        BaseTest.validResponseCheck(response, {status: 204, statusText: 'No Content'});
        BaseTest.validCorsCheck(response);
      });

      it('should execute metrics collection', async function() {
        const response = await this.testClient.get('/metrics');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
      });

      it('should execute successful health readiness check', async function() {
        const response = await this.testClient.get('/health/readiness');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
        expect(response, "Default response: Should have 'data' property").to.have.property('data');
        expect(response.data, "Default response: 'data' should equal 'OK'").to.be.equal('OK');
      });

      it('should execute successful health liveness check', async function() {
        const response = await this.testClient.get('/health/readiness');

        expect(response.status).to.eq(200);
        expect(response.statusText).to.eq('OK');
        expect(response, "Default response: Should have 'data' property").to.have.property('data');
        expect(response.data, "Default response: 'data' should equal 'OK'").to.be.equal('OK');
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
        'Content-Type': 'application/json'
      },
      method: 'POST',
      timeout: 5 * 1000
    });
  }

  static validRequestIdCheck(response) {
    const requestIdHeaderName = "X-Request-Id".toLowerCase();
    expect(response.headers, `Default response: headers should have '${requestIdHeaderName}' property`).to.have.property(requestIdHeaderName);
    expect(response.headers[requestIdHeaderName], `Default response: 'headers[${requestIdHeaderName}]' should not be null`).not.to.be.null;
    expect(response.headers[requestIdHeaderName], `Default response: 'headers[${requestIdHeaderName}]' should not be undefined`).not.to.be.undefined;
  }

  static validResponseCheck(response, options:any = {status: 200, statusText: 'OK'}) {
    expect(response.status).to.eq(options.status);
    expect(response.statusText).to.eq(options.statusText);
  }

  static validCorsCheck(response) {    
    // ensure cors headers are set
    expect(response.headers, "Default response: headers should have 'access-control-allow-origin' property").to.have.property('access-control-allow-origin');
    expect(response.headers['access-control-allow-origin'], "Default response: 'headers[access-control-allow-origin]' should equal '*'").to.be.equal('*');
    expect(response.headers, "Default response: headers should have 'access-control-allow-methods' property").to.have.property('access-control-allow-methods');
    expect(response.headers['access-control-allow-methods'], "Default response: 'headers[access-control-allow-methods]' should equal 'GET,HEAD,PUT,POST,DELETE'").to.be.equal('GET,HEAD,PUT,POST,DELETE');
  }

  static defaultResponseChecks(response) {
    BaseTest.validResponseCheck(response);
    BaseTest.validCorsCheck(response);
    BaseTest.validRequestIdCheck(response);
    expect(response, "Default response: Should have 'data' property").to.have.property('data');
    expect(response.data, "Default response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Default response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data, "Default response: 'data' should have 'result' property").to.have.property('result');
    expect(response.data.id, "Default response: 'data.id' should equal '2'").to.be.equal('2');
    expect(response.data.jsonrpc, "Default response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
    expect(response, "Default response should have 'headers' property").to.have.property('headers');
  }

  static errorResponseChecks(response, code, message, name?) {
    BaseTest.validRequestIdCheck(response);
    expect(response, "Error response: should have 'data' property").to.have.property('data');
    expect(response.data, "Error response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Error response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data.id, "Error response: 'data.id' should equal '2'").to.be.equal('2');
    expect(response.data.jsonrpc, "Error response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
    expect(response.data, "Error response: 'data' should have 'error' property").to.have.property('error');
    expect(response.data.error, "Error response: 'data.error' should have 'code' property").to.have.property('code');
    expect(response.data.error.code, "Error response: 'data.error.code' should equal passed 'code' value").to.be.equal(code);
    expect(response.data.error, "Error response: 'error' should have 'message' property").to.have.property('message');
    expect(response.data.error.message.endsWith(message), "Error response: 'data.error.message' should end with passed 'message' value").to.be.true;
    if (name) {
      expect(response.data.error, "Error response: 'data.error' should have 'name' property").to.have.property('name');
      expect(response.data.error.name, "Error response: 'data.error.name' should match passed 'name' value").to.be.equal(name);
    }
  }

  static unsupportedJsonRpcMethodChecks(response: any) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    this.errorResponseChecks(response, -32601, 'Unsupported JSON-RPC method');
  }

  static methodNotFoundCheck(response: any) {
    expect(response.status).to.eq(400);
    expect(response.statusText).to.eq('Bad Request');
    this.errorResponseChecks(response, -32601, 'Method not found');
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
    expect(response.data.error.code, "Error response: 'data.error.code' should equal passed 'code' value").to.be.equal(code);
    expect(response.data.error, "Error response: 'error' should have 'message' property").to.have.property('message');
    expect(response.data.error.message.endsWith(message), "Error response: 'data.error.message' should end with passed 'message' value").to.be.true;
  }
}
