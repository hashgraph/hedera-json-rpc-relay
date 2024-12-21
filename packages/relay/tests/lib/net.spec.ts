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
import pino from 'pino';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { RelayImpl } from '../../src/lib/relay';
import constants from '../../src/lib/constants';
import { withOverriddenEnvsInMochaTest } from '../helpers';
import { ConfigName } from '../../../config-service/src/services/configName';

const logger = pino();
let Relay;

describe('Net', async function () {
  this.beforeEach(() => {
    Relay = new RelayImpl(logger, new Registry());
  });

  it('should execute "net_listening"', function () {
    const result = Relay.net().listening();
    expect(result).to.eq(false);
  });

  it('should execute "net_version"', function () {
    const hederaNetwork: string = ((ConfigService.get(ConfigName.HEDERA_NETWORK) as string) || '{}').toLowerCase();
    let expectedNetVersion = ConfigService.get(ConfigName.CHAIN_ID) || constants.CHAIN_IDS[hederaNetwork] || '298';
    if (expectedNetVersion.startsWith('0x')) expectedNetVersion = parseInt(expectedNetVersion, 16).toString();

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

  withOverriddenEnvsInMochaTest({ HEDERA_NETWORK: undefined, CHAIN_ID: undefined }, () => {
    it('should default chainId to 298 when no environment variables are set', () => {
      Relay = new RelayImpl(logger, new Registry());
      const actualNetVersion = Relay.net().version();
      expect(actualNetVersion).to.equal('298');
    });
  });

  withOverriddenEnvsInMochaTest({ HEDERA_NETWORK: '', CHAIN_ID: undefined }, () => {
    it('should handle empty HEDERA_NETWORK and set chainId to default', () => {
      Relay = new RelayImpl(logger, new Registry());
      const actualNetVersion = Relay.net().version();
      expect(actualNetVersion).to.equal('298');
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
