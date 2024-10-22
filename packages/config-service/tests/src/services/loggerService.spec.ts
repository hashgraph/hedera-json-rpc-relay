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

chai.use(chaiAsPromised);

describe('LoggerService tests', async function () {
  it('should be able to mask sensitive information', async () => {
    for (const sensitiveField of LoggerService.SENSITIVE_FIELDS) {
      const hex = crypto.randomBytes(32).toString('hex');
      const res = LoggerService.maskUpEnv(sensitiveField, hex);
      expect(res).to.equal(`${sensitiveField} = **********`);
    }
  });

  it('should be able to return plain information', async () => {
    const envName = GlobalConfig.ENTRIES.CHAIN_ID.envName;
    const res = ConfigService.get(envName);

    expect(LoggerService.maskUpEnv(envName, res)).to.equal(`${envName} = ${res}`);
  });
});
