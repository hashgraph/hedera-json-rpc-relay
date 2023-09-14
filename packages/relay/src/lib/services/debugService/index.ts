import { Logger } from 'pino';
import { MirrorNodeClient } from '../../clients';
import { IDebugService } from './IDebugService';
import { CacheService } from '../cacheService/cacheService';

export class DebugService implements IDebugService {
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
  private readonly cacheService: CacheService;

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, cacheService: CacheService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cacheService = cacheService;
  }

  async debug_traceTransaction(
    transactionHash: string,
    tracer: string,
    tracerConfig: object,
    requestIdPrefix?: string,
  ): Promise<any> {
    const response = await this.mirrorNodeClient.getContractsResultsActions(transactionHash, requestIdPrefix);
    console.log(response);
  }
}
