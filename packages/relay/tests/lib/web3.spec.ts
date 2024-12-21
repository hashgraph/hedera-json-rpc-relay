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

import { ConfigName } from '../../../config-service/src/services/configName';
import { RelayImpl } from '../../src';
import { withOverriddenEnvsInMochaTest } from '../helpers';

const logger = pino();
const Relay = new RelayImpl(logger, new Registry());

describe('Web3', function () {
  withOverriddenEnvsInMochaTest({ npm_package_version: '1.0.0' }, () => {
    it('should return "relay/1.0.0"', async function () {
      const clientVersion = Relay.web3().clientVersion();
      expect(clientVersion).to.be.equal('relay/' + ConfigService.get(ConfigName.npm_package_version));
    });
  });

  withOverriddenEnvsInMochaTest({ npm_package_version: undefined }, () => {
    it('should return "relay/"', () => {
      const version = Relay.web3().clientVersion();
      expect(version).to.equal('relay/');
    });
  });
});
