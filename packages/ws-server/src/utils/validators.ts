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

import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';
import { MirrorNodeClient } from '@hashgraph/json-rpc-relay/dist/lib/clients';
import { EthSubscribeLogsParamsObject } from '@hashgraph/json-rpc-server/dist/validator';

/**
 * Validates whether the provided address corresponds to a contract or token type.
 * Throws an error if the address is not a valid contract or token type or does not exist.
 * @param {string} address - The address to validate.
 * @param {string} requestId - The unique identifier for the request.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 * @throws {JsonRpcError} Throws a JsonRpcError if the address is not a valid contract or token type or does not exist.
 */
const validateIsContractOrTokenAddress = async (
  address: string,
  requestId: string,
  mirrorNodeClient: MirrorNodeClient,
) => {
  const isContractOrToken = await mirrorNodeClient.resolveEntityType(
    address,
    [constants.TYPE_CONTRACT, constants.TYPE_TOKEN],
    constants.METHODS.ETH_SUBSCRIBE,
    requestId,
  );
  if (!isContractOrToken) {
    throw new JsonRpcError(
      predefined.INVALID_PARAMETER(
        'filters.address',
        `${address} is not a valid contract or token type or does not exists`,
      ),
      requestId,
    );
  }
};

/**
 * Validates the parameters for subscribing to ETH logs.
 * @param {any} filters - The filters object containing parameters for subscribing to ETH logs.
 * @param {string} requestId - The unique identifier for the request.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 */
export const validateSubscribeEthLogsParams = async (
  filters: any,
  requestId: string,
  mirrorNodeClient: MirrorNodeClient,
) => {
  // validate address exists and is correct lengh and type
  // validate topics if exists and is array and each one is correct lengh and type
  const paramsObject = new EthSubscribeLogsParamsObject(filters);
  paramsObject.validate();

  // validate address or addresses are an existing smart contract
  if (paramsObject.address) {
    if (Array.isArray(paramsObject.address)) {
      for (const address of paramsObject.address) {
        await validateIsContractOrTokenAddress(address, requestId, mirrorNodeClient);
      }
    } else {
      await validateIsContractOrTokenAddress(paramsObject.address, requestId, mirrorNodeClient);
    }
  }
};

/**
 * Validates the length of parameters received in a JSON-RPC method request.
 * If the length does not match the expected length, logs an error, sends an error response to the client,
 * and throws an exception for invalid parameters.
 * @param {any} ctx - The context object containing information about the WebSocket connection.
 * @param {any[]} params - The parameters of the method request.
 * @param {string} method - The JSON-RPC method associated with the request.
 * @param {string} tag - A tag used for logging and identifying the message.
 * @param {any} logger - The logger object for logging messages and events.
 * @param {any} sendToClient - The function for sending responses to the client.
 * @param {number} expectedLength - The expected length of parameters for the method request.
 * @param {string} socketIdPrefix - The prefix for the socket ID.
 * @param {string} requestIdPrefix - The prefix for the request ID.
 * @param {string} connectionIdPrefix - The prefix for the connection ID.
 * @throws {JsonRpcError} Throws a JsonRpcError if the length of parameters does not match the expected length.
 */
export const validateParamsLength = (
  ctx: any,
  params: any,
  method: string,
  tag: string,
  logger: any,
  sendToClient: any,
  expectedLength: number,
  socketIdPrefix: string,
  requestIdPrefix: string,
  connectionIdPrefix: string,
) => {
  if (params.length !== expectedLength) {
    const ERR_MSG = 'INVALID PARAMETERS';
    logger.error(`${connectionIdPrefix} ${requestIdPrefix} ${socketIdPrefix}: Invalid parameters ${params}`);
    sendToClient(ctx.websocket, method, ERR_MSG, tag, logger, socketIdPrefix, requestIdPrefix, connectionIdPrefix);
    throw predefined.INVALID_PARAMETERS;
  }
};
