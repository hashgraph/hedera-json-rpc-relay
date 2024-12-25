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

import { GlobalConfig } from './globalConfig';

export class LoggerService {
  public static readonly SENSITIVE_FIELDS = [
    GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName,
    GlobalConfig.ENTRIES.OPERATOR_KEY_ETH_SENDRAWTRANSACTION.envName,
    GlobalConfig.ENTRIES.GITHUB_TOKEN.envName,
    GlobalConfig.ENTRIES.GH_ACCESS_TOKEN.envName,
  ];

  public static readonly KNOWN_SECRET_PREFIXES = [
    'ghp', // GitHub personal access tokens
    'gho', // OAuth access tokens
    'ghu', // GitHub user-to-server tokens
    'ghs', // GitHub server-to-server tokens
    'ghr', // refresh tokens
  ];

  public static readonly GITHUB_SECRET_PATTERN: RegExp =
    /^(gh[pousr]_[a-zA-Z0-9]{36,251}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$/;

  /**
   * Hide sensitive information
   *
   * @param envName
   * @param envValue
   */
  static maskUpEnv(envName: string, envValue: string | undefined): string {
    const isSensitiveField: boolean = this.SENSITIVE_FIELDS.indexOf(envName) > -1;
    const isKnownSecret: boolean =
      GlobalConfig.ENTRIES[envName].type === 'string' && !!this.GITHUB_SECRET_PATTERN.exec(envValue ?? '');

    if (isSensitiveField || isKnownSecret) {
      return `${envName} = **********`;
    }

    return `${envName} = ${envValue}`;
  }
}
