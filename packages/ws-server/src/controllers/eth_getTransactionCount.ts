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
import { handleSendingRequestsToRelay } from './helpers';

/**
 * Handles the "eth_getTransactionCount" method request by retrieving transaction details from the Hedera network.
 * Validates the parameters, retrieves the transaction details, and sends the response back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} params - The parameters of the method request, expecting a single parameter: the transaction hash.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} socketIdPrefix - The prefix for the socket ID.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @returns {Promise<any>} Returns a promise that resolves with the JSON-RPC response to the client.
 * @throws {JsonRpcError} Throws a JsonRpcError if there is an issue with the parameters or an internal error occurs.
 */
export const handleEthGetTransactionCount = async (
  ctx: any,
  params: any,
  logger: any,
  relay: Relay,
  request: any,
  method: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  const ADDRESS = params[0];
  const TAG = JSON.stringify({ method, address: ADDRESS });

  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix}: Retrieving address transaction count with address=${ADDRESS} for tag=${TAG}`,
  );

  return handleSendingRequestsToRelay(
    ctx,
    TAG,
    params,
    relay,
    logger,
    request,
    method,
    'getTransactionCount',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
