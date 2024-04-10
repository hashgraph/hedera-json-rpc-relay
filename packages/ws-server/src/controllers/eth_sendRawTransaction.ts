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
 * Handles the "eth_sendRawTransaction" method request by submitting a raw transaction to the Websocket server.
 * Validates the parameters, submits the transaction, and sends the txHash response back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any} params - The parameters of the method request, expecting a single parameter: the signed transaction.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The name of the method.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @returns {Promise<any>} Returns a promise that resolves with the JSON-RPC response to the client.
 * @throws {JsonRpcError} Throws a JsonRpcError if there is an issue with the parameters or an internal error occurs.
 */
export const handleEthSendRawTransaction = async (
  ctx: any,
  params: any,
  logger: any,
  relay: Relay,
  request: any,
  method: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  if (params.length !== 1) {
    throw predefined.INVALID_PARAMETERS;
  }

  const SIGNED_TX = params[0];
  const TAG = JSON.stringify({ method, signedTx: SIGNED_TX });

  logger.info(
    `${connectionIdPrefix} ${requestIdPrefix}: Submitting raw transaction with signedTx=${SIGNED_TX} for tag=${TAG}`,
  );

  await handleSendingRequestsToRelay(
    ctx,
    TAG,
    [SIGNED_TX, requestIdPrefix],
    relay,
    logger,
    request,
    method,
    'sendRawTransaction',
    requestIdPrefix,
    connectionIdPrefix,
  );
};
