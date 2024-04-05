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

import ConnectionLimiter from '../utils/connectionLimiter';
import { getMultipleAddressesEnabled } from '../utils/utils';
import { predefined, Relay } from '@hashgraph/json-rpc-relay';
import { validateSubscribeEthLogsParams } from '../utils/validators';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import jsonResp from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcResponse';
import { MirrorNodeClient } from '@hashgraph/json-rpc-relay/dist/lib/clients';

/**
 * Subscribes to new block headers (newHeads) events and returns the response and subscription ID.
 * @param {any} filters - The filters object specifying criteria for the subscription.
 * @param {any} response - The response object to be sent to the client.
 * @param {any} subscriptionId - The ID of the subscription.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {string} event - The event name to subscribe to (e.g., "newHeads").
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {any} logger - The logger object used for logging subscription information.
 * @returns {{ response: any; subscriptionId: any }} Returns an object containing the response and subscription ID.
 */
const subscribeToNewHeads = (
  filters: any,
  response: any,
  subscriptionId: any,
  ctx: any,
  event: string,
  relay: Relay,
  logger: any,
): { response: any; subscriptionId: any } => {
  subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, filters);
  logger.info(`Subscribed to newHeads, subscriptionId: ${subscriptionId}`);
  return { response, subscriptionId };
};

/**
 * Handles the subscription request for newHeads events.
 * If newHeads subscription is enabled, subscribes to the event; otherwise, sends an unsupported method response.
 * @param {any} response - The response object to be sent to the client.
 * @param {any} subscriptionId - The ID of the subscription.
 * @param {any} filters - The filters object specifying criteria for the subscription.
 * @param {any} request - The request object received from the client.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {string} event - The event name to subscribe to (e.g., "newHeads").
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {any} logger - The logger object used for logging subscription information.
 * @returns {{ response: any; subscriptionId: any }} Returns an object containing the response and subscription ID.
 */
const handleEthSubscribeNewHeads = (
  response: any,
  subscriptionId: any,
  filters: any,
  request: any,
  ctx: any,
  event: string,
  relay: Relay,
  logger: any,
): { response: any; subscriptionId: any } => {
  if (process.env.WS_NEW_HEADS_ENABLED === 'true') {
    ({ response, subscriptionId } = subscribeToNewHeads(filters, response, subscriptionId, ctx, event, relay, logger));
  } else {
    response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
  }
  return { response, subscriptionId };
};

/**
 * Handles the subscription request for logs events.
 * Validates the subscription parameters, checks if multiple addresses are enabled,
 * and subscribes to the event or sends an error response accordingly.
 * @param {any} filters - The filters object specifying criteria for the subscription.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {any} response - The response object to be sent to the client.
 * @param {any} request - The request object received from the client.
 * @param {any} subscriptionId - The ID of the subscription.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any} event - The event name to subscribe to.
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 * @returns {{ response: any; subscriptionId: any }} Returns an object containing the response and subscription ID.
 */
const handleEthSubscribeLogs = async (
  filters: any,
  requestIdPrefix: string,
  response: any,
  request: any,
  subscriptionId: any,
  ctx: any,
  event: any,
  relay: Relay,
  mirrorNodeClient: MirrorNodeClient,
): Promise<{ response: any; subscriptionId: any }> => {
  await validateSubscribeEthLogsParams(filters, requestIdPrefix, mirrorNodeClient);
  if (!getMultipleAddressesEnabled() && Array.isArray(filters.address) && filters.address.length > 1) {
    response = jsonResp(
      request.id,
      predefined.INVALID_PARAMETER('filters.address', 'Only one contract address is allowed'),
      undefined,
    );
  } else {
    subscriptionId = relay.subs()?.subscribe(ctx.websocket, event, filters);
  }
  return { response, subscriptionId };
};

/**
 * Handles subscription requests for on-chain events.
 * Subscribes to the specified event type and returns the response.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any} params - The parameters of the subscription request.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {any} request - The request object received from the client.
 * @param {Relay} relay - The relay object used for managing WebSocket subscriptions.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 * @param {ConnectionLimiter} limiter - The limiter object used for rate limiting WebSocket connections.
 * @param {any} logger - The logger object used for logging subscription information.
 * @returns {Promise<any>} Returns a promise that resolves with the response to the subscription request.
 */
export const handleEthSubsribe = async (
  ctx: any,
  params: any,
  requestIdPrefix: string,
  request: any,
  relay: Relay,
  mirrorNodeClient: MirrorNodeClient,
  limiter: ConnectionLimiter,
  logger: any,
): Promise<any> => {
  const event = params[0];
  const filters = params[1];
  let response: any;
  let subscriptionId: any;

  switch (event) {
    case constants.SUBSCRIBE_EVENTS.LOGS:
      ({ response, subscriptionId } = await handleEthSubscribeLogs(
        filters,
        requestIdPrefix,
        response,
        request,
        subscriptionId,
        ctx,
        event,
        relay,
        mirrorNodeClient,
      ));
      break;

    case constants.SUBSCRIBE_EVENTS.NEW_HEADS:
      ({ response, subscriptionId } = handleEthSubscribeNewHeads(
        response,
        subscriptionId,
        filters,
        request,
        ctx,
        event,
        relay,
        logger,
      ));
      break;
    case constants.SUBSCRIBE_EVENTS.NEW_PENDING_TRANSACTIONS:
      response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
      break;

    default:
      response = jsonResp(request.id, predefined.UNSUPPORTED_METHOD, undefined);
  }

  limiter.incrementSubs(ctx);
  response = response ?? (subscriptionId ? jsonResp(request.id, null, subscriptionId) : undefined);

  return response;
};
