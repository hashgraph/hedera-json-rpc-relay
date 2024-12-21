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
import crypto from 'crypto';
import { ConfigService } from '../../../src/services';
import { LoggerService } from '../../../src/services/loggerService';
import { GlobalConfig } from '../../../dist/services/globalConfig';
import { ConfigName } from '../../../src/services/configName';

chai.use(chaiAsPromised);

describe('LoggerService tests', async function () {
  it('should be able to mask sensitive information', async () => {
    for (const sensitiveField of LoggerService.SENSITIVE_FIELDS) {
      const hex = crypto.randomBytes(32).toString('hex');
      const res = LoggerService.maskUpEnv(sensitiveField, hex);
      expect(res).to.equal(`${sensitiveField} = **********`);
    }
  });

  it('should be able to mask every value if it starts with known secret prefix', async () => {
    const { envName } = GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN;

    for (const prefix of LoggerService.KNOWN_SECRET_PREFIXES) {
      const value = prefix + '_VVurqVVh68wgxgcVjrvVVVcNcVVVVi3CRwl1';
      const res = LoggerService.maskUpEnv(envName, value);
      expect(res).to.equal(`${envName} = **********`);
    }
  });

  it('should be able to return plain information', async () => {
    const envName = ConfigName.CHAIN_ID;
    const res = ConfigService.get(envName) as string;

    expect(LoggerService.maskUpEnv(envName, res)).to.equal(`${envName} = ${res}`);
  });
});
