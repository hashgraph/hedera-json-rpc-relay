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

import type { Logger } from 'pino';
import type { MirrorNodeClient } from '../../clients';
import type { IDebugService } from './IDebugService';
import type { CommonService } from '../ethService/ethCommonService';
import { decodeErrorMessage, numberTo0x } from '../../../formatters';
import constants from '../../constants';
import { TracerType } from '../../constants';
import { predefined } from '../../errors/JsonRpcError';
import { EthImpl } from '../../eth';
const SUCCESS = 'SUCCESS';

/**
 * Represents a DebugService for tracing and debugging transactions and debugging
 *
 * @class
 * @implements {IDebugService}
 */
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
   * The commonService containing useful functions
   * @private
   */
  private readonly common: CommonService;

  public readonly debugTraceTransaction = 'debug_traceTransaction';

  /**
   * Creates an instance of DebugService.
   *
   * @constructor
   * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the mirror node.
   * @param {Logger} logger - The logger used for logging output from this class.
   * @param {CommonService} common - The common service containing useful functions.
   */
  constructor(mirrorNodeClient: MirrorNodeClient, logger: Logger, common: CommonService) {
    this.logger = logger;
    this.common = common;
    this.mirrorNodeClient = mirrorNodeClient;
  }

  /**
   * Checks if the Debug API is enabled
   * @public
   */
  public static readonly isDebugAPIEnabled = process.env.DEBUG_API_ENABLED;

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
        throw predefined.UNSUPPORTED_METHOD;
      }
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }
  }

  /**
   * Formats the result from the actions endpoint to the expected response
   *
   * @async
   * @param {any} result - The response from the actions endpoint.
   * @param {string} requestIdPrefix - The request prefix id.
   * @returns {Promise<[] | any>} The formatted actions response in an array.
   */
  async formatActionsResult(result: any, requestIdPrefix?: string): Promise<[] | any> {
    return await Promise.all(
      result.map(async (action, index) => {
        const { resolvedFrom, resolvedTo } = await this.resolveMultipleAddresses(
          action.from,
          action.to,
          requestIdPrefix,
        );

        // The actions endpoint does not return input and output for the calls so we get them from another endpoint
        // The first one is excluded because we take its input and output from the contracts/results/{transactionIdOrHash} endpoint
        const getContract =
          index !== 0 && action.call_operation_type === 'CREATE'
            ? await this.mirrorNodeClient.getContract(action.to, requestIdPrefix)
            : undefined;

        return {
          type: action.call_operation_type,
          from: resolvedFrom,
          to: resolvedTo,
          gas: numberTo0x(action.gas),
          gasUsed: numberTo0x(action.gas_used),
          input: getContract?.bytecode ?? action.input,
          output: getContract?.runtime_bytecode ?? action.result_data,
          value: numberTo0x(action.value),
        };
      }),
    );
  }

  /**
   * Returns an address' evm equivalence.
   *
   * @async
   * @param {string} address - The address to be resolved.
   * @param {[string]} types - The possible types of the address.
   * @param {string} requestIdPrefix - The request prefix id.
   * @returns {Promise<string>} The address returned as an EVM address.
   */
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

    if (
      entity &&
      (entity.type === constants.TYPE_CONTRACT || entity.type === constants.TYPE_ACCOUNT) &&
      entity.entity?.evm_address
    ) {
      return entity.entity.evm_address;
    }

    return address;
  }

  async resolveMultipleAddresses(
    from: string,
    to: string,
    requestIdPrefix?: string,
  ): Promise<{ resolvedFrom: string; resolvedTo: string }> {
    const [resolvedFrom, resolvedTo] = await Promise.all([
      this.resolveAddress(
        from,
        [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT],
        requestIdPrefix,
      ),
      this.resolveAddress(to, [constants.TYPE_CONTRACT, constants.TYPE_TOKEN, constants.TYPE_ACCOUNT], requestIdPrefix),
    ]);

    return { resolvedFrom, resolvedTo };
  }

  /**
   * Returns the final formatted response for callTracer config.
   *
   * @async
   * @param {string} transactionHash - The hash of the transaction to be debugged.
   * @param {any} tracerConfig - The tracer config to be used.
   * @param {string} requestIdPrefix - The request prefix id.
   * @returns {Promise<object>} The formatted response.
   */
  async callTracer(transactionHash: string, tracerConfig: any, requestIdPrefix?: string): Promise<object> {
    try {
      const [actionsResponse, transactionsResponse] = await Promise.all([
        this.mirrorNodeClient.getContractsResultsActions(transactionHash, requestIdPrefix),
        this.mirrorNodeClient.getContractResultWithRetry(transactionHash),
      ]);

      const { call_type: type } = actionsResponse.actions[0];
      const formattedActions = await this.formatActionsResult(actionsResponse.actions, requestIdPrefix);

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

      const { resolvedFrom, resolvedTo } = await this.resolveMultipleAddresses(from, to, requestIdPrefix);

      const value = amount === 0 ? EthImpl.zeroHex : numberTo0x(amount);
      const errorResult = result !== SUCCESS ? result : undefined;

      return {
        type,
        from: resolvedFrom,
        to: resolvedTo,
        value,
        gas: numberTo0x(gas),
        gasUsed: numberTo0x(gasUsed),
        input,
        output: result !== SUCCESS ? error : output,
        ...(result !== SUCCESS && { error: errorResult }),
        ...(result !== SUCCESS && { revertReason: decodeErrorMessage(error) }),
        // if we have more than one call executed during the transactions we would return all calls
        // except the first one in the sub-calls array,
        // therefore we need to exclude the first one from the actions response
        calls: tracerConfig.onlyTopCall || actionsResponse.actions.length === 1 ? undefined : formattedActions.slice(1),
      };
    } catch (e) {
      throw this.common.genericErrorHandler(e);
    }
  }
}
