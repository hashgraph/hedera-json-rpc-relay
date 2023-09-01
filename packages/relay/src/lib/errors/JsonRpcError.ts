/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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
import { decodeErrorMessage } from "../../formatters";
import constants from "../../lib/constants";

export class JsonRpcError {
  public code: number;
  public message: string;
  public name: string;
  public data?: string;

  constructor(args: { name: string; code: number; message: string; data?: string }, requestId?: string) {
    this.code = args.code;
    this.name = args.name;
    this.message = requestId ? `[${constants.REQUEST_ID_STRING}${requestId}] ` + args.message : args.message;
    this.data = args.data;
  }
}

export const predefined = {
  CONTRACT_REVERT: (errorMessage?: string, data: string = "") =>
    new JsonRpcError({
      name: "Contract revert executed",
      code: -32008,
      message: `execution reverted: ${decodeErrorMessage(errorMessage)}`,
      data: data,
    }),
  GAS_LIMIT_TOO_HIGH: (gasLimit, maxGas) =>
    new JsonRpcError({
      name: "gasLimit too high",
      code: -32005,
      message: `Transaction gas limit '${gasLimit}' exceeds block gas limit '${maxGas}'`,
    }),
  GAS_LIMIT_TOO_LOW: (gasLimit, requiredGas) =>
    new JsonRpcError({
      name: "gasLimit too low",
      code: -32003,
      message: `Transaction gas limit provided '${gasLimit}' is insufficient of intrinsic gas required '${requiredGas}'`,
    }),
  GAS_PRICE_TOO_LOW: (gasPrice, minGasPrice) =>
    new JsonRpcError({
      name: "Gas price too low",
      code: -32009,
      message: `Gas price '${gasPrice}' is below configured minimum gas price '${minGasPrice}'`,
    }),
  HBAR_RATE_LIMIT_EXCEEDED: new JsonRpcError({
    name: "HBAR Rate limit exceeded",
    code: -32606,
    message: "HBAR Rate limit exceeded",
  }),
  INSUFFICIENT_ACCOUNT_BALANCE: new JsonRpcError({
    name: "Insufficient account balance",
    code: -32000,
    message: "Insufficient funds for transfer",
  }),
  INTERNAL_ERROR: (message = "") =>
    new JsonRpcError({
      name: "Internal error",
      code: -32603,
      message: message === "" || undefined ? "Unknown error invoking RPC" : `Error invoking RPC: ${message}`,
    }),
  INVALID_PARAMETER: (index: number | string, message: string) =>
    new JsonRpcError({
      name: "Invalid parameter",
      code: -32602,
      message: `Invalid parameter ${index}: ${message}`,
    }),
  INVALID_PARAMETERS: new JsonRpcError({
    name: "Invalid parameters",
    code: -32602,
    message: "Invalid params",
  }),
  INVALID_REQUEST: new JsonRpcError({
    name: "Invalid request",
    code: -32600,
    message: "Invalid request",
  }),
  IP_RATE_LIMIT_EXCEEDED: (methodName: string) =>
    new JsonRpcError({
      name: "IP Rate limit exceeded",
      code: -32605,
      message: `IP Rate limit exceeded on ${methodName}`,
    }),
  MISSING_FROM_BLOCK_PARAM: new JsonRpcError({
    name: "Missing fromBlock parameter",
    code: -32011,
    message: "Provided toBlock parameter without specifying fromBlock",
  }),
  MISSING_REQUIRED_PARAMETER: (index: number | string) =>
    new JsonRpcError({
      name: "Missing required parameters",
      code: -32602,
      message: `Missing value for required parameter ${index}`,
    }),
  NONCE_TOO_LOW: (nonce, currentNonce) =>
    new JsonRpcError({
      name: "Nonce too low",
      code: 32001,
      message: `Nonce too low. Provided nonce: ${nonce}, current nonce: ${currentNonce}`,
    }),
  NONCE_TOO_HIGH: (nonce, currentNonce) =>
    new JsonRpcError({
      name: "Nonce too high",
      code: 32002,
      message: `Nonce too high. Provided nonce: ${nonce}, current nonce: ${currentNonce}`,
    }),
  NO_MINING_WORK: new JsonRpcError({
    name: "No mining work",
    code: -32000,
    message: "No mining work available yet",
  }),
  PARSE_ERROR: new JsonRpcError({
    name: "Parse error",
    code: -32700,
    message: "Unable to parse JSON",
  }),
  RANGE_TOO_LARGE: (blockRange: number) =>
    new JsonRpcError({
      name: "Block range too large",
      code: -32000,
      message: `Exceeded maximum block range: ${blockRange}`,
    }),
  REQUEST_BEYOND_HEAD_BLOCK: (requested: number, latest: number) =>
    new JsonRpcError({
      name: "Incorrect block",
      code: -32000,
      message: `Request beyond head block: requested ${requested}, head ${latest}`,
    }),
  REQUEST_TIMEOUT: new JsonRpcError({
    name: "Request timeout",
    code: -32010,
    message: "Request timeout. Please try again.",
  }),
  RESOURCE_NOT_FOUND: (message = "") =>
    new JsonRpcError({
      name: "Resource not found",
      code: -32001,
      message: `Requested resource not found. ${message}`,
    }),
  UNKNOWN_HISTORICAL_BALANCE: new JsonRpcError({
    name: "Unavailable balance",
    code: -32007,
    message: "Historical balance data is available only after 15 minutes.",
  }),
  UNSUPPORTED_CHAIN_ID: (requested: string | number, current: string | number) =>
    new JsonRpcError({
      name: "ChainId not supported",
      code: -32000,
      message: `ChainId (${requested}) not supported. The correct chainId is ${current}`,
    }),
  UNSUPPORTED_METHOD: new JsonRpcError({
    name: "Method not found",
    code: -32601,
    message: "Unsupported JSON-RPC method",
  }),
  VALUE_TOO_LOW: new JsonRpcError({
    name: "Value too low",
    code: -32602,
    message: "Value below 10_000_000_000 wei which is 1 tinybar",
  }),
  INVALID_CONTRACT_ADDRESS: (address) => {
    let message = `Invalid Contract Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected length of 42 chars but was ${address.length}.`;
    }

    return new JsonRpcError({
      name: "Invalid Contract Address",
      code: -32012,
      message: message,
    });
  },
  NON_EXISTING_CONTRACT: (address) => {
    let message = `Non Existing Contract Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected a Contract or Token Address.`;
    }

    return new JsonRpcError({
      name: "Non Existing Contract Address",
      code: -32013,
      message: message,
    });
  },
  NON_EXISTING_ACCOUNT: (address) => {
    let message = `Non Existing Account Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected an Account Address.`;
    }

    return new JsonRpcError({
      name: "Non Existing Account Address",
      code: -32014,
      message: message,
    });
  },
  COULD_NOT_ESTIMATE_GAS_PRICE: new JsonRpcError({
    name: "Could not estimate gas price",
    code: -32604,
    message: "Error encountered estimating the gas price",
  }),
  COULD_NOT_RETRIEVE_LATEST_BLOCK: new JsonRpcError({
    name: "Could not retrieve latest block",
    code: -32607,
    message: "Error encountered retrieving latest block",
  }),
  MAX_SUBSCRIPTIONS: new JsonRpcError({
    name: "Exceeded maximum allowed subscriptions",
    code: -32608,
    message: "Exceeded maximum allowed subscriptions",
  }),
  UNSUPPORTED_HISTORICAL_EXECUTION: (blockId: string) =>
    new JsonRpcError({
      name: "Unsupported historical block request",
      code: -32609,
      message: `Unsupported historical block identifier encountered: ${blockId}`,
    }),
  UNSUPPORTED_OPERATION: (message: string) =>
    new JsonRpcError({
      name: "Unsupported operation",
      code: -32610,
      message: `Unsupported operation. ${message}`,
    }),
  PAGINATION_MAX: (count: number) =>
    new JsonRpcError({
      name: "Mirror Node pagination count range too large",
      code: -32011,
      message: `Exceeded maximum mirror node pagination count: ${count}`,
    }),
  MAX_BLOCK_SIZE: (count: number) =>
    new JsonRpcError({
      name: "Block size too large",
      code: -32000,
      message: `Exceeded max transactions that can be returned in a block: ${count}`,
    }),
  UNKNOWN_BLOCK: new JsonRpcError({
    name: "Unknown block",
    code: -39012,
    message: "Unknown block",
  }),
  INVALID_BLOCK_RANGE: new JsonRpcError({
    name: "Invalid block range",
    code: -39013,
    message: "Invalid block range",
  }),
  FILTER_NOT_FOUND: new JsonRpcError({
    name: "Filter not found",
    code: -32001,
    message: "Filter not found",
  }),
};
