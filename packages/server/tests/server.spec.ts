import app from '../dist/server.js';
import { expect } from 'chai';
import Axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, './test.env') });

describe('RPC Server', async function() {
  this.timeout(60 * 1000);

  before(function() {
    this.testServer = app.listen(process.env.E2E_SERVER_PORT);
    this.testClient = BaseTest.createTestClient();
  });

  after(function() {
    process.exit(0);
  });

  it('should execute "eth_chainId"', async function() {
    const res = await this.testClient.post('/', {
      'id': '2',
      'jsonrpc': '2.0',
      'method': 'eth_chainId',
      'params': [null]
    });

    BaseTest.defaultResponseChecks(res);
    expect(res.data.result).to.be.equal(process.env.CHAIN_ID);
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
    expect(res.data.result).to.be.equal('hashio/' + process.env.npm_package_version);
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
}