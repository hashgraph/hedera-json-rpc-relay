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
import { validateParamsLength } from '../utils/validators';
import { predefined, Relay } from '@hashgraph/json-rpc-relay';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';

/**
 * Handles the "eth_getTransactionByHash" method request by retrieving transaction details from the Hedera network.
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
export const handleEthGetTransactionByHash = async (
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
  const TX_HASH = params[0];
  const TAG = JSON.stringify({ method, signedTx: TX_HASH });

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
    `${connectionIdPrefix} ${requestIdPrefix} ${socketIdPrefix}: Retrieving transaction with txHash=${TX_HASH} for tag=${TAG}`,
  );

  try {
    const txRes = await relay.eth().getTransactionByHash(TX_HASH, requestIdPrefix);
    if (txRes) {
      sendToClient(ctx.websocket, method, txRes, TAG, logger, socketIdPrefix, requestIdPrefix, connectionIdPrefix);
    } else {
      logger.error(
        `${connectionIdPrefix} ${requestIdPrefix} ${socketIdPrefix}: Fail to retrieve result for tag=${TAG}`,
      );
    }

    return jsonResp(request.id, null, txRes);
  } catch (error: any) {
    sendToClient(
      ctx.websocket,
      method,
      JSON.stringify(error.message || error),
      TAG,
      logger,
      socketIdPrefix,
      requestIdPrefix,
      connectionIdPrefix,
    );

    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};
