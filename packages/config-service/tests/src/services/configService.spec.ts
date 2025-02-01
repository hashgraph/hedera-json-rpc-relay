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
import { GlobalConfig, type ConfigKey } from '../../../src/services/globalConfig';

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
    const res = ConfigService.get('CHAIN_ID');
    expect(res).to.equal('0x12a');
  });

  it('should return undefined for non-existing variable', async () => {
    const res = ConfigService.get('NON_EXISTING_VAR' as ConfigKey);
    expect(res).to.equal(undefined);
  });

  it('should return the default value for configurations not set in process.env', async () => {
    const targetKey = 'FILE_APPEND_MAX_CHUNKS';
    const envValue = process.env[targetKey];

    // ensure the key is not listed in env
    expect(envValue).to.be.undefined;

    const expectedDefaultValue = GlobalConfig.ENTRIES[targetKey].defaultValue;

    const res = ConfigService.get(targetKey);
    expect(res).to.equal(expectedDefaultValue);
  });

  it('should infer the explicit type for configuration which is either required or has a valid defaultValue', () => {
    const targetKeys = [
      'FILE_APPEND_MAX_CHUNKS',
      'GET_RECORD_DEFAULT_TO_CONSENSUS_NODE',
      'E2E_RELAY_HOST',
      'ETH_CALL_ACCEPTED_ERRORS',
    ] as ConfigKey[];

    targetKeys.forEach((targetKey) => {
      const result = ConfigService.get(targetKey);
      const expectedTypeString = GlobalConfig.ENTRIES[targetKey].type;

      switch (expectedTypeString) {
        case 'number':
          expect(typeof result === 'number').to.be.true;
          break;
        case 'boolean':
          expect(typeof result === 'boolean').to.be.true;
          break;
        case 'string':
        case 'array':
          expect(typeof result === 'string').to.be.true;
          break;
      }
    });
  });

  it('Should always convert CHAIN_ID to a hexadecimal string, regardless of input value type.', async () => {
    const originalEnv = process.env;

    const testChainId = (input: string, expected: string) => {
      process.env = { ...originalEnv, CHAIN_ID: input };
      // Reset the ConfigService singleton instance to force a new initialization
      // This is necessary because ConfigService caches the env values when first instantiated,
      // so we need to clear that cache to test with our new CHAIN_ID value
      // @ts-ignore - accessing private property for testing
      delete ConfigService.instance;
      expect(ConfigService.get('CHAIN_ID')).to.equal(expected);
    };

    try {
      // Test cases
      testChainId('298', '0x12a'); // decimal number
      testChainId('0x12a', '0x12a'); // hexadecimal with prefix
      testChainId('1000000', '0xf4240'); // larger number
      testChainId('0xhedera', '0xNaN'); // invalid number
    } finally {
      process.env = originalEnv;
      // @ts-ignore - accessing private property for testing
      delete ConfigService.instance;
    }
  });
});
