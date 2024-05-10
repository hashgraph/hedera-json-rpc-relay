/* -
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

import { WS_CONSTANTS } from './constants';
import WsMetricRegistry from '../metrics/wsMetricRegistry';
import ConnectionLimiter from '../metrics/connectionLimiter';
import { predefined, Relay } from '@hashgraph/json-rpc-relay';
const hasOwnProperty = (obj: any, prop: any) => Object.prototype.hasOwnProperty.call(obj, prop);
const requestIdIsOptional = process.env.REQUEST_ID_IS_OPTIONAL ? process.env.REQUEST_ID_IS_OPTIONAL === 'true' : false; // default to false
/**
 * Handles the closure of a WebSocket connection.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {Relay} relay - The relay instance used for handling subscriptions.
 * @param {ConnectionLimiter} limiter - The limiter instance used for managing connection limits.
 * @param {WsMetricRegistry} wsMetricRegistry - The metric registry used for tracking WebSocket metrics.
 * @param {[number, number]} startTime - The start time of the connection represented as a tuple of seconds and nanoseconds.
 */
export const handleConnectionClose = async (
  ctx: any,
  relay: Relay,
  limiter: ConnectionLimiter,
  wsMetricRegistry: WsMetricRegistry,
  startTime: [number, number],
) => {
  // unsubcribe subscriptions
  relay.subs()?.unsubscribe(ctx.websocket);

  // update limiter counters
  limiter.decrementCounters(ctx);

  // Increment the total closed connections
  wsMetricRegistry.getCounter('totalClosedConnections').inc();

  // Calculate the duration of the connection
  const endTime = process.hrtime(startTime);
  const durationInSeconds = endTime[0] + endTime[1] / 1e9; // Convert duration to seconds

  // Update the connection duration histogram with the calculated duration
  wsMetricRegistry.getHistogram('connectionDuration').labels(ctx.websocket.id).observe(durationInSeconds);

  // terminate connection
  ctx.websocket.terminate();
};

/**
 * Determines whether multiple addresses are enabled for WebSocket connections.
 * @returns {boolean} Returns true if multiple addresses are enabled, otherwise returns false.
 */
export const getMultipleAddressesEnabled = (): boolean => {
  return process.env.WS_MULTIPLE_ADDRESSES_ENABLED === 'true';
};

/**
 * Handles sending requests to the relay for processing.
 * @param {string} tag - The tag associated with the request.
 * @param {any} args - The arguments to be passed to the relay.
 * @param {Relay} relay - The relay instance used to process the request.
 * @param {any} logger - The logger instance used for logging.
 * @param {string} rpcCallEndpoint - The endpoint on the relay to call.
 * @param {string} requestIdPrefix - The prefix to use for the request ID.
 * @param {string} connectionIdPrefix - The prefix to use for the connection ID.
 * @returns {Promise<any>} A promise that resolves to the result of the request.
 */
export const handleSendingRequestsToRelay = async (
  tag: string,
  args: any[],
  relay: Relay,
  logger: any,
  rpcCallEndpoint: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): Promise<any> => {
  logger.info(`${connectionIdPrefix} ${requestIdPrefix}: Submitting request to relay for tag=${tag}.`);

  try {
    const txRes = await relay.eth()[rpcCallEndpoint](...args);
    if (!txRes) {
      logger.debug(`${connectionIdPrefix} ${requestIdPrefix}: Fail to retrieve result for tag=${tag}. Data=${txRes}`);
    }

    return txRes;
  } catch (error: any) {
    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};

/**
 * Sends a response to the client.
 * @param {any} connection - The connection object.
 * @param {any[]} params - The parameters associated with the request.
 * @param {any} method - The method associated with the request.
 * @param {any} response - The response to send to the client.
 * @param {any} logger - The logger object.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 */
export const sendToClient = (
  connection: any,
  params: any,
  method: any,
  response: any,
  logger: any,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  const TX_INFO = params[0];
  const BLOCK_PARAM = params[1];
  const TAG = JSON.stringify({ method, txInfo: TX_INFO, block: BLOCK_PARAM });

  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix}: Sending data=${JSON.stringify(
      response.result,
    )} to client from tag=${TAG}`,
  );

  connection.send(JSON.stringify(response));
  connection.limiter.resetInactivityTTLTimer(connection);
};

/**
 * Validates a JSON-RPC request to ensure it has the correct JSON-RPC version, method, and id.
 * @param {any} request - The JSON-RPC request object.
 * @param {any} logger - The logger instance used for logging.
 * @param {string} requestIdPrefix - The prefix to use for the request ID.
 * @param {string} connectionIdPrefix - The prefix to use for the connection ID.
 * @returns {boolean} A boolean indicating whether the request is valid.
 */
export const validateJsonRpcRequest = (
  request: any,
  logger: any,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): boolean => {
  if (
    request.jsonrpc !== '2.0' ||
    !hasOwnProperty(request, 'method') ||
    hasInvalidReqestId(request, logger, requestIdPrefix, connectionIdPrefix) ||
    !hasOwnProperty(request, 'id')
  ) {
    logger.warn(
      `${connectionIdPrefix} ${requestIdPrefix} Invalid request, body.jsonrpc: ${request.jsonrpc}, body[method]: ${request.method}, body[id]: ${request.id}, ctx.request.method: ${request.method}`,
    );
    return false;
  } else {
    return true;
  }
};

/**
 * Verifies if the provided method is supported.
 * @param {string} method - The method to verify.
 * @returns {boolean} A boolean indicating whether the method is supported.
 */
export const verifySupportedMethod = (method: string): boolean => {
  return hasOwnProperty(WS_CONSTANTS.METHODS, method.toUpperCase());
};

/**
 * Resolves parameters based on the provided method.
 * @param {string} method - The method associated with the parameters.
 * @param {any} params - The parameters to resolve.
 * @returns {any[]} Resolved parameters.
 */
export const resolveParams = (method: string, params: any): any[] => {
  switch (method) {
    case WS_CONSTANTS.METHODS.ETH_GETLOGS:
      return [params[0].blockHash, params[0].fromBlock, params[0].toBlock, params[0].address, params[0].topics];
    default:
      return params;
  }
};

/**
 * Checks if the JSON-RPC request has an invalid ID.
 * @param {any} request - The JSON-RPC request object.
 * @param {any} logger - The logger instance used for logging.
 * @param {string} requestIdPrefix - The prefix to use for the request ID.
 * @param {string} connectionIdPrefix - The prefix to use for the connection ID.
 * @returns {boolean} A boolean indicating whether the request ID is invalid.
 */
const hasInvalidReqestId = (
  request: any,
  logger: any,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): boolean => {
  const hasId = hasOwnProperty(request, 'id');

  if (requestIdIsOptional && !hasId) {
    // If the request is invalid, we still want to return a valid JSON-RPC response, default id to 0
    request.id = '0';
    logger.warn(
      `${connectionIdPrefix} ${requestIdPrefix} Optional JSON-RPC 2.0 request id encountered. Will continue and default id to 0 in response`,
    );
    return false;
  }

  return !hasId;
};
