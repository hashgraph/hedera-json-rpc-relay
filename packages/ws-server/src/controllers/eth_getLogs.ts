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

import { handleSendingRequestsToRelay } from './helpers';
import { Relay, predefined } from '@hashgraph/json-rpc-relay';

/**
 * Handles the "eth_getLogs" method request by retrieving logs that match the specified filter object.
 * Validates the parameters, retrieves the logs using the relay object, and sends the response back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} params - The parameters of the method request, expecting a filter object.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @returns {Promise<void>} Returns a promise that resolves after processing the request.
 * @throws {JsonRpcError} Throws a JsonRpcError if the method parameters are invalid or an internal error occurs.
 */
export const handleEthGetLogs = async (
  ctx: any,
  params: any,
  logger: any,
  relay: Relay,
  request: any,
  method: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): Promise<any> => {
  if (params.length !== 1) {
    throw predefined.INVALID_PARAMETERS;
  }

  const FILTER = params[0];
  const TAG = JSON.stringify({ method, filter: FILTER });

  logger.info(`${connectionIdPrefix} ${requestIdPrefix}: Retrieving logs for tag=${TAG}`);

  // prepare filter params
  const getLogsParams = [
    FILTER.blockHash,
    FILTER.fromBlock,
    FILTER.toBlock,
    FILTER.address,
    FILTER.topics,
    requestIdPrefix,
  ];

  await handleSendingRequestsToRelay(
    ctx,
    TAG,
    getLogsParams,
    relay,
    logger,
    request,
    method,
    'getLogs',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
