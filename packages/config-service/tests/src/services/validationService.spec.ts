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
import { GlobalConfig } from '../../../dist/services/globalConfig';
import { ValidationService } from '../../../dist/services/validationService';

chai.use(chaiAsPromised);

describe('ValidationService tests', async function () {
  it('should to cast numeric type', async () => {
    const castedEnvs = ValidationService.typeCasting({
      [GlobalConfig.ENTRIES.CHAIN_ID.envName]: '0x160c',
    });

    expect(castedEnvs[GlobalConfig.ENTRIES.CHAIN_ID.envName]).to.equal('0x160c');
    expect(GlobalConfig.ENTRIES.CHAIN_ID.type).to.equal('string');
  });

  it('should to cast string type', async () => {
    const castedEnvs = ValidationService.typeCasting({
      [GlobalConfig.ENTRIES.CHAIN_ID.envName]: '0x160c',
    });

    expect(castedEnvs[GlobalConfig.ENTRIES.CHAIN_ID.envName]).to.equal('0x160c');
    expect(GlobalConfig.ENTRIES.CHAIN_ID.type).to.equal('string');
  });

  it('should to cast numeric type', async () => {
    const castedEnvs = ValidationService.typeCasting({
      [GlobalConfig.ENTRIES.BATCH_REQUESTS_MAX_SIZE.envName]: '5644',
    });

    expect(castedEnvs[GlobalConfig.ENTRIES.BATCH_REQUESTS_MAX_SIZE.envName]).to.equal(5644);
    expect(GlobalConfig.ENTRIES.BATCH_REQUESTS_MAX_SIZE.type).to.equal('number');
  });

  it('should to cast boolean type', async () => {
    const castedEnvs = ValidationService.typeCasting({
      [GlobalConfig.ENTRIES.BATCH_REQUESTS_ENABLED.envName]: 'true',
    });

    expect(castedEnvs[GlobalConfig.ENTRIES.BATCH_REQUESTS_ENABLED.envName]).to.be.true;
    expect(GlobalConfig.ENTRIES.BATCH_REQUESTS_ENABLED.type).to.equal('boolean');
  });

  it('should to cast boolean type', async () => {
    const castedEnvs = ValidationService.typeCasting({});

    expect(castedEnvs[GlobalConfig.ENTRIES.DEBUG_API_ENABLED.envName]).to.equal(
      GlobalConfig.ENTRIES.DEBUG_API_ENABLED.defaultValue,
    );
  });
});
