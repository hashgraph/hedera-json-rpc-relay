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
    
    if(filter) {
      this.cache.delete(cacheKey, this.ethUninstallFilter, requestIdPrefix);
      return true;
    }

    return false;
  }
}
