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

export class LoggerService {
  public static readonly SENSITIVE_FIELDS = [
    GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName,
    GlobalConfig.ENTRIES.OPERATOR_KEY_ETH_SENDRAWTRANSACTION.envName,
    GlobalConfig.ENTRIES.GITHUB_TOKEN.envName,
  ];

  /**
   * Hide sensitive information
   *
   * @param envName
   * @param envValue
   */
  static maskUpEnv(envName: string, envValue: string | undefined): string {
    if (this.SENSITIVE_FIELDS.indexOf(envName) > -1) {
      return `${envName} = **********${envValue?.slice(-4)}`;
    }

    return `${envName} = ${envValue}`;
  }
}
