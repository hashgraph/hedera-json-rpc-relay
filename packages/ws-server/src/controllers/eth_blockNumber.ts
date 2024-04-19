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

import { predefined } from '@hashgraph/json-rpc-relay';
import { handleSendingRequestsToRelay } from './helpers';

/**
 * Handles the "eth_blockNumber" method request by retrieving the current block number from the Hedera network.
 * Validates the parameters, retrieves the current block number using the relay object, and sends the response back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} params - The parameters of the method request, expecting no parameters.
 * @param {object} args - An object containing the function parameters as properties.
 * @param {any} args.ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} args.params - The parameters of the method request, expecting a block param (block number or block tag) and a boolean flag indicating whether to include detailed information.
 * @param {any} args.logger - The logger object for logging messages and events.
 * @param {Relay} args.relay - The relay object for interacting with the Hedera network.
 * @param {any} args.request - The request object received from the client.
 * @param {string} args.method - The JSON-RPC method associated with the request.
 * @param {string} args.requestIdPrefix - The prefix for the request ID.
 * @param {string} args.connectionIdPrefix - The prefix for the connection ID.
 * @throws {JsonRpcError} Throws a JsonRpcError if the method parameters are invalid or an internal error occurs.
 */
export const handleEthBlockNumber = async ({
  ctx,
  params,
  logger,
  relay,
  request,
  method,
  requestIdPrefix,
  connectionIdPrefix,
}) => {
  if (params.length !== 0) {
    throw predefined.INVALID_PARAMETERS;
  }

  const TAG = JSON.stringify({ method });
  logger.info(`${connectionIdPrefix} ${requestIdPrefix}: Retrieving current block number for tag=${TAG}`);

  await handleSendingRequestsToRelay(
    ctx,
    TAG,
    [requestIdPrefix],
    relay,
    logger,
    request,
    method,
    'blockNumber',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
