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

import { EnvProviderService } from '../../src/lib/services/envProviderService';
EnvProviderService.hotReload();
import pino from 'pino';
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { RelayImpl } from '../../src/lib/relay';
import constants from '../../src/lib/constants';

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
    const hederaNetwork: string = (EnvProviderService.getInstance().get('HEDERA_NETWORK') || '{}').toLowerCase();
    let expectedNetVersion =
      EnvProviderService.getInstance().get('CHAIN_ID') || constants.CHAIN_IDS[hederaNetwork] || '298';
    if (expectedNetVersion.startsWith('0x')) expectedNetVersion = parseInt(expectedNetVersion, 16).toString();

    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.eq(expectedNetVersion);
  });

  it('should set chainId from CHAIN_ID environment variable', () => {
    EnvProviderService.getInstance().dynamicOverride('CHAIN_ID', '123');
    Relay = new RelayImpl(logger, new Registry());
    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.equal('123');
  });

  it('should set chainId from CHAIN_ID environment variable starting with 0x', () => {
    EnvProviderService.getInstance().dynamicOverride('CHAIN_ID', '0x1a');
    Relay = new RelayImpl(logger, new Registry());
    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.equal('26'); // 0x1a in decimal is 26
  });

  it('should default chainId to 298 when no environment variables are set', () => {
    EnvProviderService.getInstance().remove('HEDERA_NETWORK');
    EnvProviderService.getInstance().remove('CHAIN_ID');
    Relay = new RelayImpl(logger, new Registry());
    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.equal('298');
  });

  it('should handle empty HEDERA_NETWORK and set chainId to default', () => {
    EnvProviderService.getInstance().dynamicOverride('HEDERA_NETWORK', '');
    EnvProviderService.getInstance().remove('CHAIN_ID');
    Relay = new RelayImpl(logger, new Registry());
    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.equal('298');
  });

  it('should prioritize CHAIN_ID over HEDERA_NETWORK', () => {
    EnvProviderService.getInstance().dynamicOverride('HEDERA_NETWORK', 'mainnet');
    EnvProviderService.getInstance().dynamicOverride('CHAIN_ID', '0x2');
    Relay = new RelayImpl(logger, new Registry());
    const actualNetVersion = Relay.net().version();
    expect(actualNetVersion).to.equal('2'); // 0x2 in decimal is 2
  });
});
