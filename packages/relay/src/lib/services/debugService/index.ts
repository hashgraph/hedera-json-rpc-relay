import type { Logger } from 'pino';
import type { MirrorNodeClient } from '../../clients';
import type { IDebugService } from './IDebugService';
import type { CommonService } from '../ethService/ethCommonService';
import { decodeErrorMessage, numberTo0x } from '../../../formatters';
import { TracerType } from '../../constants';
import { predefined } from '../../errors/JsonRpcError';
import constants from '../../constants';

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

  private readonly common: CommonService;

  public readonly debugTraceTransaction = 'debug_traceTransaction';

  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, common: CommonService) {
    this.logger = logger;
    this.common = common;
    this.mirrorNodeClient = mirrorNodeClient;
  }

  /**
   * Checks if the Debug API is enabled
   * @public
   */
  public static readonly isDebugAPIEnabled = process.env.DEBUG_API_ENABLED ? true : false;

  static requireDebugAPIEnabled(): void {
    if (!process.env.DEBUG_API_ENABLED || process.env.DEBUG_API_ENABLED !== 'true') {
      throw predefined.UNSUPPORTED_METHOD;
    }
  }

  /**
   * Trace a transaction for debugging purposes.
   *
   * @async
   * @param {string} transactionHash - The hash of the transaction to be traced.
   * @param {TracerType} tracer - The type of tracer to use (either 'CallTracer' or 'OpcodeLogger').
   * @param {object} tracerConfig - The configuration object for the tracer.
   * @param {string} [requestIdPrefix] - An optional request id.
   * @throws {Error} Throws an error if the specified tracer type is not supported or if an exception occurs during the trace.
   * @returns {Promise<any>} A Promise that resolves to the result of the trace operation.
   *
   * @example
   * const result = await debug_traceTransaction('0x123abc', TracerType.CallTracer, {"tracerConfig": {"onlyTopCall": false}}, some request id);
   */
  async debug_traceTransaction(
    transactionHash: string,
    tracer: TracerType,
    tracerConfig: object,
    requestIdPrefix?: string,
  ): Promise<any> {
    this.logger.trace(`${requestIdPrefix} debug_traceTransaction(${transactionHash})`);
    try {
      DebugService.requireDebugAPIEnabled();
      if (tracer === TracerType.CallTracer) {
        return await this.callTracer(transactionHash, tracerConfig, requestIdPrefix);
      } else if (tracer === TracerType.OpcodeLogger) {
        throw Error('opcodeLogger is currently not supported');
      }
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }
  }

  async formatActionsResult(result, requestIdPrefix?: string): Promise<[] | any> {
    const formattedResultPromises = result.map(async (action) => {
      const resolvedFrom = await this.resolveAddress(
        action.from,
        [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
        requestIdPrefix,
      );

      const resolvedTo = await this.resolveAddress(
        action.to,
        [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
        requestIdPrefix,
      );

      return {
        type: action.call_operation_type,
        from: resolvedFrom,
        to: resolvedTo,
        gas: numberTo0x(action.gas),
        gasUsed: numberTo0x(action.gas_used),
        input: action.input,
        output: action.result_data,
        value: numberTo0x(action.value),
      };
    });
    const formattedResult = await Promise.all(formattedResultPromises);

    return formattedResult;
  }

  async resolveAddress(
    address: string,
    types = [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
    requestIdPrefix?: string,
  ): Promise<string> {
    const entity = await this.mirrorNodeClient.resolveEntityType(
      address,
      types,
      'debug_traceTransaction',
      requestIdPrefix,
    );
    let resolvedAddress = address;
    if (
      entity &&
      (entity.type === constants.TYPE_CONTRACT || entity.type === constants.TYPE_ACCOUNT) &&
      entity.entity?.evm_address
    ) {
      resolvedAddress = entity.entity.evm_address;
    }

    return resolvedAddress;
  }

  async callTracer(transactionHash: string, tracerConfig: any, requestIdPrefix?: string): Promise<object> {
    let actionsResponse;
    let transactionsResponse;

    try {
      actionsResponse = await this.mirrorNodeClient.getContractsResultsActions(transactionHash, requestIdPrefix);
      transactionsResponse = await this.mirrorNodeClient.getContractResultWithRetry(transactionHash);
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }

    const {
      from,
      to,
      amount,
      gas_limit: gas,
      gas_used: gasUsed,
      function_parameters: input,
      call_result: output,
      error_message: error,
      result,
    } = transactionsResponse;

    const { call_type: type } = actionsResponse.actions[0];
    let formattedActions = await this.formatActionsResult(actionsResponse.actions, requestIdPrefix);
    formattedActions =
      tracerConfig.onlyTopCall || actionsResponse.actions.length === 1 ? undefined : formattedActions.slice(1);
    const fromToEvmAddress = await this.resolveAddress(
      from,
      [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
      requestIdPrefix,
    );
    const toToEvmAddress = await this.resolveAddress(
      to,
      [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
      requestIdPrefix,
    );

    return {
      type,
      from: fromToEvmAddress,
      to: toToEvmAddress,
      value: amount === 0 ? '0x0' : numberTo0x(amount),
      gas: numberTo0x(gas),
      gasUsed: numberTo0x(gasUsed),
      input,
      output: result !== 'SUCCESS' ? decodeErrorMessage(error) : output,
      error: result !== 'SUCCESS' ? result : undefined,
      revertReason: result !== 'SUCCESS' ? decodeErrorMessage(error) : undefined,
      calls: formattedActions,
    };
  }
}
