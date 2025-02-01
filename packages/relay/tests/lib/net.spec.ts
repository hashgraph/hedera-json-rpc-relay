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

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { expect } from 'chai';
import pino from 'pino';
import { Registry } from 'prom-client';

import { RelayImpl } from '../../src/lib/relay';
import { withOverriddenEnvsInMochaTest } from '../helpers';

const logger = pino({ level: 'silent' });
let Relay;

describe('Net', async function () {
  it('should execute "net_listening"', function () {
    Relay = new RelayImpl(logger, new Registry());
    const result = Relay.net().listening();
    expect(result).to.eq(false);
  });

  it('should execute "net_version"', function () {
    Relay = new RelayImpl(logger, new Registry());
    let expectedNetVersion = parseInt(ConfigService.get('CHAIN_ID'), 16).toString();

    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.eq(expectedNetVersion);
  });

  withOverriddenEnvsInMochaTest({ CHAIN_ID: '123' }, () => {
    it('should set chainId from CHAIN_ID environment variable', () => {
      Relay = new RelayImpl(logger, new Registry());
      const actualNetVersion = Relay.net().version();
      expect(actualNetVersion).to.equal('123');
    });
  });

  withOverriddenEnvsInMochaTest({ CHAIN_ID: '0x1a' }, () => {
    it('should set chainId from CHAIN_ID environment variable starting with 0x', () => {
      Relay = new RelayImpl(logger, new Registry());
      const actualNetVersion = Relay.net().version();
      expect(actualNetVersion).to.equal('26'); // 0x1a in decimal is 26
    });
  });

  withOverriddenEnvsInMochaTest({ HEDERA_NETWORK: undefined }, () => {
    it('should throw error if required configuration is set to undefined', () => {
      expect(() => new RelayImpl(logger, new Registry())).to.throw(
        'Configuration error: HEDERA_NETWORK is a mandatory configuration for relay operation.',
      );
    });
  });

  withOverriddenEnvsInMochaTest({ HEDERA_NETWORK: 'mainnet', CHAIN_ID: '0x2' }, () => {
    it('should prioritize CHAIN_ID over HEDERA_NETWORK', () => {
      Relay = new RelayImpl(logger, new Registry());
      const actualNetVersion = Relay.net().version();
      expect(actualNetVersion).to.equal('2'); // 0x2 in decimal is 2
    });
  });
});
