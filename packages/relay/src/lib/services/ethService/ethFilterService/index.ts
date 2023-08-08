/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import { Logger } from 'pino';
import { ClientCache, MirrorNodeClient } from '../../../clients';
import constants from '../../../constants';
import { IFilterService } from './IFilterService';

/**
 * Create a new Filter Service implementation.
 * @param mirrorNodeClient
 * @param logger
 * @param chain
 * @param registry
 * @param clientCache
 */
export class FilterService implements IFilterService {
  /**
   * The interface through which we interact with the mirror node
   * @private
   */
  private readonly mirrorNodeClient: MirrorNodeClient;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private readonly logger: Logger;

  /**
   * The LRU cache used for caching items from requests.
   *
   * @private
   */
  private readonly cache: ClientCache;
  public readonly ethUninstallFilter = 'eth_uninstallFilter';

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, clientCache: ClientCache) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cache = clientCache;
  }

  public async uninstallFilter(filterId: string, requestIdPrefix?: string | undefined): Promise<boolean> {
    this.logger.trace(`${requestIdPrefix} uninstallFilter(${filterId})`);

    const cacheKey = `${constants.CACHE_KEY.FILTERID}_${filterId}`;
    const filter = this.cache.get(cacheKey, this.ethUninstallFilter, requestIdPrefix);

    if (filter) {
      this.cache.delete(cacheKey, this.ethUninstallFilter, requestIdPrefix);
      return true;
    }

    return false;
  }
}
