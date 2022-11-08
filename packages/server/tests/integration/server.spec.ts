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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 0 is type Object', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [123]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Expected Object');
      });

      it('validates parameter 1 is hex Block number or tag', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_estimateGas',
          'params': [{}, 123]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, Validator.BLOCK_NUMBER_ERROR);
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 0 is of type Address', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0"]
        });
        console.log(res.data.error.message);
        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, Validator.ADDRESS_ERROR);
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBalance',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getCode',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByNumber',
          'params': ["0x1"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getBlockByHash',
          'params': ["0x88e96d4537bea4d9c05d12549907b32561d3bf31f45aae734cdc119f13406cb6"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionCount',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_call',
          'params': [{}]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_feeHistory',
          'params': ["0x5"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
      });

      it('validates parameter 2 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getStorageAt',
          'params': ["0x0000000000000000000000000000000000000001", "0x1"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 2');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockHashAndIndex',
          'params': ["0xb3b20624f8f0f86eb50dd04688409e5cea4bd02d700bf6e79e9384d47d6a5a35"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 0');
      });

      it('validates parameter 1 exists', async function() {
        const res = await this.testClient.post('/', {
          'id': '2',
          'jsonrpc': '2.0',
          'method': 'eth_getTransactionByBlockNumberAndIndex',
          'params': ["0x5BAD55"]
        });

        BaseTest.errorResponseChecks(res, Validator.ERROR_CODE, 'Missing value for required parameter 1');
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
