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

import path from 'path';
import dotenv from 'dotenv';
import { expect } from 'chai';
dotenv.config({ path: path.resolve(__dirname, '../test.env') });
import {MirrorNodeClient} from '../../src/lib/clients/mirrorNodeClient';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import pino from 'pino';
const logger = pino();

describe('MirrorNodeClient', async function() {
  this.timeout(10000);

    // mock axios
    const instance = axios.create({
      baseURL: 'https://localhost:5551/api/v1',
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10 * 1000
    });;
    const mock = new MockAdapter(instance);
  const mirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node`}), instance);

  it('it should have a `request` method ', async () => {
    expect(mirrorNodeInstance).to.exist;
    expect(mirrorNodeInstance.request).to.exist;
  });

  it('`baseUrl` is exposed and correct', async () => {
    const prodMirrorNodeInstance = new MirrorNodeClient(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node`}));
    expect(prodMirrorNodeInstance.baseUrl).to.eq(`https://${process.env.MIRROR_NODE_URL}/api/v1/`);
  });

  it('`request` works', async () => {
    mock.onGet('accounts').reply(200, {
      'accounts':[
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
    const result = await mirrorNodeInstance.request('accounts');
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

  it('call to non-existing REST route returns INTERNAL_ERROR', async () => {
    try {
      expect(await mirrorNodeInstance.request('non-existing-route')).to.throw();
    } catch (err: any) {
      expect(err.code).to.eq(-32603);
      expect(err.name).to.eq('Internal error');
      expect(err.message).to.eq('Unknown error invoking RPC');
    }
  });

  it('`getAccountLatestTransactionByAddress` works', async () => {
    const alias = 'HIQQEXWKW53RKN4W6XXC4Q232SYNZ3SZANVZZSUME5B5PRGXL663UAQA';
    mock.onGet(`accounts/${alias}?order=desc&limit=1`).reply(200, {
      'transactions':[
        {
          'nonce': 3,
        }
      ],
      'links': {
        'next': null
      }
    });
    
    const result = await mirrorNodeInstance.getAccountLatestTransactionByAddress(alias);
    expect(result).to.exist;
    expect(result.links).to.exist;
    expect(result.links.next).to.equal(null);
    expect(result.transactions.length).to.gt(0);
    expect(result.transactions[0].nonce).to.equal(3);
  });

  it('`getBlock by Hash` works', async () => {
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
});
