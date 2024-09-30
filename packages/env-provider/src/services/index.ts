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

export class EnvProvider {
  /**
   * The singleton instance
   * @public
   */
  private static instance: EnvProvider;

  /**
   * Copied envs from process.env
   * @private
   */
  private readonly envs: Record<string, string | undefined>;

  /**
   * Fetches all envs from process.env and pushes them into the envs property
   * @private
   */
  private constructor() {
    const configPath = findConfig('.env');

    if (!configPath || configPath === '') {
      throw new Error('No .env file is found. The relay can not operate without valid .env.');
    }

    dotenv.config({ path: configPath });
    this.envs = { ...process.env };
  }

  /**
   * Get the singleton instance of the current service
   * @public
   */
  private static getInstance(): EnvProvider {
    if (this.instance == null) {
      this.instance = new EnvProvider();
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
