// SPDX-License-Identifier: Apache-2.0

import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { expect } from 'chai';
import pino from 'pino';
import { Registry } from 'prom-client';

import { RelayImpl } from '../../src';
import { withOverriddenEnvsInMochaTest } from '../helpers';

const logger = pino({ level: 'silent' });
const Relay = new RelayImpl(logger, new Registry());

describe('Web3', function () {
  withOverriddenEnvsInMochaTest({ npm_package_version: '1.0.0' }, () => {
    it('should return "relay/1.0.0"', async function () {
      const clientVersion = Relay.web3().clientVersion();
      expect(clientVersion).to.be.equal('relay/' + ConfigService.get('npm_package_version'));
    });
  });

  withOverriddenEnvsInMochaTest({ npm_package_version: undefined }, () => {
    it('should throw an error if npm_package_version is undefined', () => {
      expect(() => Relay.web3().clientVersion()).to.throw(
        'Configuration error: npm_package_version is a mandatory configuration for relay operation.',
      );
    });
  });
});
