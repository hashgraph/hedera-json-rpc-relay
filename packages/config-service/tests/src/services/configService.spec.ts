/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ConfigService } from '../../../src/services';
import { ConfigName } from '../../../src/services/configName';

chai.use(chaiAsPromised);

describe('ConfigService tests', async function () {
  it('should log warning when .env is missing', async () => {
    // save current env
    const envBefore = process.env;
    process.env = {};

    // fake invalid env file
    // @ts-ignore
    delete ConfigService.instance;
    // @ts-ignore
    ConfigService.envFileName = 'invalid';

    // @ts-ignore
    expect(() => ConfigService.getInstance()).to.throw();

    // reset normal behaviour
    // @ts-ignore
    delete ConfigService.instance;
    // @ts-ignore
    ConfigService.envFileName = '.env';

    process.env = envBefore;
  });

  it('should be able to get existing env var', async () => {
    const res = ConfigService.get(ConfigName.CHAIN_ID);

    expect(res).to.equal('0x12a');
  });

  it('should return undefined for non-existing variable', async () => {
    const res = ConfigService.get('NON_EXISTING_VAR');

    expect(res).to.equal(undefined);
  });
});
