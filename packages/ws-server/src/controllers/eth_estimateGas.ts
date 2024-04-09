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
import { validateParamsLength } from '../utils/validators';
import { handleSendingTransactionRequests } from './helpers';

/**
 * Handles the "eth_estimateGas" method request by retrieving transaction details from the Hedera network.
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
export const handleEthEstimateGas = async (
  ctx: any,
  params: any,
  logger: any,
  relay: Relay,
  request: any,
  method: string,
  socketIdPrefix: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  const TXN = params[0];
  const TAG = JSON.stringify({ method, txn: TXN });

  validateParamsLength(
    ctx,
    params,
    method,
    TAG,
    logger,
    sendToClient,
    1,
    socketIdPrefix,
    requestIdPrefix,
    connectionIdPrefix,
  );

  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix} ${socketIdPrefix}: Retrieving estimated gas with txn=${TXN} for tag=${TAG}`,
  );

  return handleSendingTransactionRequests(
    ctx,
    TAG,
    params,
    relay,
    logger,
    request,
    method,
    'estimateGas',
    socketIdPrefix,
    requestIdPrefix,
    connectionIdPrefix,
  );
};
