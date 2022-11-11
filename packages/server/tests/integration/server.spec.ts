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
        'params': ['0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392']
      });
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
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'web3_sha',
      'params': [null]
    });

    BaseTest.methodNotFoundCheck(res);
  });

  it('should execute "net_peerCount"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'net_peerCount',
      'params': [null]
    });

    BaseTest.methodNotFoundCheck(res);
  });

  it('should execute "eth_submitHashrate"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_submitHashrate',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_signTypedData"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_signTypedData',
      'params': [null]
    });

    BaseTest.methodNotFoundCheck(res);
  });

  it('should execute "eth_signTransaction"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_signTransaction',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_sign"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_sign',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_sendTransaction"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_sendTransaction',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_protocolVersion"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_protocolVersion',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_getProof"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getProof',
      'params': [null]
    });

    BaseTest.methodNotFoundCheck(res);
  });

  it('should execute "eth_coinbase"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_coinbase',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "eth_getWork"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_getWork',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
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
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + " 0");
      });

      it('validates parameter 0 is Transaction object', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': ["0x0"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, "Expected Transaction object");
      });

      it('validates Transaction `to` param is required', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + " 'to' for Transaction Object");
      });

      it('validates Transaction `to` param is address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x1"}]
        });
        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'to' for Transaction Object: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates Transaction `from` param is address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "from": '0x1'}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'from' for Transaction Object: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates Transaction `gas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "gas": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'gas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `gasPrice` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "gasPrice": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'gasPrice' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "maxPriorityFeePerGas": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'maxPriorityFeePerGas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `maxFeePerGas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "maxFeePerGas": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'maxFeePerGas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `value` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "value": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'value' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `data` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "data": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'data' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Block param is valid block hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001"}, "123"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates Block param is valid tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{"to": "0x0000000000000000000000000000000000000001"}, "newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_getBalance', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is of type Address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, Validator.ADDRESS_ERROR);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0000000000000000000000000000000000000001", "123"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0000000000000000000000000000000000000001", "newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_getCode', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': ['0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35']
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': ["0x0000000000000000000000000000000000000001", "123"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': ["0x0000000000000000000000000000000000000001", "newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_getBlockByNumber', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': [1]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 0 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': ["newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': ["0x1"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is boolean', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': ["0x1", "true"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: Expected boolean type`);
      });
    });

    describe('eth_getBlockByHash', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByHash',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is a block hash', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByHash',
          'params': ['0x1']
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByHash',
          'params': ["0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is boolean', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByHash',
          'params': ["0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6", "true"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: Expected boolean type`);
      });
    });

    describe('eth_getTransactionCount', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is an address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': ["0x0001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is a valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': ["0x0000000000000000000000000000000000000001", 123]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 is a valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': ["0x0000000000000000000000000000000000000001", 'newest']
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_call', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is Transaction object', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': ["0x0"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, "Expected Transaction object");
      });

      it('validates Transaction `to` param is required', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{}]
        });;
        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + " 'to' for Transaction Object");
      });

      it('validates Transaction `to` param is address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x1"}]
        });
        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'to' for Transaction Object: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates Transaction `from` param is address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "from": '0x1'}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'from' for Transaction Object: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates Transaction `gas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "gas": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'gas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `gasPrice` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "gasPrice": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'gasPrice' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `maxPriorityFeePerGas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "maxPriorityFeePerGas": 123}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'maxPriorityFeePerGas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `maxFeePerGas` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "maxFeePerGas": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'maxFeePerGas' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `value` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "value": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'value' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Transaction `data` param is hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001", "data": "123"}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 'data' for Transaction Object: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates Block param is valid block hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001"}, "123"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates Block param is valid tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{"to": "0x0000000000000000000000000000000000000001"}, "newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_sendRawTransaction', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_sendRawTransaction',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is valid hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_sendRawTransaction',
          'params': ['f868']
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.DEFAULT_HEX_ERROR}`);
      });
    });

    describe('eth_getTransactionByHash', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByHash',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is block hash', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByHash',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });
    });

    describe('eth_feeHistory', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_feeHistory',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_feeHistory',
          'params': ["0x5"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 2 is array', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_feeHistory',
          'params': ["0x5", "latest", {}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 2: Expected Array`);
      });
    });

    describe('eth_getBlockTransactionCountByHash', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockTransactionCountByHash',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is block hash', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockTransactionCountByHash',
          'params': ["0x1234"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}`);
      });
    });

    describe('eth_getBlockTransactionCountByNumber', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockTransactionCountByNumber',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockTransactionCountByNumber',
          'params': ["1234"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 0 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockTransactionCountByNumber',
          'params': ["newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_getStorageAt', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is valid address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.ADDRESS_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is valid hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001", 1234]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}`);
      });

      it('validates parameter 2 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001", "0x1"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 2');
      });

      it('validates parameter 2 is valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001", "0x1", 123]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 2: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 2 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001", "0x1", "newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 2: ${Validator.BLOCK_NUMBER_ERROR}`);
      });
    });

    describe('eth_getTransactionByBlockHashAndIndex', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockHashAndIndex',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 0 is valid block hash', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockHashAndIndex',
          'params': ["0x1a2b3c"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_HASH_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockHashAndIndex',
          'params': ["0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is valid hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockHashAndIndex',
          'params': ["0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35", "08"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}`);
      });
    });

    describe('eth_getTransactionByBlockNumberAndIndex', async function() {
      it('validates parameter 0 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': []
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 0');
      });

      it('validates parameter 1 is valid block number', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': [123]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 is valid block tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': ["newest"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 0: ${Validator.BLOCK_NUMBER_ERROR}`);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': ["0x5BAD55"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, MISSING_PARAM_ERROR + ' 1');
      });

      it('validates parameter 1 is valid hex', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': ["0x5BAD55", "08"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, `Invalid parameter 1: ${Validator.DEFAULT_HEX_ERROR}`);
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
    expect(response).to.have.property('data');
    expect(response.data).to.have.property('id');
    expect(response.data).to.have.property('jsonrpc');
    expect(response.data).to.have.property('result');
    expect(response.data.id).to.be.equal('2');
    expect(response.data.jsonrpc).to.be.equal('2.0');
  }

  static errorResponseChecks(response, code, message, name?) {
    expect(response).to.have.property('data');
    expect(response.data).to.have.property('id');
    expect(response.data).to.have.property('jsonrpc');
    expect(response.data.id).to.be.equal('2');
    expect(response.data.jsonrpc).to.be.equal('2.0');
    expect(response.data).to.have.property('error');
    expect(response.data.error).to.have.property('code');
    expect(response.data.error.code).to.be.equal(code);
    expect(response.data.error).to.have.property('message');
    expect(response.data.error.message.endsWith(message)).to.be.true;
    if (name) {
      expect(response.data.error).to.have.property('name');
      expect(response.data.error.name).to.be.equal(name);
    }
  }

  static unsupportedJsonRpcMethodChecks(response) {
    this.errorResponseChecks(response, -32601, 'Unsupported JSON-RPC method');
  }

  static methodNotFoundCheck(response) {
    this.errorResponseChecks(response, -32601, 'Method not found');
  }
}
