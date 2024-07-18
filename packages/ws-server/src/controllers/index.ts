/* -
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

import { WS_CONSTANTS } from '../utils/constants';
import WsMetricRegistry from '../metrics/wsMetricRegistry';
import ConnectionLimiter from '../metrics/connectionLimiter';
import { predefined, Relay } from '@hashgraph/json-rpc-relay';
import { Validator } from '@hashgraph/json-rpc-server/dist/validator';
import { handleEthSubsribe, handleEthUnsubscribe } from './eth_subscribe';
import { MirrorNodeClient } from '@hashgraph/json-rpc-relay/dist/lib/clients';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import { resolveParams, validateJsonRpcRequest, verifySupportedMethod } from '../utils/utils';
import {
  InvalidRequest,
  MethodNotFound,
  IPRateLimitExceeded,
} from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcError';

/**
 * Handles sending requests to a Relay by calling a specified method with given parameters.
 * This function constructs a request tag, submits the request to the relay, and logs the process.
 * @notice This function is shared among all supported methods expect for eth_subscribe & eth_unsubscribe
 * @param {object} args - An object containing the function parameters as properties.
 * @param {any} args.request - The request object received from the client.
 * @param {string} args.method - The method to call on the relay.
 * @param {any} args.params - The parameters for the method call.
 * @param {Relay} args.relay - The relay object.
 * @param {any} args.logger - The logger object used for tracing.
 * @param {string} args.requestIdPrefix - Prefix for request ID used for logging.
 * @param {string} args.connectionIdPrefix - Prefix for connection ID used for logging.
 * @returns {Promise<any>} A promise that resolves to the result of the request.
 */
const handleSendingRequestsToRelay = async ({
  request,
  method,
  params,
  relay,
  logger,
  requestIdPrefix,
  connectionIdPrefix,
}): Promise<any> => {
  logger.trace(`${connectionIdPrefix} ${requestIdPrefix}: Submitting request=${JSON.stringify(request)} to relay.`);

  try {
    const resolvedParams = resolveParams(method, params);
    const [service, methodName] = method.split('_');

    // Call the relay method with the resolved parameters.
    // Method will be validated by "verifySupportedMethod" before reaching this point.
    let txRes: any;
    if (method === WS_CONSTANTS.METHODS.ETH_NEWFILTER) {
      txRes = await relay
        .eth()
        .filterService()
        [methodName](...resolvedParams, requestIdPrefix);
    } else {
      txRes = await relay[service]()[methodName](...resolvedParams, requestIdPrefix);
    }

    if (!txRes) {
      logger.trace(
        `${connectionIdPrefix} ${requestIdPrefix}: Fail to retrieve result for request=${JSON.stringify(
          request,
        )}. Result=${txRes}`,
      );
    }

    return jsonResp(request.id, null, txRes);
  } catch (error: any) {
    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};

/**
 * Retrieves the result of a request made to a Relay.
 * This function handles processing the request, including method validation, parameter validation, and method-specific logic.
 * @param {any} ctx - The context object.
 * @param {Relay} relay - The relay object.
 * @param {any} logger - The logger object.
 * @param {any} request - The request object.
 * @param {ConnectionLimiter} limiter - The connection limiter object.
 * @param {string} requestIdPrefix - Prefix for request ID.
 * @param {string} connectionIdPrefix - Prefix for connection ID.
 * @param {MirrorNodeClient} mirrorNodeClient - The MirrorNodeClient object.
 * @param {WsMetricRegistry} wsMetricRegistry - The WsMetricRegistry object.
 * @returns {Promise<any>} A promise that resolves to the response of the request.
 */
export const getRequestResult = async (
  ctx: any,
  relay: Relay,
  logger: any,
  request: any,
  limiter: ConnectionLimiter,
  requestIdPrefix: string,
  connectionIdPrefix: string,
  mirrorNodeClient: MirrorNodeClient,
  wsMetricRegistry: WsMetricRegistry,
): Promise<any> => {
  // Extract the method and parameters from the received request
  let { method, params } = request;

  // support go-ethereum client by turning undefined into empty array
  if (!params) params = [];

  // Increment metrics for the received method
  wsMetricRegistry.getCounter('methodsCounter').labels(method).inc();
  wsMetricRegistry.getCounter('methodsCounterByIp').labels(ctx.request.ip, method).inc();

  // validate request's jsonrpc object
  if (!validateJsonRpcRequest(request, logger, requestIdPrefix, connectionIdPrefix)) {
    return jsonResp(request.id || null, new InvalidRequest(), undefined);
  }

  // verify supported method
  if (!verifySupportedMethod(request.method)) {
    logger.warn(`${connectionIdPrefix} ${requestIdPrefix}: Method not supported: ${request.method}`);
    return jsonResp(request.id || null, new MethodNotFound(request.method), undefined);
  }

  // verify rate limit for method method based on IP
  if (limiter.shouldRateLimitOnMethod(ctx.ip, request.method, ctx.websocket.requestId)) {
    return jsonResp(null, new IPRateLimitExceeded(request.method), undefined);
  }

  // Validate request's params
  try {
    const methodValidations = Validator.METHODS[method];

    if (methodValidations) {
      Validator.validateParams(params, methodValidations);
    }
  } catch (error) {
    logger.warn(
      error,
      `${connectionIdPrefix} ${requestIdPrefix} Error in parameter validation. Method: ${method}, params: ${JSON.stringify(
        params,
      )}.`,
    );
    return jsonResp(request.id, error, undefined);
  }

  // Check if the subscription limit is exceeded for ETH_SUBSCRIBE method
  let response: any;
  if (method === WS_CONSTANTS.METHODS.ETH_SUBSCRIBE && !limiter.validateSubscriptionLimit(ctx)) {
    return jsonResp(request.id, predefined.MAX_SUBSCRIPTIONS, undefined);
  }

  // processing method
  try {
    const sharedParams = {
      ctx,
      params,
      logger,
      relay,
      request,
      method,
      limiter,
      requestIdPrefix,
      mirrorNodeClient,
      connectionIdPrefix,
    };

    switch (method) {
      case WS_CONSTANTS.METHODS.ETH_SUBSCRIBE:
        response = await handleEthSubsribe({ ...sharedParams });
        break;
      case WS_CONSTANTS.METHODS.ETH_UNSUBSCRIBE:
        response = handleEthUnsubscribe({ ...sharedParams });
        break;
      default:
        // since unsupported methods have already been captured, the methods fall into this default block will always be valid and supported methods.
        response = await handleSendingRequestsToRelay({ ...sharedParams });
    }
  } catch (error) {
    logger.warn(
      error,
      `${connectionIdPrefix} ${requestIdPrefix} Encountered error on connectionID: ${
        ctx.websocket.id
      }, method: ${method}, params: ${JSON.stringify(params)}`,
    );
    response = jsonResp(request.id, error, undefined);
  }

  return response;
};
