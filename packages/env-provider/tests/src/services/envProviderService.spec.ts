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

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { EnvProviderService } from '../../../src/services';

chai.use(chaiAsPromised);

describe('EnvProviderService tests', async function () {
  beforeEach(() => {
    EnvProviderService.hotReload();
  });

  it('should be able to get existing env var', async () => {
    const res = EnvProviderService.getInstance().get('CHAIN_ID');

    expect(res).to.equal('0x12a');
  });

  it('should be able to get non-existing env var', async () => {
    const res = EnvProviderService.getInstance().get('NON_EXISTING_VAR');

    expect(res).to.equal(undefined);
  });

  it('should be able to dynamic override env var', async () => {
    const expectedAfterValue = '0x160c';
    const valBefore = EnvProviderService.getInstance().get('CHAIN_ID');
    EnvProviderService.getInstance().dynamicOverride('CHAIN_ID', expectedAfterValue);
    const valAfter = EnvProviderService.getInstance().get('CHAIN_ID');

    expect(valBefore).to.not.equal(valAfter);
    expect(expectedAfterValue).to.equal(valAfter);
  });

  it('should be able to remove env var', async () => {
    const valBefore = EnvProviderService.getInstance().get('CHAIN_ID');
    EnvProviderService.getInstance().remove('CHAIN_ID');
    const valAfter = EnvProviderService.getInstance().get('CHAIN_ID');

    expect(valBefore).to.equal('0x12a');
    expect(valAfter).to.equal(undefined);
  });

  it('should be able to append env vars', async () => {
    const valBefore = EnvProviderService.getInstance().get('CHAIN_ID');
    EnvProviderService.getInstance().appendEnvsFromPath(__dirname + '/../../test.env');
    const valAfter = EnvProviderService.getInstance().get('CHAIN_ID');

    expect(valBefore).to.equal('0x12a');
    expect(valAfter).to.equal('0x160c');
  });
});
