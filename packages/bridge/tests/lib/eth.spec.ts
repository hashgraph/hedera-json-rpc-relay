import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });

import { expect } from 'chai';
import { BridgeImpl } from 'bridge';

const cache = require('js-cache');

const Bridge = new BridgeImpl();

const validateHash = (hash: string, len?: number) => {
  let regex;
  if (len && len > 0) {
    regex = new RegExp(`^0x[a-f0-9]{${len}}$`);
  }
  else {
    regex = new RegExp(`^0x[a-f0-9]*$`);
  }

  return !!hash.match(regex);
}


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

  it('should execute "eth_getTransactionReceipt"', async function() {

    const txHash = '0xb87d5cec7ca895eae9d498be0ae0b32b6370bd0e4d3d9ab8d89da2ed09c64b75';
    const txId = '0.0.29600650-1650032136-831895528';

    cache.set(txHash, txId);

    const receipt = await Bridge.eth().getTransactionReceipt(txHash);

    expect(receipt.blockHash).to.exist;
    expect(validateHash(receipt.blockHash, 64)).to.eq(true);

    expect(receipt.blockNumber).to.exist;

    expect(receipt.contractAddress).to.exist;
    expect(validateHash(receipt.contractAddress, 40)).to.eq(true);

    expect(receipt.cumulativeGasUsed).to.exist;

    expect(receipt.from).to.exist;
    expect(validateHash(receipt.from, 40)).to.eq(true);

    expect(receipt.gasUsed).to.exist;

    expect(receipt.logs).to.exist;
    expect(receipt.logs.length).to.gt(0);

    receipt.logs.forEach(log => {
      expect(log.removed).to.eq(false); // ???

      expect(log.logIndex).to.exist;
      expect(log.logIndex.length).to.gte(3);
      expect(validateHash(log.logIndex)).to.eq(true);

      expect(log.transactionIndex).to.exist;
      expect(log.transactionIndex.length).to.gte(3);
      expect(validateHash(log.transactionIndex)).to.eq(true);

      expect(log.transactionHash).to.exist;
      expect(validateHash(log.transactionHash, 64)).to.eq(true);

      expect(log.blockHash).to.exist;
      expect(validateHash(log.blockHash, 64)).to.eq(true);

      expect(log.blockNumber).to.exist;
      expect(log.blockNumber.length).to.gte(3);
      expect(validateHash(log.blockNumber)).to.eq(true);

      expect(log.address).to.exist;
      expect(validateHash(log.address, 40)).to.eq(true);

      expect(log.data).to.exist;
      expect(validateHash(log.data)).to.eq(true);

      expect(log.topics).to.exist;
      expect(Array.isArray(log.topics)).to.eq(true);

      log.topics.forEach(topic => {
        expect(validateHash(topic, 64)).to.eq(true);
      })
    })

    expect(receipt.logsBloom).to.exist;
    expect(validateHash(receipt.logsBloom, 512)).to.eq(true);

    expect(receipt.status).to.exist;
    expect(receipt.status).to.eq('0x1');

    expect(receipt.to).to.exist;
    expect(validateHash(receipt.to, 40)).to.eq(true);

    expect(receipt.transactionHash).to.exist;
    expect(validateHash(receipt.transactionHash, 64)).to.eq(true);
    expect(receipt.transactionHash).to.eq(txHash);

    expect(receipt.transactionIndex).to.exist;
  });

});
