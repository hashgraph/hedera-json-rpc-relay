import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

import { expect } from 'chai';
import { BridgeImpl } from 'bridge';

const Bridge = new BridgeImpl();

describe('Eth', async function() {
  it('should execute "eth_chainId"', async function() {
    const chainId = await Bridge.eth().chainId();

    expect(chainId).to.be.equal(process.env.CHAIN_ID);
  });
  it('should execute "eth_accounts"', async function() {
    const accounts = await Bridge.eth().accounts();

    expect(accounts).to.be.an('Array');
    expect(accounts.length).to.be.equal(0);
  });
  it('should execute "web3_clientVersion"', async function() {
    const clientVersion = await Bridge.web3().clientVersion();

    expect(clientVersion).to.be.equal(process.env.npm_package_version);
  });
});
