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

import { predefined, Relay } from '@hashgraph/json-rpc-relay';
import WsMetricRegistry from '../metrics/wsMetricRegistry';
import ConnectionLimiter from '../metrics/connectionLimiter';
import { WS_CONSTANTS } from './constants';

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
 * Sends a JSON-RPC response message to the client WebSocket connection.
 * Resets the TTL timer for inactivity on the client connection.
 * @param {any} connection - The WebSocket connection object to the client.
 * @param {any} params - The parameters associated with the original request.
 * @param {any} method - The method associated with the original request.
 * @param {any} response - The response data to be sent back to the client.
 * @param {any} logger - The logger object used for logging messages.
 * @param {string} requestIdPrefix - The prefix added to the request ID for logging purposes.
 * @param {string} connectionIdPrefix - The prefix added to the connection ID for logging purposes.
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
  logger.trace(
    `${connectionIdPrefix} ${requestIdPrefix}: Sending data=${JSON.stringify(
      response.result,
    )} to client from tag=${constructRequestTag(method, params)}`,
  );

  connection.send(JSON.stringify(response));
  connection.limiter.resetInactivityTTLTimer(connection);
};

/**
 * Handles sending requests to a Relay by calling a specified method with given parameters.
 * This function constructs a request tag, submits the request to the relay, and logs the process.
 * @param {string} method - The method to call on the relay.
 * @param {any} params - The parameters for the method call.
 * @param {Relay} relay - The relay object.
 * @param {any} logger - The logger object used for tracing.
 * @param {string} requestIdPrefix - Prefix for request ID used for logging.
 * @param {string} connectionIdPrefix - Prefix for connection ID used for logging.
 * @returns {Promise<any>} A promise that resolves to the result of the request.
 */
export const handleSendingRequestsToRelay = async (
  method: string,
  params: any,
  relay: Relay,
  logger: any,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): Promise<any> => {
  const tag = constructRequestTag(method, params);
  logger.trace(`${connectionIdPrefix} ${requestIdPrefix}: Submitting request to relay for tag=${tag}.`);

  try {
    const resolvedParams = resolveParams(method, params);
    const txRes = await relay.eth()[method.split('_')[1]](...resolvedParams, requestIdPrefix);
    if (!txRes) {
      logger.trace(`${connectionIdPrefix} ${requestIdPrefix}: Fail to retrieve result for tag=${tag}. Data=${txRes}`);
    }

    return txRes;
  } catch (error: any) {
    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};

/**
 * Resolves parameters based on the provided method.
 * @param {string} method - The method associated with the parameters.
 * @param {any} params - The parameters to resolve.
 * @returns {any[]} Resolved parameters.
 */
export const resolveParams = (method: string, params: any): any[] => {
  switch (method) {
    case WS_CONSTANTS.METHODS.ETH_GET_LOGS:
      return [params[0].blockHash, params[0].fromBlock, params[0].toBlock, params[0].address, params[0].topics];
    default:
      return params;
  }
};

/**
 * Constructs a tag for the request. Tag is primarily utilized for logging purposes to aid in the debugging process
 * @param {string} method - The method associated with the request.
 * @param {any} params - The parameters associated with the request.
 * @returns {string} - The constructed request tag.
 */
export const constructRequestTag = (method: string, params: any): string => {
  return JSON.stringify({ method, params });
};
