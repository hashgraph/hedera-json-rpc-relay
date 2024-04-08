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
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';

/**
 * Handles sending transaction-related requests to the Hedera network, such as sending raw transactions or getting transaction information.
 * Executes the specified Hedera RPC call endpoint with the provided argument, retrieves the response, and sends it back to the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {string} tag - A tag used for logging and identifying the message.
 * @param {string} arg - The argument required for the Hedera RPC call.
 * @param {Relay} relay - The relay object for interacting with the Hedera network.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {any} request - The request object received from the client.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} rpcCallEndpoint - The Hedera RPC call endpoint to execute.
 * @param {string} socketIdPrefix - The prefix for the socket ID.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @returns {Promise<any>} Returns a promise that resolves with the JSON-RPC response to the client.
 * @throws {JsonRpcError} Throws a JsonRpcError if there is an issue with the Hedera RPC call or an internal error occurs.
 */
export const handleSendingTransactionRequests = async (
  ctx: any,
  tag: string,
  arg: string,
  relay: Relay,
  logger: any,
  request: any,
  method: string,
  rpcCallEndpoint: string,
  socketIdPrefix: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
): Promise<any> => {
  try {
    const txRes = await relay.eth()[rpcCallEndpoint](...arg, requestIdPrefix);

    if (txRes) {
      sendToClient(ctx.websocket, method, txRes, tag, logger, socketIdPrefix, requestIdPrefix, connectionIdPrefix);
    } else {
      logger.error(
        `${connectionIdPrefix} ${requestIdPrefix} ${socketIdPrefix}: Fail to retrieve result for tag=${tag}`,
      );
    }

    return jsonResp(request.id, null, txRes);
  } catch (error: any) {
    sendToClient(
      ctx.websocket,
      method,
      JSON.stringify(error.message || error),
      tag,
      logger,
      socketIdPrefix,
      requestIdPrefix,
      connectionIdPrefix,
    );

    throw predefined.INTERNAL_ERROR(JSON.stringify(error.message || error));
  }
};
