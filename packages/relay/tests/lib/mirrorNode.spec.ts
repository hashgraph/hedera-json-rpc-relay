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
import MirrorNode from '../../dist/lib/mirrorNode';

import pino from 'pino';
const logger = pino();

describe('MirrorNode', async function() {
  this.timeout(10000);
  const mirrorNodeInstance = new MirrorNode(process.env.MIRROR_NODE_URL, logger.child({ name: `mirror-node`}));

  it('it should have a `request` method ', async () => {
    expect(mirrorNodeInstance).to.exist;
    expect(mirrorNodeInstance.request).to.exist;
  });

  it('`baseUrl` is exposed and correct', async () => {
    expect(mirrorNodeInstance.baseUrl).to.eq(`https://${process.env.MIRROR_NODE_URL}/api/v1/`);
  });

  it('`request` works', async () => {
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


});
