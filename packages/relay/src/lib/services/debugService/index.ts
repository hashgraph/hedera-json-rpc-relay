import { Logger } from 'pino';
import { MirrorNodeClient } from '../../clients';
import { IDebugService } from './IDebugService';
import { CacheService } from '../cacheService/cacheService';
import { predefined } from '../../errors/JsonRpcError';
import { CommonService } from '../ethService/ethCommonService';

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
  private readonly common: CommonService;
  public readonly debugTraceTransaction = 'debug_traceTransaction';

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, cacheService: CacheService, common: CommonService) {
    this.mirrorNodeClient = mirrorNodeClient;
    this.logger = logger;
    this.cacheService = cacheService;
    this.common = common;
  }

  /**
   * Checks if the Filter API is enabled
   */
  static requireDebugAPIEnabled(): void {
    if (!process.env.DEBUG_API_ENABLED || process.env.DEBUG_API_ENABLED !== 'true') {
      throw predefined.UNSUPPORTED_METHOD;
    }
  }

  async debug_traceTransaction(
    transactionHash: string,
    tracer: any,
    tracerConfig: any,
    requestIdPrefix?: string
  ): Promise<any> {
    this.logger.trace(`${requestIdPrefix} debug_traceTransaction(${transactionHash})`);
    try {
      DebugService.requireDebugAPIEnabled();
      if (tracer.tracer === 'callTracer') {
        return await this.callTracer(transactionHash, tracerConfig, requestIdPrefix);
      } else if (tracer.tracer === 'opcodeLogger') {
        throw Error('opcodeLogger is currently not supported');
      }
    } catch (e) {
      return this.common.genericErrorHandler(e);
    }
  }

  static formatActionsResult(result): object {
    const formattedResult = result.map((action) => {
      return {
        type: action.call_operation_type,
        from: action.from,
        to: action.to,
        gas: action.gas,
        gasUsed: action.gas_used,
        input: action.input,
        output: action.result_data
      };
    });
    return formattedResult;
  }

  async callTracer(transactionHash: string, tracerConfig: any, requestIdPrefix?: string): Promise<object> {
    let actionsResponse;
    let transactionsResponse;

    try {
      actionsResponse = await this.mirrorNodeClient.getContractsResultsActions(transactionHash, requestIdPrefix);
      transactionsResponse = await this.mirrorNodeClient.getContractResultWithRetry(transactionHash);
    } catch (e) {
      return this.common.genericErrorHandler(e);
    }

    const actions = tracerConfig.tracerConfig.onlyTopCall ? [actionsResponse.actions[0]] : actionsResponse.actions;
    const formattedActions = DebugService.formatActionsResult(actions);
    const {
      call_operation_type: type,
      from,
      to,
      amount,
      gasLimit: gas,
      gasUsed,
      function_parameters: input,
      call_result: output,
      error_message: error
    } = transactionsResponse;
    return {
      type,
      from,
      to,
      value: amount === 0 ? '0x0' : amount,
      gas,
      gasUsed,
      input,
      output,
      error,
      revertReason: error,
      calls: formattedActions
    };
  }
}
