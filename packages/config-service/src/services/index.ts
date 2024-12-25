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
   * @private
   */
  private static readonly envFileName: string = '.env';

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
    const configPath = findConfig(ConfigService.envFileName);

    if (configPath) {
      dotenv.config({ path: configPath });
    } else {
      logger.warn('No .env file is found. The relay cannot operate without valid .env.');
    }

    // validate mandatory fields
    ValidationService.startUp(process.env);

    // transform string representations of env vars into proper types
    this.envs = ValidationService.typeCasting(process.env);

    // printing current env variables, masking up sensitive information
    for (const name in this.envs) {
      logger.info(LoggerService.maskUpEnv(name, this.envs[name]));
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
  public static get(name: string): string | number | boolean | null | undefined {
    return this.getInstance().envs[name];
  }
}
