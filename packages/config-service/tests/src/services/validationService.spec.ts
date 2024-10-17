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
import { ConfigService } from '../../../dist/services';

chai.use(chaiAsPromised);

describe('ValidationService tests', async function () {
  describe('startUp', () => {
    const mandatoryStartUpFields = {
      CHAIN_ID: '0x12a',
      HEDERA_NETWORK: '{"127.0.0.1:50211":"0.0.3"}',
      MIRROR_NODE_URL: 'http://127.0.0.1:5551',
      OPERATOR_ID_MAIN: '0.0.1002',
      OPERATOR_KEY_MAIN:
        '302000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      SERVER_PORT: '7546',
    };

    const hbarLimitFields = {
      HBAR_RATE_LIMIT_TINYBAR: '100',
      HBAR_DAILY_LIMIT_BASIC: '10',
      HBAR_DAILY_LIMIT_EXTENDED: '20',
      HBAR_DAILY_LIMIT_PRIVILEGED: '30',
    };

    it('should fail fast if mandatory env is not passed', async () => {
      expect(() => ValidationService.startUp({})).to.throw(
        'CHAIN_ID is a mandatory and the relay cannot operate without its value.',
      );
    });

    it('should fail fast if mandatory env is invalid number format', async () => {
      GlobalConfig.ENTRIES.SERVER_PORT.required = true;
      expect(() =>
        ValidationService.startUp({
          ...mandatoryStartUpFields,
          SERVER_PORT: 'lorem_ipsum',
        }),
      ).to.throw('SERVER_PORT must be a valid number.');
      GlobalConfig.ENTRIES.SERVER_PORT.required = false;
    });
  });

  describe('typeCasting', () => {
    it('should be able to use default value for missing env if default value is set', async () => {
      const castedEnvs = ValidationService.typeCasting({});
      expect(castedEnvs).to.haveOwnProperty(GlobalConfig.ENTRIES.E2E_RELAY_HOST.envName);
      expect(castedEnvs[GlobalConfig.ENTRIES.E2E_RELAY_HOST.envName]).to.equal(
        GlobalConfig.ENTRIES.E2E_RELAY_HOST.defaultValue,
      );
    });

    it('should skip adding value if it is missing and there is no default value set', async () => {
      const castedEnvs = ValidationService.typeCasting({});
      expect(castedEnvs).to.not.haveOwnProperty(GlobalConfig.ENTRIES.FILTER_TTL.envName);
      expect(castedEnvs[GlobalConfig.ENTRIES.FILTER_TTL.envName]).to.be.undefined;
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
  });
});
