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

import dotenv from 'dotenv';
import findConfig from 'find-config';
import pino from 'pino';
import { LoggerService } from './loggerService';
import { ValidationService } from './validationService';

const mainLogger = pino({
  name: 'hedera-json-rpc-relay',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: true,
    },
  },
});
const logger = mainLogger.child({ name: 'config-service' });

export class ConfigService {
  /**
   * The singleton instance
   * @public
   */
  private static instance: ConfigService;

  /**
   * Copied envs from process.env
   * @private
   */
  private readonly envs: NodeJS.ReadOnlyDict<string>;

  /**
   * Fetches all envs from process.env and pushes them into the envs property
   * @private
   */
  private constructor() {
    const configPath = findConfig('.env');

    if (!configPath) {
      logger.warn('No .env file is found. The relay can not operate without valid .env.');
    }

    // @ts-ignore
    dotenv.config({ path: configPath });

    // TODO: start-up validations and exit on fail
    // Make sure that CHAIN_ID, HEDERA_NETWORK, MIRROR_NODE_URL, OPERATOR_ID_MAIN, OPERATOR_KEY_MAIN, SERVER_PORT are non-empty and in the expected format
    // Make sure that if OPERATOR_KEY_FORMAT is not specified, the provided OPERATOR_KEY_MAIN is in the DER format
    // Make sure that HBAR_RATE_LIMIT_TINYBAR is more than HBAR_RATE_LIMIT_BASIC, HBAR_RATE_LIMIT_EXTENDED, HBAR_RATE_LIMIT_PRIVILEGED
    ValidationService.startUp(process.env);

    // transform string values to typed envs, we'll get rid off things like that:
    // - ConfigService.get('MY_CUSTOM_VAR_1') === 'true';
    // - Number(ConfigService.get('MY_CUSTOM_VAR_2')) == 10;
    this.envs = ValidationService.typeCasting(process.env);

    // TODO: is this the right place for printing the envs?
    for (let i in this.envs) {
      console.log(LoggerService.maskUpEnv(i, this.envs[i]));
    }
  }

  /**
   * Get the singleton instance of the current service
   * @public
   */
  private static getInstance(): ConfigService {
    if (this.instance == null) {
      this.instance = new ConfigService();
    }

    return this.instance;
  }

  /**
   * Get an env var by name
   * @param name string
   * @returns string | undefined
   */
  public static get(name: string): string | undefined {
    return this.getInstance().envs[name];
  }
}
