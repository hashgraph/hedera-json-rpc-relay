/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import path from 'path';
import dotenv from 'dotenv';
import { expect } from 'chai';
import { Registry } from 'prom-client';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import { MirrorNodeClient } from '../../src/lib/clients/mirrorNodeClient';
import constants from '../../src/lib/constants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {mockData, random20BytesAddress} from './../helpers';
const registry = new Registry();

import pino from 'pino';
import { SDKClientError } from '../../src/lib/errors/SDKClientError';
const logger = pino();
import { v4 as uuid } from 'uuid';
import { formatRequestIdMessage } from '../../src/formatters';
import { predefined } from '../../src';

const limitOrderPostFix = '?order=desc&limit=1';

describe('MirrorNodeClient', async function () {
  this.timeout(20000);

  let instance, mock, mirrorNodeInstance;

  before(() => {
    // mock axios
    instance = axios.create({
      baseURL: 'https://localhost:5551/api/v1',
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 20 * 1000
    });
    mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry, instance);
  });

  beforeEach(() => {
    mock = new MockAdapter(instance);
  });

  describe('handleError', async() => {

    const CONTRACT_CALL_ENDPOINT = 'contracts/call';
    const nullResponseCodes = [404,415,500];
    const errorRepsonseCodes = [501, 503, 400, 429];

    for (const code of nullResponseCodes) {
      it(`returns null when ${code} is returned`, async () => {
        let error  = new Error('test error');
        error["response"] = "test error";

        const result = await mirrorNodeInstance.handleError(error, CONTRACT_CALL_ENDPOINT, CONTRACT_CALL_ENDPOINT,  code, 'POST');
        expect(result).to.equal(null);
      });
    }

    for (const code of errorRepsonseCodes) {
      it(`throws an error when ${code} is returned`, async () => {
        try {
          let error  = new Error('test error');
          error["response"] = "test error";
          await mirrorNodeInstance.handleError(error, CONTRACT_CALL_ENDPOINT, CONTRACT_CALL_ENDPOINT, code, 'POST');
          expect.fail('should have thrown an error');
        } catch (e) {
          if(code === 400) {
            expect(e.message).to.equal('execution reverted: ');
          } else {
            expect(e.message).to.equal('test error');
          }
        }
      });
    }
  });

  it('Can extract the account number out of an account pagination next link url', async () => {
    const accountId = '0.0.123';
    const url = `/api/v1/accounts/${accountId}?limit=100&timestamp=lt:1682455406.562695326`;
    const extractedAccountId = mirrorNodeInstance.extractAccountIdFromUrl(url);
    expect(extractedAccountId).to.eq(accountId);

  });

  it('Can extract the evm address out of an account pagination next link url', async () => {
    const evmAddress = '0x583031d1113ad414f02576bd6afa5bbdf935b7d9';
    const url = `/api/v1/accounts/${evmAddress}?limit=100&timestamp=lt:1682455406.562695326`;
    const extractedEvmAddress = mirrorNodeInstance.extractAccountIdFromUrl(url);
    expect(extractedEvmAddress).to.eq(evmAddress);
  });

  it('it should have a `request` method ', async () => {
    expect(mirrorNodeInstance).to.exist;
    expect(mirrorNodeInstance.request).to.exist;
  });

  it('`restUrl` is exposed and correct', async () => {
    const domain = process.env.MIRROR_NODE_URL.replace(/^https?:\/\//, "");
    const prodMirrorNodeInstance = new MirrorNodeClient(domain, logger.child({ name: `mirror-node` }), registry);
    expect(prodMirrorNodeInstance.restUrl).to.eq(`https://${domain}/api/v1/`);
  });

  it('Can extract the account number out of an account pagination next link url', async () => {
    const accountId = '0.0.123';
    const url = `/api/v1/accounts/${accountId}?limit=100&timestamp=lt:1682455406.562695326`;
    const extractedAccountId = mirrorNodeInstance.extractAccountIdFromUrl(url);
    expect(extractedAccountId).to.eq(accountId);

  });

  it('Can extract the evm address out of an account pagination next link url', async () => {
    const evmAddress = '0x583031d1113ad414f02576bd6afa5bbdf935b7d9';
    const url = `/api/v1/accounts/${evmAddress}?limit=100&timestamp=lt:1682455406.562695326`;
    const extractedEvmAddress = mirrorNodeInstance.extractAccountIdFromUrl(url);
    expect(extractedEvmAddress).to.eq(evmAddress);
  });

  it('Can provide custom x-api-key header', async () => {
    const exampleApiKey = 'abc123iAManAPIkey';
    process.env.MIRROR_NODE_URL_HEADER_X_API_KEY = exampleApiKey;
    const mirrorNodeInstanceOverridden = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node` }), registry);
    const axiosHeaders = mirrorNodeInstanceOverridden.getMirrorNodeRestInstance().defaults.headers.common;
    expect(axiosHeaders).has.property('x-api-key');
    expect(axiosHeaders['x-api-key']).to.eq(exampleApiKey);
  });

  it('`getQueryParams` general', async () => {
    const queryParams = {
      'limit': 5,
      'order': 'desc',
      'timestamp': '1586567700.453054000'
    };

    const queryParamsString = mirrorNodeInstance.getQueryParams(queryParams);
    expect(queryParamsString).equal('?limit=5&order=desc&timestamp=1586567700.453054000');
  });

  it('`getQueryParams` contract result related', async () => {
    const queryParams = {
      'block.hash': '0x1eaf1abbd64bbcac7f473f0272671c66d3d1d64f584112b11cd4d2063e736305312fcb305804a48baa41571e71c39c61',
      'block.number': 5,
      'from': '0x0000000000000000000000000000000000000065',
      'internal': 'true',
      'transaction.index': '1586567700.453054000'
    };

    const queryParamsString = mirrorNodeInstance.getQueryParams(queryParams);
    expect(queryParamsString).equal('?block.hash=0x1eaf1abbd64bbcac7f473f0272671c66d3d1d64f584112b11cd4d2063e736305312fcb305804a48baa41571e71c39c61' +
      '&block.number=5&from=0x0000000000000000000000000000000000000065&internal=true&transaction.index=1586567700.453054000');
  });

  it('`getQueryParams` logs related', async () => {
    const queryParams = {
      'topic0': ['0x0a','0x0b'],
      'topic1': '0x0c',
      'topic2': ['0x0d','0x0e'],
      'topic3': '0x0f',
    };

    const queryParamsString = mirrorNodeInstance.getQueryParams(queryParams);
    expect(queryParamsString).equal('?topic0=0x0a&topic0=0x0b&topic1=0x0c&topic2=0x0d&topic2=0x0e&topic3=0x0f');
  });

  it('`get` works', async () => {
    mock.onGet('accounts').reply(200, {
      'accounts': [
        {
          'account': '0.0.1',
          'balance': {
            'balance': '536516344215',
            'timestamp': '1652985000.085209000'
          },
          'timestamp': '1652985000.085209000'
        },
        {
          'account': '0.0.2',
          'balance': {
            'balance': '4045894480417537000',
            'timestamp': '1652985000.085209000'
          },
          'timestamp': '1652985000.085209000'
        }
      ],
      'links': {
        'next': '/api/v1/accounts?limit=1&account.id=gt:0.0.1'
      }
    });

    // const customMirrorNodeInstance = new MirrorNodeClient('', logger.child({ name: `mirror-node`}), instance);
    const result = await mirrorNodeInstance.get('accounts');
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.exist;
    expect(result.accounts).to.exist;
    expect(result.accounts.length).to.gt(0);
    result.accounts.forEach((acc: any) => {
      expect(acc.account).to.exist;
      expect(acc.balance).to.exist;
      expect(acc.balance.balance).to.exist;
      expect(acc.balance.timestamp).to.exist;
    });
  });

  it('`post` works', async () => {
    const mockResult = {
      result: '0x3234333230'
    };
    mock.onPost('contracts/call', {foo: 'bar'}).reply(200, mockResult);

    const result = await mirrorNodeInstance.post('contracts/call', {foo: 'bar'});
    expect(result).to.exist;
    expect(result.result).to.exist;
    expect(result.result).to.eq(mockResult.result);
  });

  it('call to non-existing REST route returns 404', async () => {
    try {
      expect(await mirrorNodeInstance.get('non-existing-route')).to.throw();
    } catch (err: any) {
      expect(err.statusCode).to.eq(404);
    }
  });

  it('`getAccount` works', async () => {
    const alias = 'HIQQEXWKW53RKN4W6XXC4Q232SYNZ3SZANVZZSUME5B5PRGXL663UAQA';
    mock.onGet(`accounts/${alias}${limitOrderPostFix}`).reply(200, {
      'transactions': [
        {
          'nonce': 3,
        }
      ],
      'links': {
        'next': null
      }
    });

    const result = await mirrorNodeInstance.getAccount(alias);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.transactions.length).to.gt(0);
    expect(result.transactions[0].nonce).to.equal(3);
  });

  it('`getBlock by hash` works', async () => {
    const hash = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b';
    mock.onGet(`blocks/${hash}`).reply(200, {
      'count': 3,
      'hapi_version': '0.27.0',
      'hash': '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b',
      'name': '2022-05-03T06_46_26.060890949Z.rcd',
      'number': 77,
      'previous_hash': '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
      'size': null,
      'timestamp': {
        'from': '1651560386.060890949',
        'to': '1651560389.060890949'
      }
    });

    const result = await mirrorNodeInstance.getBlock(hash);
    expect(result).to.exist;
    expect(result.count).equal(3);
    expect(result.number).equal(77);
  });

  it('`getBlock by number` works', async () => {
    const number = 3;
    mock.onGet(`blocks/${number}`).reply(200, {
      'count': 3,
      'hapi_version': '0.27.0',
      'hash': '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b',
      'name': '2022-05-03T06_46_26.060890949Z.rcd',
      'number': 77,
      'previous_hash': '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
      'size': null,
      'timestamp': {
        'from': '1651560386.060890949',
        'to': '1651560389.060890949'
      }
    });

    const result = await mirrorNodeInstance.getBlock(number);
    expect(result).to.exist;
    expect(result.count).equal(3);
    expect(result.number).equal(77);
  });

  const block = {
    'count': 3,
    'hapi_version': '0.27.0',
    'hash': '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b',
    'name': '2022-05-03T06_46_26.060890949Z.rcd',
    'number': 77,
    'previous_hash': '0xf7d6481f659c866c35391ee230c374f163642ebf13a5e604e04a95a9ca48a298dc2dfa10f51bcbaab8ae23bc6d662a0b',
    'size': null,
    'timestamp': {
      'from': '1651560386.060890949',
      'to': '1651560389.060890949'
    }
  };
  it('`getBlocks` by number', async () => {
    const number = 3;
    mock.onGet(`blocks?block.number=${number}&limit=100&order=asc`).reply(200, {blocks: [block], links: {next: null}});

    const result = await mirrorNodeInstance.getBlocks(number);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.blocks.length).to.gt(0);
    const firstBlock = result.blocks[0];
    expect(firstBlock.count).equal(block.count);
    expect(firstBlock.number).equal(block.number);
  });

  it('`getBlocks` by timestamp', async () => {
    const timestamp = '1651560786.960890949';
    mock.onGet(`blocks?timestamp=${timestamp}&limit=100&order=asc`).reply(200, {blocks: [block], links: {next: null}});

    const result = await mirrorNodeInstance.getBlocks(undefined, timestamp);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.blocks.length).to.gt(0);
    const firstBlock = result.blocks[0];
    expect(firstBlock.count).equal(block.count);
    expect(firstBlock.number).equal(block.number);
  });

  it('`getContract`', async () => {
    mock.onGet(`contracts/${mockData.contractEvmAddress}`).reply(200, mockData.contract);
    const result = await mirrorNodeInstance.getContract(mockData.contractEvmAddress);
    expect(result).to.exist;
    expect(result.contract_id).equal('0.0.2000');
  });

  it('`getContract` not found', async () => {
    mock.onGet(`contracts/${mockData.contractEvmAddress}`).reply(404, mockData.notFound);
    const result = await mirrorNodeInstance.getContract(mockData.contractEvmAddress);
    expect(result).to.be.null;
  });

  it('`getAccount`', async () => {
    mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(200, mockData.account);

    const result = await mirrorNodeInstance.getAccount(mockData.accountEvmAddress);
    expect(result).to.exist;
    expect(result.account).equal('0.0.1014');
  });

  it('`getAccount` not found', async () => {
    const evmAddress = '0x00000000000000000000000000000000000003f6';
    mock.onGet(`accounts/${evmAddress}${limitOrderPostFix}`).reply(404, mockData.notFound);

    const result = await mirrorNodeInstance.getAccount(evmAddress);
    expect(result).to.be.null;
  });

  it('`getTokenById`', async () => {
    mock.onGet(`tokens/${mockData.tokenId}`).reply(200, mockData.token);

    const result = await mirrorNodeInstance.getTokenById(mockData.tokenId);
    expect(result).to.exist;
    expect(result.token_id).equal('0.0.13312');
  });

  it('`getTokenById` not found', async () => {
    const tokenId = '0.0.132';
    mock.onGet(`accounts/${tokenId}${limitOrderPostFix}`).reply(404, mockData.notFound);

    const result = await mirrorNodeInstance.getTokenById(tokenId);
    expect(result).to.be.null;
  });

  const detailedContractResult = {
    'access_list': '0x',
    'amount': 2000000000,
    'block_gas_used': 50000000,
    'block_hash': '0x6ceecd8bb224da491',
    'block_number': 17,
    'bloom': '0x0505',
    'call_result': '0x0606',
    'chain_id': '0x',
    'contract_id': '0.0.5001',
    'created_contract_ids': ['0.0.7001'],
    'error_message': null,
    'from': '0x0000000000000000000000000000000000001f41',
    'function_parameters': '0x0707',
    'gas_limit': 1000000,
    'gas_price': '0x4a817c80',
    'gas_used': 123,
    'hash': '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6392',
    'logs': [
      {
        'address': '0x0000000000000000000000000000000000001389',
        'bloom': '0x0123',
        'contract_id': '0.0.5001',
        'data': '0x0123',
        'index': 0,
        'topics': [
          '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
          '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          '0xe8d47b56e8cdfa95f871b19d4f50a857217c44a95502b0811a350fec1500dd67'
        ]
      }
    ],
    'max_fee_per_gas': '0x',
    'max_priority_fee_per_gas': '0x',
    'nonce': 1,
    'r': '0xd693b532a80fed6392b428604171fb32fdbf953728a3a7ecc7d4062b1652c042',
    'result': 'SUCCESS',
    's': '0x24e9c602ac800b983b035700a14b23f78a253ab762deab5dc27e3555a750b354',
    'state_changes': [
      {
        'address': '0x0000000000000000000000000000000000001389',
        'contract_id': '0.0.5001',
        'slot': '0x0000000000000000000000000000000000000000000000000000000000000101',
        'value_read': '0x97c1fc0a6ed5551bc831571325e9bdb365d06803100dc20648640ba24ce69750',
        'value_written': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      }
    ],
    'status': '0x1',
    'timestamp': '167654.000123456',
    'to': '0x0000000000000000000000000000000000001389',
    'transaction_index': 1,
    'type': 2,
    'v': 1
  };

  const contractAddress = '0x000000000000000000000000000000000000055f';
  const contractId = '0.0.5001';

  const defaultCurrentContractState = {
    "state": [
      {
        'address': contractAddress,
        'contract_id': contractId,
        'timestamp': '1653077541.983983199',
        'slot': '0x0000000000000000000000000000000000000000000000000000000000000101',
        'value': '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'
      }
    ]
  };

  it('`getContractResults` by transactionId', async () => {
    const transactionId = '0.0.10-167654-000123456';
    mock.onGet(`contracts/results/${transactionId}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResult(transactionId);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
  });

  it('`getContractResults` by hash', async () => {
    const hash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6391';
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResult(hash);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
  });

  it('`getContractResults` by hash using cache', async () => {
    const hash = '0x07cad7b827375d10d73af57b6a3e84353645fdb1305ea58ff52dda53ec640533';
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);
    const resultBeforeCached = await mirrorNodeInstance.getContractResult(hash);

    mock.onGet(`contracts/results/${hash}`).reply(400, null);
    const resultAfterCached = await mirrorNodeInstance.getContractResult(hash);

    expect(resultBeforeCached).to.eq(resultAfterCached);
  });

  it('`getContractResultsWithRetry` by hash', async () => {
    const hash = '0x4a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6399';
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResultWithRetry(hash);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
    expect(result.transaction_index).equal(detailedContractResult.transaction_index);
    expect(mock.history.get.length).to.eq(1); // is called once
  });

  it('`getContractResultsWithRetry` by hash retries once because of missing transaction_index', async () => {
    const hash = '0x2a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6397';
    mock.onGet(`contracts/results/${hash}`).replyOnce(200, {...detailedContractResult, transaction_index: undefined});
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResultWithRetry(hash);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
    expect(result.transaction_index).equal(detailedContractResult.transaction_index);
    expect(mock.history.get.length).to.eq(2); // is called twice
  });

  it('`getContractResultsWithRetry` by hash retries once because of missing transaction_index and block_number', async () => {
    const hash = '0x2a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb6393';
    mock.onGet(`contracts/results/${hash}`).replyOnce(200, {...detailedContractResult, transaction_index: undefined, block_number: undefined});
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResultWithRetry(hash);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
    expect(result.transaction_index).equal(detailedContractResult.transaction_index);
    expect(result.block_number).equal(detailedContractResult.block_number);
    expect(mock.history.get.length).to.eq(2); // is called twice
  });

  it('`getContractResultsWithRetry` by hash retries once because of missing block_number', async () => {
    const hash = '0x2a563af33c4871b51a8b108aa2fe1dd5280a30dfb7236170ae5e5e7957eb3391';
    mock.onGet(`contracts/results/${hash}`).replyOnce(200, {...detailedContractResult, block_number: undefined});
    mock.onGet(`contracts/results/${hash}`).reply(200, detailedContractResult);

    const result = await mirrorNodeInstance.getContractResultWithRetry(hash);
    expect(result).to.exist;
    expect(result.contract_id).equal(detailedContractResult.contract_id);
    expect(result.to).equal(detailedContractResult.to);
    expect(result.v).equal(detailedContractResult.v);
    expect(result.block_number).equal(detailedContractResult.block_number);
    expect(mock.history.get.length).to.eq(2); // is called twice
  });

  it('`getContractResults` detailed', async () => {
    mock.onGet(`contracts/results?limit=100&order=asc`).reply(200, { results: [detailedContractResult], links: { next: null } });

    const result = await mirrorNodeInstance.getContractResults();
    expect(result).to.exist;
    expect(result.links).to.not.exist;
    expect(result.length).to.gt(0);
    const firstResult = result[0];
    expect(firstResult.contract_id).equal(detailedContractResult.contract_id);
    expect(firstResult.to).equal(detailedContractResult.to);
    expect(firstResult.v).equal(detailedContractResult.v);
  });

  const contractResult = {
    'amount': 30,
    'bloom': '0x0505',
    'call_result': '0x0606',
    'contract_id': '0.0.5001',
    'created_contract_ids': ['0.0.7001'],
    'error_message': null,
    'from': '0x0000000000000000000000000000000000001f41',
    'function_parameters': '0x0707',
    'gas_limit': 9223372036854775807,
    'gas_used': 9223372036854775806,
    'timestamp': '987654.000123456',
    'to': '0x0000000000000000000000000000000000001389'
  };
  it('`getContractResults` by id', async () => {
    const contractId = '0.0.5001';
    mock.onGet(`contracts/${contractId}/results?limit=100&order=asc`).reply(200, { results: [contractResult], links: { next: null } });

    const result = await mirrorNodeInstance.getContractResultsByAddress(contractId);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.results.length).to.gt(0);
    const firstResult = result.results[0];
    expect(firstResult.contract_id).equal(detailedContractResult.contract_id);
    expect(firstResult.function_parameters).equal(contractResult.function_parameters);
    expect(firstResult.to).equal(contractResult.to);
  });

  it('`getContractResults` by address', async () => {
    const address = '0x0000000000000000000000000000000000001f41';
    mock.onGet(`contracts/${address}/results?limit=100&order=asc`).reply(200, { results: [contractResult], links: { next: null } });

    const result = await mirrorNodeInstance.getContractResultsByAddress(address);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.results.length).to.gt(0);
    const firstResult = result.results[0];
    expect(firstResult.contract_id).equal(detailedContractResult.contract_id);
    expect(firstResult.function_parameters).equal(contractResult.function_parameters);
    expect(firstResult.to).equal(contractResult.to);
  });

  it('`getLatestContractResultsByAddress` by address no timestamp', async () => {
    const address = '0x0000000000000000000000000000000000001f41';
    mock.onGet(`contracts/${address}/results?limit=1&order=desc`).reply(200, { results: [contractResult], links: { next: null } });

    const result = await mirrorNodeInstance.getLatestContractResultsByAddress(address, undefined, 1);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.results.length).to.gt(0);
    const firstResult = result.results[0];
    expect(firstResult.contract_id).equal(detailedContractResult.contract_id);
    expect(firstResult.function_parameters).equal(contractResult.function_parameters);
    expect(firstResult.to).equal(contractResult.to);
  });

  it('`getLatestContractResultsByAddress` by address with timestamp, limit 2', async () => {
    const address = '0x0000000000000000000000000000000000001f41';
    mock.onGet(`contracts/${address}/results?timestamp=lte:987654.000123456&limit=2&order=desc`).reply(200, { results: [contractResult], links: { next: null } });

    const result = await mirrorNodeInstance.getLatestContractResultsByAddress(address, "987654.000123456", 2);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.results.length).to.gt(0);
    const firstResult = result.results[0];
    expect(firstResult.contract_id).equal(detailedContractResult.contract_id);
    expect(firstResult.function_parameters).equal(contractResult.function_parameters);
    expect(firstResult.to).equal(contractResult.to);
  });

  const log = {
    'address': '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    'bloom': '0x549358c4c2e573e02410ef7b5a5ffa5f36dd7398',
    'contract_id': '0.1.2',
    'data': '0x00000000000000000000000000000000000000000000000000000000000000fa',
    'index': 0,
    'topics': [
      '0xf4757a49b326036464bec6fe419a4ae38c8a02ce3e68bf0809674f6aab8ad300'
    ],
    'root_contract_id': '0.1.2',
    'timestamp': '1586567700.453054000'
  };
  it('`getContractResultsLogs` ', async () => {
    mock.onGet(`contracts/results/logs?limit=100&order=asc`).reply(200, { logs: [log] });

    const results = await mirrorNodeInstance.getContractResultsLogs();
    expect(results).to.exist;
    expect(results.length).to.gt(0);
    const firstResult = results[0];
    expect(firstResult.address).equal(log.address);
    expect(firstResult.contract_id).equal(log.contract_id);
    expect(firstResult.index).equal(log.index);
  });

  it('`getContractResultsLogsByAddress` ', async () => {
    mock.onGet(`contracts/${log.address}/results/logs?limit=100&order=asc`).reply(200, { logs: [log] });

    const results = await mirrorNodeInstance.getContractResultsLogsByAddress(log.address);
    expect(results).to.exist;
    expect(results.length).to.gt(0);
    const firstResult = results[0];
    expect(firstResult.address).equal(log.address);
    expect(firstResult.contract_id).equal(log.contract_id);
    expect(firstResult.index).equal(log.index);
  });

  it('`getContractCurrentStateByAddressAndSlot`', async () => {
    mock.onGet(`contracts/${contractAddress}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`).reply(200, defaultCurrentContractState);
    const result = await mirrorNodeInstance.getContractStateByAddressAndSlot(contractAddress, defaultCurrentContractState.state[0].slot);

    expect(result).to.exist;
    expect(result.state).to.exist;
    expect(result.state[0].value).to.eq(defaultCurrentContractState.state[0].value);
  });

  it('`getContractCurrentStateByAddressAndSlot` - incorrect address', async () => {
    mock.onGet(`contracts/${contractAddress}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`).reply(200, defaultCurrentContractState);
    try {
      expect(await mirrorNodeInstance.getContractStateByAddressAndSlot(contractAddress+'1', defaultCurrentContractState.state[0].slot)).to.throw();
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it('`getContractCurrentStateByAddressAndSlot` - incorrect slot', async () => {
    mock.onGet(`contracts/${contractAddress}/state?slot=${defaultCurrentContractState.state[0].slot}&limit=100&order=desc`).reply(200, defaultCurrentContractState);
    try {
      expect(await mirrorNodeInstance.getContractStateByAddressAndSlot(contractAddress, defaultCurrentContractState.state[0].slot+'1')).to.throw();
    } catch (error) {
      expect(error).to.exist;
    }
  });

  it('`getContractResultsLogsByAddress` - incorrect address', async () => {
    mock.onGet(`contracts/${log.address}/results/logs?limit=100&order=asc`).reply(200, { logs: [log] });

    const incorrectAddress = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ed';
    try {
      expect(await mirrorNodeInstance.getContractResultsLogsByAddress(incorrectAddress)).to.throw();
    }
    catch(err: any) {
      expect(err).to.exist;
    }
  });

  it('`getBlocks` by number', async () => {
    mock.onGet(`blocks?limit=1&order=desc`).reply(200, block);

    const result = await mirrorNodeInstance.getLatestBlock();
    expect(result).to.exist;
    expect(result.count).equal(block.count);
    expect(result.number).equal(block.number);
  });

  it('`getBlocks` should hit the cache', async () => {
    const hash = '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b';
    mock.onGet(`blocks/${hash}`).replyOnce(200, {
      'hash': '0x3c08bbbee74d287b1dcd3f0ca6d1d2cb92c90883c4acf9747de9f3f3162ad25b999fc7e86699f60f2a3fb3ed9a646c6b',
      'number': 77
    });

    for (let i = 0; i < 3; i++) {
      const result = await mirrorNodeInstance.getBlock(hash);
      expect(result).to.exist;
      expect(result.hash).equal(hash);
      expect(result.number).equal(77);
    }
  });

  it('`getNetworkExchangeRate`', async () => {
    const exchangerate = {
      'current_rate': {
        'cent_equivalent': 596987,
        'expiration_time': 1649689200,
        'hbar_equivalent': 30000
      },
      'next_rate': {
        'cent_equivalent': 596987,
        'expiration_time': 1649689200,
        'hbar_equivalent': 30000
      },
      'timestamp': '1586567700.453054000'
    };

    mock.onGet(`network/exchangerate`).reply(200, exchangerate);

    const result = await mirrorNodeInstance.getNetworkExchangeRate();
    expect(result).to.exist;
    expect(result.current_rate).to.exist;
    expect(result.next_rate).to.exist;
    expect(result).to.exist;
    expect(result.current_rate.cent_equivalent).equal(exchangerate.current_rate.cent_equivalent);
    expect(result.next_rate.hbar_equivalent).equal(exchangerate.next_rate.hbar_equivalent);
    expect(result.timestamp).equal(exchangerate.timestamp);
  });

  describe('resolveEntityType', async () => {
    const notFoundAddress = random20BytesAddress();
    it('returns `contract` when CONTRACTS endpoint returns a result', async() => {
      mock.onGet(`contracts/${mockData.contractEvmAddress}`).reply(200, mockData.contract);
      mock.onGet(`accounts/${mockData.contractEvmAddress}${limitOrderPostFix}`).reply(200, mockData.account);
      mock.onGet(`tokens/${mockData.contractEvmAddress}`).reply(404, mockData.notFound);

      const entityType = await mirrorNodeInstance.resolveEntityType(mockData.contractEvmAddress);
      expect(entityType).to.exist;
      expect(entityType).to.have.property('type');
      expect(entityType).to.have.property('entity');
      expect(entityType.type).to.eq('contract');
      expect(entityType.entity).to.have.property('contract_id');
      expect(entityType.entity.contract_id).to.eq(mockData.contract.contract_id);
    });

    it('returns `account` when CONTRACTS and TOKENS endpoint returns 404 and ACCOUNTS endpoint returns a result', async() => {
      mock.onGet(`contracts/${mockData.accountEvmAddress}`).reply(404, mockData.notFound);
      mock.onGet(`accounts/${mockData.accountEvmAddress}${limitOrderPostFix}`).reply(200, mockData.account);
      mock.onGet(`tokens/${mockData.tokenId}`).reply(404, mockData.notFound);

      const entityType = await mirrorNodeInstance.resolveEntityType(mockData.accountEvmAddress);
      expect(entityType).to.exist;
      expect(entityType).to.have.property('type');
      expect(entityType).to.have.property('entity');
      expect(entityType.type).to.eq('account');
      expect(entityType.entity).to.have.property('account');
      expect(entityType.entity.account).to.eq(mockData.account.account);
    });

    it('returns `token` when CONTRACTS and ACCOUNTS endpoints returns 404 and TOKEN endpoint returns a result', async() => {
      mock.onGet(`contracts/${notFoundAddress}`).reply(404, mockData.notFound);
      mock.onGet(`accounts/${notFoundAddress}${limitOrderPostFix}`).reply(404, mockData.notFound);
      mock.onGet(`tokens/${mockData.tokenId}`).reply(200, mockData.token);

      const entityType = await mirrorNodeInstance.resolveEntityType(mockData.tokenLongZero);
      expect(entityType).to.exist;
      expect(entityType).to.have.property('type');
      expect(entityType).to.have.property('entity');
      expect(entityType.type).to.eq('token');
      expect(entityType.entity.token_id).to.eq(mockData.tokenId);
    });

    it('returns null when CONTRACTS and ACCOUNTS endpoints return 404', async() => {
      mock.onGet(`contracts/${notFoundAddress}`).reply(404, mockData.notFound);
      mock.onGet(`accounts/${notFoundAddress}${limitOrderPostFix}`).reply(404, mockData.notFound);
      mock.onGet(`tokens/${notFoundAddress}`).reply(404, mockData.notFound);

      const entityType = await mirrorNodeInstance.resolveEntityType(notFoundAddress);
      expect(entityType).to.be.null;
    });

    it('calls mirror node tokens API when token is long zero type', async() => {
      mock.onGet(`contracts/${mockData.tokenId}`).reply(404, mockData.notFound);
      mock.onGet(`tokens/${mockData.tokenId}`).reply(200, mockData.token);

      const entityType = await mirrorNodeInstance.resolveEntityType(mockData.tokenLongZero, [constants.TYPE_CONTRACT, constants.TYPE_TOKEN]); 
      expect(entityType).to.exist;
      expect(entityType).to.have.property('type');
      expect(entityType).to.have.property('entity');
      expect(entityType.type).to.eq('token');
      expect(entityType.entity.token_id).to.eq(mockData.tokenId);
    });

    it('does not call mirror node tokens API when token is not long zero type', async() => {
      mock.onGet(`contracts/${mockData.contractEvmAddress}`).reply(200, mockData.contract);
      mock.onGet(`tokens/${mockData.tokenId}`).reply(404, mockData.notFound);

      const entityType = await mirrorNodeInstance.resolveEntityType(mockData.contractEvmAddress, [constants.TYPE_CONTRACT, constants.TYPE_TOKEN]); 
      expect(entityType).to.exist;
      expect(entityType).to.have.property('type');
      expect(entityType).to.have.property('entity');
      expect(entityType.type).to.eq('contract');
      expect(entityType.entity).to.have.property('contract_id');
      expect(entityType.entity.contract_id).to.eq(mockData.contract.contract_id);
    });
  });

  describe('getTransactionById', async() => {
    const defaultTransactionId = '0.0.2@1681130064.409933500';
    const defaultTransactionIdFormatted = '0.0.2-1681130064-409933500';
    const invalidTransactionId = '0.0.2@168113222220.409933500';
    const defaultTransaction = {
      transactions: [
        {
          bytes: null,
          charged_tx_fee: 56800000,
          consensus_timestamp: '1681130077.127938923',
          entity_id: null,
          max_fee: '1080000000',
          memo_base64: '',
          name: 'ETHEREUMTRANSACTION',
          node: '0.0.3',
          nonce: 0,
          parent_consensus_timestamp: null,
          result: 'CONTRACT_REVERT_EXECUTED',
          scheduled: false,
          staking_reward_transfers: [],
          transaction_hash: 'uUHtwzFBlpHzp20OCJtjk4m6yFi93TZem7pKYrjgaF0v383um84g/Jo+uP2IrRd7',
          transaction_id: '0.0.2-1681130064-409933500',
          transfers: [],
          valid_duration_seconds: '120',
          valid_start_timestamp: '1681130064.409933500'
        },
        {
          bytes: null,
          charged_tx_fee: 0,
          consensus_timestamp: '1681130077.127938924',
          entity_id: null,
          max_fee: '0',
          memo_base64: '',
          name: 'TOKENCREATION',
          node: null,
          nonce: 1,
          parent_consensus_timestamp: '1681130077.127938923',
          result: 'INVALID_FULL_PREFIX_SIGNATURE_FOR_PRECOMPILE',
          scheduled: false,
          staking_reward_transfers: [],
          transaction_hash: 'EkQUvik9b4QUvymTNX90ybTz1SNobpQ5huQmMCKkP3fjOxirLT0nRel+w4bweXyX',
          transaction_id: '0.0.2-1681130064-409933500',
          transfers: [],
          valid_duration_seconds: null,
          valid_start_timestamp: '1681130064.409933500'
        }
      ]
    };

    const transactionId = '0.0.902-1684375868-230217103';

    it('should be able to fetch transaction by transaction id', async() => {
      mock.onGet(`transactions/${defaultTransactionIdFormatted}`).reply(200, defaultTransaction);
      const transaction = await mirrorNodeInstance.getTransactionById(defaultTransactionId);
      expect(transaction).to.exist;
      expect(transaction.transactions.length).to.equal(defaultTransaction.transactions.length);
    });

    it('should be able to fetch transaction by transaction id and nonce', async() => {
      mock.onGet(`transactions/${defaultTransactionIdFormatted}?nonce=1`).reply(200, defaultTransaction.transactions[1]);
      const transaction = await mirrorNodeInstance.getTransactionById(defaultTransactionId, 1);
      expect(transaction).to.exist;
      expect(transaction.transaction_id).to.equal(defaultTransaction.transactions[1].transaction_id);
      expect(transaction.result).to.equal(defaultTransaction.transactions[1].result);
    });

    it('should fail to fetch transaction by wrong transaction id', async() => {
      mock.onGet(`transactions/${invalidTransactionId}`).reply(404, mockData.notFound);
      const transaction = await mirrorNodeInstance.getTransactionById(invalidTransactionId);
      expect(transaction).to.be.null;
    });

    it('should get the state of a null transaction when the contract reverts', async() => {
      const error = new SDKClientError({
          status: { _code: 33 },
          message: 'Error: receipt for transaction 0.0.902@1684375868.230217103 contained error status',
      });
      mock.onGet(`transactions/${transactionId}`).reply(200, null);

      const id = uuid();
      const requestIdPrefix = formatRequestIdMessage(id);

      const result = await mirrorNodeInstance.getContractRevertReasonFromTransaction(error, id, requestIdPrefix);
      expect(result).to.be.null;
    });

    it('should get the state of an empty transaction when the contract reverts', async() => {
      const error = new SDKClientError({
          status: { _code: 33 },
          message: 'Error: receipt for transaction 0.0.902@1684375868.230217103 contained error status',
      });
      mock.onGet(`transactions/${transactionId}`).reply(200, []);

      const id = uuid();
      const requestIdPrefix = formatRequestIdMessage(id);

      const result = await mirrorNodeInstance.getContractRevertReasonFromTransaction(error, id, requestIdPrefix);
      expect(result).to.be.null;
    });

    it('should get the state of a failed transaction when the contract reverts', async() => {
      const error = new SDKClientError({
          status: { _code: 33 },
          message: 'Error: receipt for transaction 0.0.902@1684375868.230217103 contained error status',
      });
      mock.onGet(`transactions/${transactionId}`).reply(200, defaultTransaction);

      const id = uuid();
      const requestIdPrefix = formatRequestIdMessage(id);

      const result = await mirrorNodeInstance.getContractRevertReasonFromTransaction(error, id, requestIdPrefix);
      expect(result).to.eq('INVALID_FULL_PREFIX_SIGNATURE_FOR_PRECOMPILE');
    });


  });

  describe('getPaginatedResults', async() => {

    const mockPages = (pages) => {
      let mockedResults: any[] = [];
      for (let i = 0; i < pages; i++) {
        const results = [{foo: `bar${i}`}];
        mockedResults = mockedResults.concat(results);
        const nextPage = i !== pages - 1 ? `results?page=${i + 1}` : null;
        mock.onGet(`results?page=${i}`).reply(200, {
          genericResults: results,
          links: {
            next: nextPage
          }
        });
      }

      return mockedResults;
    };

    it('works when there is only 1 page', async () => {
      const mockedResults = [{
        foo: `bar11`
      }];

      mock.onGet(`results`).reply(200, {
        genericResults: mockedResults,
        links: {
          next: null
        }
      });

      const results = await mirrorNodeInstance.getPaginatedResults(
          'results',
          'results',
          'genericResults');

      expect(results).to.exist;
      expect(results).to.deep.equal(mockedResults);

    });

    it('works when there are several pages', async () => {
      const pages = 5;
      const mockedResults = mockPages(pages);

      const results = await mirrorNodeInstance.getPaginatedResults(
          'results?page=0',
          'results',
          'genericResults');

      expect(results).to.exist;
      expect(results.length).to.eq(pages);
      expect(results).to.deep.equal(mockedResults);
    });

    it('stops paginating when it reaches MAX_MIRROR_NODE_PAGINATION', async () => {
      const pages = constants.MAX_MIRROR_NODE_PAGINATION * 2;
      mockPages(pages);

      try {
        await mirrorNodeInstance.getPaginatedResults(
          'results?page=0',
          'results',
          'genericResults');        expect.fail('should have thrown an error');
      } catch (e) {
        const errorRef = predefined.RANGE_TOO_LARGE(0); // reference error for all properties except message
        expect(e.message).to.equal(`Exceeded maximum block range: ${constants.MAX_MIRROR_NODE_PAGINATION}`);
        expect(e.code).to.equal(errorRef.code);
        expect(e.name).to.equal(errorRef.name);
      }
    });
  });
});

