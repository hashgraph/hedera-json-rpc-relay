import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

import { expect } from 'chai';
import MirrorNode from './../../dist/lib/mirrorNode';

describe('MirrorNode', async function() {
  this.timeout(10000);

  it('it should have a `request` method ', async () => {
    expect(MirrorNode).to.exist;
    expect(MirrorNode.request).to.exist;
  });

  it('`baseUrl` is exposed and correct', async () => {
    expect(MirrorNode.baseUrl).to.eq(`https://${process.env.MIRROR_NODE_URL}/api/v1/`);
  });

  it('`request` works', async () => {
    const result = await MirrorNode.request('accounts');
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
      expect(await MirrorNode.request('non-existing-route')).to.throw();
    } catch (err: any) {
      expect(err.code).to.eq(-32603);
      expect(err.name).to.eq('Internal error');
      expect(err.message).to.eq('Unknown error invoking RPC');
    }
  });


});
