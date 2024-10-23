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

import { GlobalConfig } from './globalConfig';

export class ValidationService {
  /**
   * Validate mandatory fields on start-up
   * @param envs
   */
  static startUp(envs: NodeJS.Dict<string>): void {
    // validate mandatory fields and their types
    Object.entries(GlobalConfig.ENTRIES).forEach(([entryName, entryInfo]) => {
      if (entryInfo.required) {
        if (!envs.hasOwnProperty(entryName)) {
          throw new Error(`${entryName} is a mandatory and the relay cannot operate without its value.`);
        }

        if (entryInfo.type === 'number' && isNaN(Number(envs[entryName]))) {
          throw new Error(`${entryName} must be a valid number.`);
        }
      }
    });
  }

  /**
   * Transform string env variables to the proper formats (number/boolean/string)
   * @param envs
   */
  static typeCasting(envs: NodeJS.Dict<string>): NodeJS.Dict<any> {
    const typeCastedEnvs: NodeJS.Dict<any> = {};

    Object.entries(GlobalConfig.ENTRIES).forEach(([entryName, entryInfo]) => {
      if (!envs.hasOwnProperty(entryName)) {
        if (entryInfo.defaultValue) {
          typeCastedEnvs[entryName] = entryInfo.defaultValue;
        }
        return;
      }

      switch (entryInfo.type) {
        case 'number':
          typeCastedEnvs[entryName] = Number(envs[entryName]);
          break;
        case 'boolean':
          typeCastedEnvs[entryName] = envs[entryName] === 'true';
          break;
        default:
          // handle "string" and stringified array type
          typeCastedEnvs[entryName] = envs[entryName];
      }
    });

    return typeCastedEnvs;
  }
}
