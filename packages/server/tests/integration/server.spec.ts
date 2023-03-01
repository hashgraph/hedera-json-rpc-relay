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

import { expect } from 'chai';
import Axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, './test.env') });
import app from '../../src/server';
import { Validator } from '../../src/validator';
import Assertions from '../helpers/assertions';
import { InvalidParams } from '../../src/koaJsonRpc/lib/RpcError';

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
  it('should execute "eth_chainId"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_chainId',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
  });

  it('should execute "eth_accounts"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_accounts',
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
      'method': 'web3_clientVersion',
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
        'method': 'eth_getTransactionByHash',
        'params': ['0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7237170ae5e5e7957eb6392']
      });
      Assertions.expectedError();
    } catch (error) {
      expect(error.message).to.equal('Request failed with status code 500');
    }
  });


  it('should execute "eth_getUncleByBlockHashAndIndex"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getUncleByBlockHashAndIndex',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getUncleByBlockNumberAndIndex',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(null);
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getUncleCountByBlockHash',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getUncleCountByBlockNumber',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_hashrate"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_hashrate',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal('0x0');
  });

  it('should execute "eth_mining"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_mining',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_submitWork"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_submitWork',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "eth_syncing"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_syncing',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(false);
  });

  it('should execute "net_listening"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'net_listening',
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
        'method': 'web3_sha',
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
        'method': 'net_peerCount',
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
        'method': 'eth_submitHashrate',
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
        'method': 'eth_signTypedData',
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
        'method': 'eth_signTransaction',
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
        'method': 'eth_sign',
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
        'method': 'eth_sendTransaction',
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
        'method': 'eth_protocolVersion',
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
        'method': 'eth_getProof',
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
        'method': 'eth_coinbase',
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
        'method': 'eth_getWork',
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
      'method': 'eth_maxPriorityFeePerGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_estimateGas',
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
            'method': 'eth_getBalance',
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
            'method': 'eth_getBalance',
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
            'method': 'eth_getBalance',
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
            'method': 'eth_getBalance',
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
            'method': 'eth_getBalance',
            'params': ["0x0000000000000000000000000000000000000001", "newest"]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}, value: newest`);
        }
      });
    });

    describe('eth_getCode', async function() {
      it('validates parameter 0 exists', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getCode',
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
            'method': 'eth_getCode',
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
            'method': 'eth_getCode',
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
            'method': 'eth_getCode',
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
            'method': 'eth_getBlockByNumber',
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
            'method': 'eth_getBlockByNumber',
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
            'method': 'eth_getBlockByNumber',
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
            'method': 'eth_getBlockByNumber',
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
            'method': 'eth_getBlockByNumber',
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
            'method': 'eth_getBlockByHash',
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
            'method': 'eth_getBlockByHash',
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
            'method': 'eth_getBlockByHash',
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
            'method': 'eth_getBlockByHash',
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
            'method': 'eth_getTransactionCount',
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
            'method': 'eth_getTransactionCount',
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
            'method': 'eth_getTransactionCount',
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
            'method': 'eth_getTransactionCount',
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
            'method': 'eth_getTransactionCount',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_call',
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
            'method': 'eth_sendRawTransaction',
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
            'method': 'eth_sendRawTransaction',
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
            'method': 'eth_getTransactionByHash',
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
            'method': 'eth_getTransactionByHash',
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
            'method': 'eth_feeHistory',
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
            'method': 'eth_feeHistory',
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
            'method': 'eth_feeHistory',
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
            'method': 'eth_getBlockTransactionCountByHash',
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
            'method': 'eth_getBlockTransactionCountByHash',
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
            'method': 'eth_getBlockTransactionCountByNumber',
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
            'method': 'eth_getBlockTransactionCountByNumber',
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
            'method': 'eth_getBlockTransactionCountByNumber',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getStorageAt',
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
            'method': 'eth_getTransactionByBlockHashAndIndex',
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
            'method': 'eth_getTransactionByBlockHashAndIndex',
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
            'method': 'eth_getTransactionByBlockHashAndIndex',
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
            'method': 'eth_getTransactionByBlockNumberAndIndex',
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
            'method': 'eth_getTransactionByBlockNumberAndIndex',
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
            'method': 'eth_getTransactionByBlockNumberAndIndex',
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
            'method': 'eth_getTransactionByBlockNumberAndIndex',
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
            'method': 'eth_getTransactionByBlockNumberAndIndex',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
            'params': [{ "blockHash": "0x123", "toBlock": "latest" }]
          });

          Assertions.expectedError();
        } catch (error) {
          console.log(error.response.data)
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 0: Can't use both blockHash and toBlock/fromBlock`);
        }
      });

      it('validates blockHash filter', async function() {
        try {
          await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
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
            'method': 'eth_getLogs',
            'params': [{ "topics": [[123]]}]
          });

          Assertions.expectedError();
        } catch (error) {
          BaseTest.invalidParamError(error.response, Validator.ERROR_CODE, `Invalid parameter 'topics' for FilterObject: ${Validator.TYPES['topics'].error}, value: 123`);
        }
      });
    });
  });
});

class BaseTest {
  static createTestClient() {
    return Axios.create({
      baseURL: 'http://localhost:' + process.env.E2E_SERVER_PORT,
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      timeout: 5 * 1000
    });
  }

  static defaultResponseChecks(response) {
    expect(response, "Default response: Should have 'data' property").to.have.property('data');
    expect(response.data, "Default response: 'data' should have 'id' property").to.have.property('id');
    expect(response.data, "Default response: 'data' should have 'jsonrpc' property").to.have.property('jsonrpc');
    expect(response.data, "Default response: 'data' should have 'result' property").to.have.property('result');
    expect(response.data.id, "Default response: 'data.id' should equal '2'").to.be.equal('2');
    expect(response.data.jsonrpc, "Default response: 'data.jsonrpc' should equal '2.0'").to.be.equal('2.0');
  }

  static errorResponseChecks(response, code, message, name?) {
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
}
