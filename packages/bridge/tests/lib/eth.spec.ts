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

  it('should execute "eth_getUncleByBlockHashAndIndex"', async function() {
    const result = await Bridge.eth().getUncleByBlockHashAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleByBlockNumberAndIndex"', async function() {
    const result = await Bridge.eth().getUncleByBlockNumberAndIndex();
    expect(result).to.be.null;
  });

  it('should execute "eth_getUncleCountByBlockHash"', async function() {
    const result = await Bridge.eth().getUncleCountByBlockHash();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_getUncleCountByBlockNumber"', async function() {
    const result = await Bridge.eth().getUncleCountByBlockNumber();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_hashrate"', async function() {
    const result = await Bridge.eth().hashrate();
    expect(result).to.eq('0x0');
  });

  it('should execute "eth_mining"', async function() {
    const result = await Bridge.eth().mining();
    expect(result).to.eq(false);
  });

  it('should execute "eth_submitWork"', async function() {
    const result = await Bridge.eth().submitWork();
    expect(result).to.eq(false);
  });

  it('should execute "eth_syncing"', async function() {
    const result = await Bridge.eth().syncing();
    expect(result).to.eq(false);
  });

});
