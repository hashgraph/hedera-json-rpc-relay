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
import ConnectionLimiter from '../metrics/connectionLimiter';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';

/**
 * Handles unsubscription requests for on-chain events.
 * Unsubscribes the WebSocket from the specified subscription ID and returns the response.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any} params - The parameters of the unsubscription request.
 * @param {any} request - The request object received from the client.
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {ConnectionLimiter} limiter - The limiter object used for rate limiting WebSocket connections.
 * @returns {any} Returns the response to the unsubscription request.
 */
export const handleEthUnsubscribe = (
  ctx: any,
  params: any,
  request: any,
  relay: Relay,
  limiter: ConnectionLimiter,
): any => {
  const subId = params[0];
  const unsubbedCount = relay.subs()?.unsubscribe(ctx.websocket, subId);
  limiter.decrementSubs(ctx, unsubbedCount);
  return jsonResp(request.id, null, unsubbedCount !== 0);
};
