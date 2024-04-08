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

import { Relay } from '@hashgraph/json-rpc-relay';
import ConnectionLimiter from './connectionLimiter';

/**
 * Handles the closure of a WebSocket connection.
 * Unsubscribes the WebSocket from any subscriptions in the relay, decrements counters in the limiter, and terminates the WebSocket connection.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {ConnectionLimiter} limiter - The limiter object used for rate limiting WebSocket connections.
 */
export const handleConnectionClose = async (ctx: any, relay: Relay, limiter: ConnectionLimiter) => {
  relay.subs()?.unsubscribe(ctx.websocket);
  limiter.decrementCounters(ctx);
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
 * @param {any} connection - The WebSocket connection object.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the response.
 * @param {any} data - The data to be included in the response.
 * @param {string} tag - A tag used for logging and identifying the message.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 */
export const sendToClient = (
  connection: any,
  request: any,
  method: string,
  data: any,
  tag: string,
  logger: any,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix}: Sending data from tag: ${tag} to connectionId: ${
      connection.id
    }, data: ${JSON.stringify(data)}`,
  );

  connection.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method,
      result: data,
      id: request.id,
    }),
  );
  connection.limiter.resetInactivityTTLTimer(connection);
};
