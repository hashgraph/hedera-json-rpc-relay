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

import { IEnvProviderService } from './IEnvProviderService';
import dotenv from 'dotenv';
import findConfig from 'find-config';

export class EnvProviderService implements IEnvProviderService {
  /**
   * The singleton instance
   * @public
   */
  private static instance: IEnvProviderService;

  /**
   * Copied envs from process.env
   * @private
   */
  private readonly envs: JSON;

  /**
   * Fetches all envs from process.env and pushes them into the envs property
   * @private
   */
  private constructor() {
    dotenv.config({ path: findConfig('.env') || '' });
    this.envs = JSON.parse(JSON.stringify(process.env));
  }

  /**
   * Get the singleton instance of the current service
   * @public
   */
  public static getInstance(): IEnvProviderService {
    if (this.instance == null) {
      this.instance = new EnvProviderService();
    }

    return this.instance;
  }

  /**
   * Hot reload a new instance into the current one
   * @param configName
   */
  public static hotReload(configName): void {
    dotenv.config({ path: findConfig(configName) || '' });
    this.instance = new EnvProviderService();
  }

  /**
   * Get an env var by name
   * @param name string
   * @returns string | undefined
   */
  public get(name: string): string | undefined {
    return this.envs[name];
  }

  /**
   * Override an env variable, used in test cases only
   * @param name string
   * @param value string
   * @returns void
   */
  public dynamicOverride(name: string, value: string): void {
    this.envs[name] = value;
  }

  /**
   * Delete an env variable, used in test cases only
   * @param name string
   * @returns void
   */
  public remove(name: string): void {
    delete this.envs[name];
  }
}
