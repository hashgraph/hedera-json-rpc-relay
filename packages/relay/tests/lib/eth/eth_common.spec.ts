/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { expect, use } from 'chai';
import { Registry } from 'prom-client';
import pino from 'pino';
import chaiAsPromised from 'chai-as-promised';
import { RelayImpl } from '../../../src/lib/relay';
import { IRequestDetails } from '../../../src/lib/types/RequestDetails';

dotenv.config({ path: path.resolve(__dirname, '../test.env') });
use(chaiAsPromised);

describe('@ethCommon', async function () {
  let Relay: any;
  let requestIdPrefix: string;
  let requestDetails: IRequestDetails;
  this.timeout(10000);

  this.beforeAll(() => {
    requestIdPrefix = `[Request ID: eth_common]`;
    requestDetails = { requestIdPrefix: `${requestIdPrefix}`, requestIp: '0.0.0.0' };
    const logger = pino();
    const registry = new Registry();
    Relay = new RelayImpl(logger, registry);
  });

  describe('@ethCommon', async function () {
    it('should execute "eth_chainId"', async function () {
      const chainId = Relay.eth().chainId(requestDetails);

      expect(chainId).to.be.equal('0x' + Number(process.env.CHAIN_ID).toString(16));
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
