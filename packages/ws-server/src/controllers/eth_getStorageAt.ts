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
 * Handles the "eth_getStorageAt" method request by retrieving the value stored at a specific storage position in an Hedera account's storage.
 * Validates the parameters, retrieves the storage information using the relay object, and sends the response back to the client.
 * @param {object} args - An object containing the function parameters as properties.
 * @param {any} args.ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} args.params - The parameters of the method request, expecting an address, a position, and a block parameter.
 * @param {any} args.logger - The logger object for logging messages and events.
 * @param {Relay} args.relay - The relay object for interacting with the Hedera network.
 * @param {any} args.request - The request object received from the client.
 * @param {string} args.method - The JSON-RPC method associated with the request.
 * @param {string} args.requestIdPrefix - The prefix for the request ID.
 * @param {string} args.connectionIdPrefix - The prefix for the connection ID.
 * @throws {JsonRpcError} Throws a JsonRpcError if the method parameters are invalid or an internal error occurs.
 */
export const handleEthGetStorageAt = async ({
  ctx,
  params,
  logger,
  relay,
  request,
  method,
  requestIdPrefix,
  connectionIdPrefix,
}) => {
  if (params.length !== 2 && params.length !== 3) {
    throw predefined.INVALID_PARAMETERS;
  }

  const ADDRESS = params[0];
  const POSITION = params[1];
  const BLOCK_PARAM = params[2];
  const TAG = JSON.stringify({ method, address: ADDRESS, position: POSITION, block: BLOCK_PARAM });

  logger.info(`${connectionIdPrefix} ${requestIdPrefix}: Retrieving storage information for tag=${TAG}`);

  await handleSendingRequestsToRelay(
    ctx,
    TAG,
    [ADDRESS, POSITION, BLOCK_PARAM, requestIdPrefix],
    relay,
    logger,
    request,
    method,
    'getStorageAt',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
