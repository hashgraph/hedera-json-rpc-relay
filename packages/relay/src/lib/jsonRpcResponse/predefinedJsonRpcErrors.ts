// SPDX-License-Identifier: Apache-2.0

import { decodeErrorMessage } from '../../formatters';
import { JsonRpcError } from './jsonRpcError';
/**
 * Standard JSON-RPC error codes and messages.
 *
 * According to the JSON-RPC 2.0 specification, error codes from -32768 to -32000 are reserved
 * for pre-defined errors. Custom error codes should be outside this range.
 *
 * Standard error codes:
 * - -32700: Parse error - Invalid JSON was received
 * - -32600: Invalid Request - The JSON sent is not a valid Request object
 * - -32601: Method not found - The method does not exist / is not available
 * - -32602: Invalid params - Invalid method parameter(s)
 * - -32603: Internal error - Internal JSON-RPC error
 * - -32000 to -32099: Server error - Reserved for implementation-defined server-errors
 *
 * @see https://www.jsonrpc.org/specification#error_object
 */

export type ErrorFunction = (...args: any[]) => JsonRpcError;
export type ErrorValue = JsonRpcError | ErrorFunction;

export const predefinedJsonRpcErrors = {
  /***************************************************************************
   ***************************************************************************
   ***                     Standard JSON-RPC errors                        ***
   ***************************************************************************
   ***************************************************************************/
  PARSE_ERROR: new JsonRpcError(-32700, 'Unable to parse JSON'),
  INVALID_REQUEST: new JsonRpcError(-32600, 'Invalid request'),
  UNSUPPORTED_METHOD: new JsonRpcError(-32601, 'Unsupported JSON-RPC method'),
  NOT_YET_IMPLEMENTED: new JsonRpcError(-32601, 'Not yet implemented'),
  INVALID_PARAMETERS: new JsonRpcError(-32602, 'Invalid params'),
  INVALID_PARAMETER: (index: number | string, message: string) =>
    new JsonRpcError(-32602, `Invalid parameter ${index}: ${message}`),
  MISSING_REQUIRED_PARAMETER: (index: number | string) =>
    new JsonRpcError(-32602, `Missing value for required parameter ${index}`),
  INTERNAL_ERROR: (message = '') =>
    new JsonRpcError(
      -32603,
      message === '' || undefined ? 'Unknown error invoking RPC' : `Error invoking RPC: ${message}`,
    ),

  /***************************************************************************
   ***************************************************************************
   ***                     Contract related errors                        ***
   ***************************************************************************
   ***************************************************************************/
  CONTRACT_REVERT: (errorMessage?: string, data: string = '') => {
    let message: string;
    if (errorMessage?.length) {
      message = `execution reverted: ${decodeErrorMessage(errorMessage)}`;
    } else {
      const decodedData = decodeErrorMessage(data);
      message = decodedData.length ? `execution reverted: ${decodedData}` : 'execution reverted';
    }
    return new JsonRpcError(3, message, data);
  },
  INVALID_CONTRACT_ADDRESS: (address: string) => {
    let message = `Invalid Contract Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected length of 42 chars but was ${address.length}.`;
    }
    return new JsonRpcError(-32012, message);
  },
  NON_EXISTING_CONTRACT: (address: string) => {
    let message = `Non Existing Contract Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected a Contract or Token Address.`;
    }
    return new JsonRpcError(-32013, message);
  },
  NON_EXISTING_ACCOUNT: (address: string) => {
    let message = `Non Existing Account Address: ${address}.`;
    if (address && address.length) {
      message = `${message} Expected an Account Address.`;
    }
    return new JsonRpcError(-32014, message);
  },

  /***************************************************************************
   ***************************************************************************
   ***                     Gas related errors                        ***
   ***************************************************************************
   ***************************************************************************/
  GAS_LIMIT_TOO_HIGH: (gasLimit: number | string, maxGas: number | string) =>
    new JsonRpcError(-32005, `Transaction gas limit '${gasLimit}' exceeds max gas per sec limit '${maxGas}'`),
  GAS_LIMIT_TOO_LOW: (gasLimit: number | string, requiredGas: number | string) =>
    new JsonRpcError(
      -32003,
      `Transaction gas limit provided '${gasLimit}' is insufficient of intrinsic gas required '${requiredGas}'`,
    ),
  GAS_PRICE_TOO_LOW: (gasPrice: number | string, minGasPrice: number | string) =>
    new JsonRpcError(-32009, `Gas price '${gasPrice}' is below configured minimum gas price '${minGasPrice}'`),
  COULD_NOT_ESTIMATE_GAS_PRICE: new JsonRpcError(-32604, 'Error encountered estimating the gas price'),

  /***************************************************************************
   ***************************************************************************
   ***                     Transaction related errors                        ***
   ***************************************************************************
   ***************************************************************************/
  NONCE_TOO_LOW: (nonce: number | string, currentNonce: number | string) =>
    new JsonRpcError(32001, `Nonce too low. Provided nonce: ${nonce}, current nonce: ${currentNonce}`),
  NONCE_TOO_HIGH: (nonce: number | string, currentNonce: number | string) =>
    new JsonRpcError(32002, `Nonce too high. Provided nonce: ${nonce}, current nonce: ${currentNonce}`),
  INSUFFICIENT_ACCOUNT_BALANCE: new JsonRpcError(-32000, 'Insufficient funds for transfer'),
  VALUE_TOO_LOW: new JsonRpcError(
    -32602,
    "Value can't be non-zero and less than 10_000_000_000 wei which is 1 tinybar",
  ),
  TRANSACTION_SIZE_TOO_BIG: (actualSize: string, expectedSize: string) =>
    new JsonRpcError(-32201, `Oversized data: transaction size ${actualSize}, transaction limit ${expectedSize}`),
  UNSUPPORTED_TRANSACTION_TYPE: new JsonRpcError(-32611, 'Unsupported transaction type'),
  UNSUPPORTED_CHAIN_ID: (requested: string | number, current: string | number) =>
    new JsonRpcError(-32000, `ChainId (${requested}) not supported. The correct chainId is ${current}`),
  RECEIVER_SIGNATURE_ENABLED: new JsonRpcError(
    -32000,
    "Operation is not supported when receiver's signature is enabled.",
  ),

  /***************************************************************************
   ***************************************************************************
   ***                     Block related errors                        ***
   ***************************************************************************
   ***************************************************************************/
  REQUEST_BEYOND_HEAD_BLOCK: (requested: number, latest: number) =>
    new JsonRpcError(-32000, `Request beyond head block: requested ${requested}, head ${latest}`),
  RANGE_TOO_LARGE: (blockRange: number) => new JsonRpcError(-32000, `Exceeded maximum block range: ${blockRange}`),
  TIMESTAMP_RANGE_TOO_LARGE: (fromBlock: string, fromTimestamp: number, toBlock: string, toTimestamp: number) =>
    new JsonRpcError(
      -32004,
      `The provided fromBlock and toBlock contain timestamps that exceed the maximum allowed duration of 7 days (604800 seconds): fromBlock: ${fromBlock} (${fromTimestamp}), toBlock: ${toBlock} (${toTimestamp})`,
    ),
  MISSING_FROM_BLOCK_PARAM: new JsonRpcError(-32011, 'Provided toBlock parameter without specifying fromBlock'),
  UNKNOWN_BLOCK: (msg?: string | null) => new JsonRpcError(-39012, msg || 'Unknown block'),
  INVALID_BLOCK_RANGE: new JsonRpcError(-39013, 'Invalid block range'),
  MAX_BLOCK_SIZE: (count: number) =>
    new JsonRpcError(-32000, `Exceeded max transactions that can be returned in a block: ${count}`),
  COULD_NOT_RETRIEVE_LATEST_BLOCK: new JsonRpcError(-32607, 'Error encountered retrieving latest block'),

  /***************************************************************************
   ***************************************************************************
   ***                     Rate limiting and resource errors                        ***
   ***************************************************************************
   ***************************************************************************/
  HBAR_RATE_LIMIT_EXCEEDED: new JsonRpcError(-32606, 'HBAR Rate limit exceeded'),
  HBAR_RATE_LIMIT_PREEMPTIVE_EXCEEDED: new JsonRpcError(
    -32606,
    'The HBAR rate limit was preemptively exceeded due to an excessively large callData size.',
  ),
  IP_RATE_LIMIT_EXCEEDED: (methodName: string) => new JsonRpcError(-32605, `IP Rate limit exceeded on ${methodName}`),
  REQUEST_TIMEOUT: new JsonRpcError(-32010, 'Request timeout. Please try again.'),
  RESOURCE_NOT_FOUND: (message = '') => new JsonRpcError(-32001, `Requested resource not found. ${message}`),
  UNKNOWN_HISTORICAL_BALANCE: new JsonRpcError(-32007, 'Historical balance data is available only after 15 minutes.'),
  UNSUPPORTED_HISTORICAL_EXECUTION: (blockId: string) =>
    new JsonRpcError(-32609, `Unsupported historical block identifier encountered: ${blockId}`),
  DEPENDENT_SERVICE_IMMATURE_RECORDS: new JsonRpcError(-32015, 'Dependent service returned immature records'),

  /***************************************************************************
   ***************************************************************************
   ***                     Batch request errors                        ***
   ***************************************************************************
   ***************************************************************************/
  BATCH_REQUESTS_DISABLED: new JsonRpcError(-32202, 'Batch requests are disabled'),
  BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED: (amount: number, max: number) =>
    new JsonRpcError(-32203, `Batch request amount ${amount} exceeds max ${max}`),
  BATCH_REQUESTS_METHOD_NOT_PERMITTED: (method: string) =>
    new JsonRpcError(-32007, `Method ${method} is not permitted as part of batch requests`),
  WS_BATCH_REQUESTS_DISABLED: new JsonRpcError(-32205, 'WS batch requests are disabled'),
  WS_BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED: (amount: number, max: number) =>
    new JsonRpcError(-32206, `Batch request amount ${amount} exceeds max ${max}`),

  /***************************************************************************
   ***************************************************************************
   ***                     Filter and subscription errors                        ***
   ***************************************************************************
   ***************************************************************************/
  FILTER_NOT_FOUND: new JsonRpcError(-32001, 'Filter not found'),
  MAX_SUBSCRIPTIONS: new JsonRpcError(-32608, 'Exceeded maximum allowed subscriptions'),
  NO_MINING_WORK: new JsonRpcError(-32000, 'No mining work available yet'),

  /***************************************************************************
   ***************************************************************************
   ***                     Pagination errors                        ***
   ***************************************************************************
   ***************************************************************************/
  PAGINATION_MAX: (count: number) =>
    new JsonRpcError(-32011, `Exceeded maximum mirror node pagination count: ${count}`),

  /***************************************************************************
   ***************************************************************************
   ***                     Miscellaneous errors                        ***
   ***************************************************************************
   ***************************************************************************/
  UNSUPPORTED_OPERATION: (message: string) => new JsonRpcError(-32610, `Unsupported operation. ${message}`),
  INVALID_ARGUMENTS: (message: string) => new JsonRpcError(-32000, `Invalid arguments: ${message}`),
};
