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

import { EnvProviderService } from '@hashgraph/env-provider/dist/services';
EnvProviderService.hotReload();
import { expect } from 'chai';
import { Registry } from 'prom-client';
import { RelayImpl } from '../../src/lib/relay';
import pino from 'pino';

const logger = pino();
const Relay = new RelayImpl(logger, new Registry());

describe('Web3', function () {
  it('should execute "web3_clientVersion"', async function () {
    EnvProviderService.getInstance().dynamicOverride('npm_package_version', '1.0.0');
    const clientVersion = Relay.web3().clientVersion();

    expect(clientVersion).to.be.equal('relay/' + EnvProviderService.getInstance().get('npm_package_version'));
  });

  it('should return "relay/" when npm_package_version is not set', () => {
    EnvProviderService.getInstance().remove('npm_package_version');
    const version = Relay.web3().clientVersion();

    expect(version).to.equal('relay/');
  });
});
