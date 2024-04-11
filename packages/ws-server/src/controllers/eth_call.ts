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
import { predefined } from '@hashgraph/json-rpc-relay';
import { handleSendingRequestsToRelay } from './helpers';

/**
 * Handles the "eth_call" method request by executing a call operation against a contract on the Hedera network.
 * Validates the parameters, executes the call operation using the relay object, and sends the response back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} params - The parameters of the method request, expecting transaction information and a block parameter.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @returns {Promise<void>} Returns a promise that resolves after processing the request.
 * @throws {JsonRpcError} Throws a JsonRpcError if the method parameters are invalid or an internal error occurs.
 */
export const handleEthCall = async (
  ctx: any,
  params: any,
  logger: any,
  relay: Relay,
  request: any,
  method: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  const TX_INFO = params[0];
  const BLOCK_PARAM = params[1];
  const TAG = JSON.stringify({ method, txInfo: TX_INFO, block: BLOCK_PARAM });

  if (params.length !== 2) {
    throw predefined.INVALID_PARAMETERS;
  }

  logger.info(`${connectionIdPrefix} ${requestIdPrefix}: Retrieving call result for tag=${TAG}`);

  await handleSendingRequestsToRelay(
    ctx,
    TAG,
    [TX_INFO, BLOCK_PARAM, requestIdPrefix],
    relay,
    logger,
    request,
    method,
    'call',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
