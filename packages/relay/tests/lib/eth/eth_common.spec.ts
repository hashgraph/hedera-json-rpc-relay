// SPDX-License-Identifier: Apache-2.0

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import pino from 'pino';
import { Registry } from 'prom-client';

import { RelayImpl } from '../../../src';
import { RequestDetails } from '../../../src/lib/types';

use(chaiAsPromised);

describe('@ethCommon', async function () {
  let Relay: RelayImpl;
  this.timeout(10000);

  const requestDetails = new RequestDetails({ requestId: 'eth_commonTest', ipAddress: '0.0.0.0' });

  this.beforeAll(() => {
    Relay = new RelayImpl(pino({ level: 'silent' }), new Registry());
  });

  describe('@ethCommon', async function () {
    it('should execute "eth_chainId"', async function () {
      const chainId = Relay.eth().chainId(requestDetails);
      expect(chainId).to.be.equal(ConfigService.get('CHAIN_ID'));
    });

    it('should execute "eth_accounts"', async function () {
      const accounts = Relay.eth().accounts(requestDetails);

      expect(accounts).to.be.an('Array');
      expect(accounts.length).to.be.equal(0);
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
      const result = await Relay.eth().getUncleByBlockHashAndIndex(requestDetails);
      expect(result).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
      const result = await Relay.eth().getUncleByBlockNumberAndIndex(requestDetails);
      expect(result).to.be.null;
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
      const result = await Relay.eth().getUncleCountByBlockHash(requestDetails);
      expect(result).to.eq('0x0');
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
      const result = await Relay.eth().getUncleCountByBlockNumber(requestDetails);
      expect(result).to.eq('0x0');
    });

    it('should execute "eth_hashrate"', async function () {
      const result = await Relay.eth().hashrate(requestDetails);
      expect(result).to.eq('0x0');
    });

    it('should execute "eth_mining"', async function () {
      const result = await Relay.eth().mining(requestDetails);
      expect(result).to.eq(false);
    });

    it('should execute "eth_submitWork"', async function () {
      const result = await Relay.eth().submitWork(requestDetails);
      expect(result).to.eq(false);
    });

    it('should execute "eth_syncing"', async function () {
      const result = await Relay.eth().syncing(requestDetails);
      expect(result).to.eq(false);
    });

    it('should execute "eth_getWork"', async function () {
      const result = Relay.eth().getWork(requestDetails);
      expect(result).to.have.property('code');
      expect(result.code).to.be.equal(-32601);
      expect(result).to.have.property('message');
      expect(result.message).to.be.equal('Unsupported JSON-RPC method');
    });

    it('should execute "eth_maxPriorityFeePerGas"', async function () {
      const result = await Relay.eth().maxPriorityFeePerGas(requestDetails);
      expect(result).to.eq('0x0');
    });
  });
});
