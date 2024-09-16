/* -
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { RequestDetails } from '@hashgraph/json-rpc-relay/dist/lib/types';

/**
 * Validates whether the provided address corresponds to a contract or token type.
 * Throws an error if the address is not a valid contract or token type or does not exist.
 * @param {string} address - The address to validate.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 * @param {RequestDetails} requestDetails - The request details for logging and tracking.
 * @throws {JsonRpcError} Throws a JsonRpcError if the address is not a valid contract or token type or does not exist.
 */
const validateIsContractOrTokenAddress = async (
  address: string,
  mirrorNodeClient: MirrorNodeClient,
  requestDetails: RequestDetails,
) => {
  const isContractOrToken = await mirrorNodeClient.resolveEntityType(
    address,
    [constants.TYPE_CONTRACT, constants.TYPE_TOKEN],
    constants.METHODS.ETH_SUBSCRIBE,
    requestDetails,
  );
  if (!isContractOrToken) {
    throw new JsonRpcError(
      predefined.INVALID_PARAMETER(
        'filters.address',
        `${address} is not a valid contract or token type or does not exists`,
      ),
      requestDetails.formattedRequestId,
    );
  }
};

/**
 * Validates the parameters for subscribing to ETH logs.
 * @param {any} filters - The filters object containing parameters for subscribing to ETH logs.
 * @param {MirrorNodeClient} mirrorNodeClient - The client for interacting with the MirrorNode API.
 * @param {RequestDetails} requestDetails - The request details for logging and tracking.
 */
export const validateSubscribeEthLogsParams = async (
  filters: any,
  mirrorNodeClient: MirrorNodeClient,
  requestDetails: RequestDetails,
) => {
  // validate address exists and is correct length and type
  // validate topics if exists and is array and each one is correct length and type
  const ethSubscribeLogsParams = new EthSubscribeLogsParamsObject(filters);
  ethSubscribeLogsParams.validate();

  // validate address or addresses are an existing smart contract
  if (ethSubscribeLogsParams.object.address) {
    if (Array.isArray(ethSubscribeLogsParams.object.address)) {
      for (const address of ethSubscribeLogsParams.object.address) {
        await validateIsContractOrTokenAddress(address, mirrorNodeClient, requestDetails);
      }
    } else {
      await validateIsContractOrTokenAddress(ethSubscribeLogsParams.object.address, mirrorNodeClient, requestDetails);
    }
  }
};

/**
 * Validates whether a given string is a 32-byte hexadecimal string.
 * Checks if the string starts with '0x' followed by 64 hexadecimal characters.
 * @param {string} hash - The string to be validated.
 * @returns {boolean} Returns true if the string is a valid 32-byte hexadecimal string, otherwise false.
 */
export const validate32bytesHexaString = (hash: string): boolean => {
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
};
