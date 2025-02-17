// SPDX-License-Identifier: Apache-2.0

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
