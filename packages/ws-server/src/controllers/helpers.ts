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
import { sendToClient } from '../utils/utils';
import { Relay } from '@hashgraph/json-rpc-relay';
import { predefined } from '@hashgraph/json-rpc-relay';

/**
 * Handles sending requests to the relay server for Hedera network interactions using the specified RPC call endpoint.
 * Executes the specified Hedera RPC call endpoint with the provided arguments, retrieves the response, and sends it back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {string} tag - A tag used for logging and identifying the message.
 * @param {any[]} args - An array of arguments required for the Hedera RPC call.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} rpcCallEndpoint - The Hedera RPC call endpoint to execute.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @throws {JsonRpcError} Throws a JsonRpcError if there is an issue with the Hedera RPC call or an internal error occurs.
 */
export const handleSendingRequestsToRelay = async (
  ctx: any,
  tag: string,
  args: any[],
  relay: Relay,
  logger: any,
  request: any,
  method: string,
  rpcCallEndpoint: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  try {
    const txRes = await relay.eth()[rpcCallEndpoint](...args);
    if (!txRes) {
      logger.debug(`${connectionIdPrefix} ${requestIdPrefix}: Fail to retrieve result for tag=${tag}. Data=${txRes}`);
    }

    sendToClient(ctx.websocket, request, method, txRes, tag, logger, requestIdPrefix, connectionIdPrefix);
  } catch (error: any) {
    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};
