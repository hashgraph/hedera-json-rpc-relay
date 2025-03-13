// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';

import { JsonRpcError } from '../../../src/lib/jsonRpcResponse/jsonRpcError';
import { predefinedJsonRpcErrors } from '../../../src/lib/jsonRpcResponse/predefinedJsonRpcErrors';

describe('predefinedJsonRpcErrors', () => {
  // Helper function to verify error code and message
  function verifyError(error: JsonRpcError, expectedCode: number, expectedMessage: string, expectedData?: string) {
    expect(error.code).to.equal(expectedCode);
    expect(error.message).to.equal(expectedMessage);
    if (expectedData !== undefined) {
      expect(error.data).to.equal(expectedData);
    }
  }

  describe('Standard JSON-RPC errors', () => {
    it('should have PARSE_ERROR with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.PARSE_ERROR, -32700, 'Unable to parse JSON');
    });

    it('should have INVALID_REQUEST with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.INVALID_REQUEST, -32600, 'Invalid request');
    });

    it('should have UNSUPPORTED_METHOD with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.UNSUPPORTED_METHOD, -32601, 'Unsupported JSON-RPC method');
    });

    it('should have NOT_YET_IMPLEMENTED with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.NOT_YET_IMPLEMENTED, -32601, 'Not yet implemented');
    });

    it('should have INVALID_PARAMETERS with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.INVALID_PARAMETERS, -32602, 'Invalid params');
    });

    it('should generate INVALID_PARAMETER with the correct details', () => {
      const error = predefinedJsonRpcErrors.INVALID_PARAMETER('address', 'Invalid format');
      verifyError(error, -32602, 'Invalid parameter address: Invalid format');
    });

    it('should generate MISSING_REQUIRED_PARAMETER with the correct details', () => {
      const error = predefinedJsonRpcErrors.MISSING_REQUIRED_PARAMETER('address');
      verifyError(error, -32602, 'Missing value for required parameter address');
    });

    it('should generate INTERNAL_ERROR with default message when no message provided', () => {
      const error = predefinedJsonRpcErrors.INTERNAL_ERROR();
      verifyError(error, -32603, 'Unknown error invoking RPC');
    });

    it('should generate INTERNAL_ERROR with custom message when provided', () => {
      const error = predefinedJsonRpcErrors.INTERNAL_ERROR('Database connection failed');
      verifyError(error, -32603, 'Error invoking RPC: Database connection failed');
    });
  });

  describe('Contract errors', () => {
    it('should generate CONTRACT_REVERT with decoded error message', () => {
      const error = predefinedJsonRpcErrors.CONTRACT_REVERT('Error: Not enough tokens');
      verifyError(error, 3, 'execution reverted: Error: Not enough tokens');
    });

    it('should generate CONTRACT_REVERT with decoded data when no error message', () => {
      const error = predefinedJsonRpcErrors.CONTRACT_REVERT(undefined, 'Error: Not enough tokens');
      verifyError(error, 3, 'execution reverted: Error: Not enough tokens', 'Error: Not enough tokens');
    });

    it('should generate CONTRACT_REVERT with generic message when no data or error message', () => {
      const error = predefinedJsonRpcErrors.CONTRACT_REVERT();
      verifyError(error, 3, 'execution reverted', '');
    });

    it('should generate INVALID_CONTRACT_ADDRESS with address details', () => {
      const address = '0x123';
      const error = predefinedJsonRpcErrors.INVALID_CONTRACT_ADDRESS(address);
      expect(error.code).to.equal(-32012);
      expect(error.message).to.contain('Invalid Contract Address: 0x123');
      expect(error.message).to.contain('Expected length of 42 chars but was 5');
    });

    it('should generate INVALID_CONTRACT_ADDRESS with generic message for empty address', () => {
      const error = predefinedJsonRpcErrors.INVALID_CONTRACT_ADDRESS('');
      verifyError(error, -32012, 'Invalid Contract Address: .');
    });

    it('should generate NON_EXISTING_CONTRACT with address details', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const error = predefinedJsonRpcErrors.NON_EXISTING_CONTRACT(address);
      verifyError(
        error,
        -32013,
        'Non Existing Contract Address: 0x1234567890123456789012345678901234567890. Expected a Contract or Token Address.',
      );
    });

    it('should generate NON_EXISTING_ACCOUNT with address details', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const error = predefinedJsonRpcErrors.NON_EXISTING_ACCOUNT(address);
      verifyError(
        error,
        -32014,
        'Non Existing Account Address: 0x1234567890123456789012345678901234567890. Expected an Account Address.',
      );
    });
  });

  describe('Gas related errors', () => {
    it('should generate GAS_LIMIT_TOO_HIGH with correct details', () => {
      const error = predefinedJsonRpcErrors.GAS_LIMIT_TOO_HIGH(10000, 5000);
      verifyError(error, -32005, "Transaction gas limit '10000' exceeds max gas per sec limit '5000'");
    });

    it('should generate GAS_LIMIT_TOO_LOW with correct details', () => {
      const error = predefinedJsonRpcErrors.GAS_LIMIT_TOO_LOW(1000, 2000);
      verifyError(
        error,
        -32003,
        "Transaction gas limit provided '1000' is insufficient of intrinsic gas required '2000'",
      );
    });

    it('should generate GAS_PRICE_TOO_LOW with correct details', () => {
      const error = predefinedJsonRpcErrors.GAS_PRICE_TOO_LOW(10, 100);
      verifyError(error, -32009, "Gas price '10' is below configured minimum gas price '100'");
    });

    it('should have COULD_NOT_ESTIMATE_GAS_PRICE with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.COULD_NOT_ESTIMATE_GAS_PRICE,
        -32604,
        'Error encountered estimating the gas price',
      );
    });
  });

  describe('Transaction errors', () => {
    it('should generate NONCE_TOO_LOW with relevant details', () => {
      const error = predefinedJsonRpcErrors.NONCE_TOO_LOW(5, 10);
      verifyError(error, 32001, 'Nonce too low. Provided nonce: 5, current nonce: 10');
    });

    it('should generate NONCE_TOO_HIGH with relevant details', () => {
      const error = predefinedJsonRpcErrors.NONCE_TOO_HIGH(15, 10);
      verifyError(error, 32002, 'Nonce too high. Provided nonce: 15, current nonce: 10');
    });

    it('should have INSUFFICIENT_ACCOUNT_BALANCE with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.INSUFFICIENT_ACCOUNT_BALANCE, -32000, 'Insufficient funds for transfer');
    });

    it('should have VALUE_TOO_LOW with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.VALUE_TOO_LOW,
        -32602,
        "Value can't be non-zero and less than 10_000_000_000 wei which is 1 tinybar",
      );
    });

    it('should generate TRANSACTION_SIZE_TOO_BIG with correct details', () => {
      const error = predefinedJsonRpcErrors.TRANSACTION_SIZE_TOO_BIG('128KB', '64KB');
      verifyError(error, -32201, 'Oversized data: transaction size 128KB, transaction limit 64KB');
    });

    it('should have UNSUPPORTED_TRANSACTION_TYPE with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.UNSUPPORTED_TRANSACTION_TYPE, -32611, 'Unsupported transaction type');
    });

    it('should generate UNSUPPORTED_CHAIN_ID with correct details', () => {
      const error = predefinedJsonRpcErrors.UNSUPPORTED_CHAIN_ID(1, 295);
      verifyError(error, -32000, 'ChainId (1) not supported. The correct chainId is 295');
    });

    it('should have RECEIVER_SIGNATURE_ENABLED with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.RECEIVER_SIGNATURE_ENABLED,
        -32000,
        "Operation is not supported when receiver's signature is enabled.",
      );
    });
  });

  describe('Block related errors', () => {
    it('should generate REQUEST_BEYOND_HEAD_BLOCK with correct details', () => {
      const error = predefinedJsonRpcErrors.REQUEST_BEYOND_HEAD_BLOCK(1000, 900);
      verifyError(error, -32000, 'Request beyond head block: requested 1000, head 900');
    });

    it('should generate RANGE_TOO_LARGE with correct details', () => {
      const error = predefinedJsonRpcErrors.RANGE_TOO_LARGE(1000);
      verifyError(error, -32000, 'Exceeded maximum block range: 1000');
    });

    it('should generate TIMESTAMP_RANGE_TOO_LARGE with correct details', () => {
      const error = predefinedJsonRpcErrors.TIMESTAMP_RANGE_TOO_LARGE('100', 1000000, '200', 2000000);
      verifyError(
        error,
        -32004,
        'The provided fromBlock and toBlock contain timestamps that exceed the maximum allowed duration of 7 days (604800 seconds): fromBlock: 100 (1000000), toBlock: 200 (2000000)',
      );
    });

    it('should have MISSING_FROM_BLOCK_PARAM with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.MISSING_FROM_BLOCK_PARAM,
        -32011,
        'Provided toBlock parameter without specifying fromBlock',
      );
    });

    it('should generate UNKNOWN_BLOCK with default message', () => {
      const error = predefinedJsonRpcErrors.UNKNOWN_BLOCK();
      verifyError(error, -39012, 'Unknown block');
    });

    it('should generate UNKNOWN_BLOCK with custom message', () => {
      const error = predefinedJsonRpcErrors.UNKNOWN_BLOCK('Block 123 not found');
      verifyError(error, -39012, 'Block 123 not found');
    });

    it('should have INVALID_BLOCK_RANGE with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.INVALID_BLOCK_RANGE, -39013, 'Invalid block range');
    });

    it('should generate MAX_BLOCK_SIZE with correct details', () => {
      const error = predefinedJsonRpcErrors.MAX_BLOCK_SIZE(1000);
      verifyError(error, -32000, 'Exceeded max transactions that can be returned in a block: 1000');
    });

    it('should have COULD_NOT_RETRIEVE_LATEST_BLOCK with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.COULD_NOT_RETRIEVE_LATEST_BLOCK,
        -32607,
        'Error encountered retrieving latest block',
      );
    });
  });

  describe('Rate limiting and resource errors', () => {
    it('should have HBAR_RATE_LIMIT_EXCEEDED with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.HBAR_RATE_LIMIT_EXCEEDED, -32606, 'HBAR Rate limit exceeded');
    });

    it('should have HBAR_RATE_LIMIT_PREEMPTIVE_EXCEEDED with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.HBAR_RATE_LIMIT_PREEMPTIVE_EXCEEDED,
        -32606,
        'The HBAR rate limit was preemptively exceeded due to an excessively large callData size.',
      );
    });

    it('should generate IP_RATE_LIMIT_EXCEEDED with method name', () => {
      const error = predefinedJsonRpcErrors.IP_RATE_LIMIT_EXCEEDED('eth_call');
      verifyError(error, -32605, 'IP Rate limit exceeded on eth_call');
    });

    it('should have REQUEST_TIMEOUT with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.REQUEST_TIMEOUT, -32010, 'Request timeout. Please try again.');
    });

    it('should generate RESOURCE_NOT_FOUND with default message', () => {
      const error = predefinedJsonRpcErrors.RESOURCE_NOT_FOUND();
      verifyError(error, -32001, 'Requested resource not found. ');
    });

    it('should generate RESOURCE_NOT_FOUND with custom message', () => {
      const error = predefinedJsonRpcErrors.RESOURCE_NOT_FOUND('Token not found');
      verifyError(error, -32001, 'Requested resource not found. Token not found');
    });

    it('should have UNKNOWN_HISTORICAL_BALANCE with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.UNKNOWN_HISTORICAL_BALANCE,
        -32007,
        'Historical balance data is available only after 15 minutes.',
      );
    });

    it('should generate UNSUPPORTED_HISTORICAL_EXECUTION with block ID', () => {
      const error = predefinedJsonRpcErrors.UNSUPPORTED_HISTORICAL_EXECUTION('0x123');
      verifyError(error, -32609, 'Unsupported historical block identifier encountered: 0x123');
    });

    it('should have DEPENDENT_SERVICE_IMMATURE_RECORDS with correct code and message', () => {
      verifyError(
        predefinedJsonRpcErrors.DEPENDENT_SERVICE_IMMATURE_RECORDS,
        -32015,
        'Dependent service returned immature records',
      );
    });
  });

  describe('Batch request errors', () => {
    it('should have BATCH_REQUESTS_DISABLED with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.BATCH_REQUESTS_DISABLED, -32202, 'Batch requests are disabled');
    });

    it('should generate BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED with correct details', () => {
      const error = predefinedJsonRpcErrors.BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED(50, 20);
      verifyError(error, -32203, 'Batch request amount 50 exceeds max 20');
    });

    it('should generate BATCH_REQUESTS_METHOD_NOT_PERMITTED with method name', () => {
      const error = predefinedJsonRpcErrors.BATCH_REQUESTS_METHOD_NOT_PERMITTED('eth_subscribe');
      verifyError(error, -32007, 'Method eth_subscribe is not permitted as part of batch requests');
    });

    it('should have WS_BATCH_REQUESTS_DISABLED with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.WS_BATCH_REQUESTS_DISABLED, -32205, 'WS batch requests are disabled');
    });

    it('should generate WS_BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED with correct details', () => {
      const error = predefinedJsonRpcErrors.WS_BATCH_REQUESTS_AMOUNT_MAX_EXCEEDED(30, 10);
      verifyError(error, -32206, 'Batch request amount 30 exceeds max 10');
    });
  });

  describe('Filter and subscription errors', () => {
    it('should have FILTER_NOT_FOUND with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.FILTER_NOT_FOUND, -32001, 'Filter not found');
    });

    it('should have MAX_SUBSCRIPTIONS with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.MAX_SUBSCRIPTIONS, -32608, 'Exceeded maximum allowed subscriptions');
    });

    it('should have NO_MINING_WORK with correct code and message', () => {
      verifyError(predefinedJsonRpcErrors.NO_MINING_WORK, -32000, 'No mining work available yet');
    });
  });

  describe('Pagination errors', () => {
    it('should generate PAGINATION_MAX with correct details', () => {
      const error = predefinedJsonRpcErrors.PAGINATION_MAX(1000);
      verifyError(error, -32011, 'Exceeded maximum mirror node pagination count: 1000');
    });
  });

  describe('Miscellaneous errors', () => {
    it('should generate UNSUPPORTED_OPERATION with custom message', () => {
      const error = predefinedJsonRpcErrors.UNSUPPORTED_OPERATION('Operation not allowed in read-only mode');
      verifyError(error, -32610, 'Unsupported operation. Operation not allowed in read-only mode');
    });

    it('should generate INVALID_ARGUMENTS with custom message', () => {
      const error = predefinedJsonRpcErrors.INVALID_ARGUMENTS('Expected string, got number');
      verifyError(error, -32000, 'Invalid arguments: Expected string, got number');
    });
  });
});
