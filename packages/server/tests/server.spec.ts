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
import app from '../dist/server.js';

describe('RPC Server', async function() {
  this.timeout(60 * 1000);

  before(function() {
    this.testServer = app.listen(process.env.E2E_SERVER_PORT);
    this.testClient = BaseTest.createTestClient();
  });

  after(function() {
    this.testServer.close();
  });

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

  it('should execute "eth_getTransactionByHash  missing transaction"', async function() {
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

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "parity_nextNonce"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'parity_nextNonce',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
  });

  it('should execute "net_peerCount"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'net_peerCount',
      'params': [null]
    });

    BaseTest.unsupportedJsonRpcMethodChecks(res);
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

    BaseTest.unsupportedJsonRpcMethodChecks(res);
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

    BaseTest.unsupportedJsonRpcMethodChecks(res);
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

  static unsupportedJsonRpcMethodChecks(response) {
    expect(response).to.have.property('data');
    expect(response.data).to.have.property('id');
    expect(response.data).to.have.property('jsonrpc');
    expect(response.data).to.have.property('error');
    expect(response.data.id).to.be.equal('2');
    expect(response.data.jsonrpc).to.be.equal('2.0');
    expect(response.data.error).to.have.property('message');
    expect(response.data.error).to.have.property('code');
    expect(response.data.error.message).to.be.equal('Method not found');
    expect(response.data.error.code).to.be.equal(-32601);
  }
}