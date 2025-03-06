// SPDX-License-Identifier: Apache-2.0

import { Status } from '@hashgraph/sdk';
import { Logger } from 'pino';

import { JsonRpcError, predefined } from './JsonRpcError';

export class MirrorNodeClientError extends Error {
  public statusCode: number;
  public data?: string;
  public detail?: string;
  public mappedJsonRpcError?: JsonRpcError;

  static ErrorCodes = {
    ECONNABORTED: 504,
    CONTRACT_REVERT_EXECUTED: 400,
    NOT_SUPPORTED: 501,
  };

  static statusCodes = {
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    NO_CONTENT: 204,
  };

  static messages = {
    INVALID_HEX: 'data field invalid hexadecimal string',
    CONTRACT_REVERT_EXECUTED: Status.ContractRevertExecuted.toString(),
  };

  constructor(error: any, statusCode: number, jsonRpcError?: JsonRpcError) {
    // mirror node web3 module sends errors in this format, this is why we need a check to distinguish
    if (error.response?.data?._status?.messages?.length) {
      const msg = error.response.data._status.messages[0];
      const { message, detail, data } = msg;
      super(message);

      this.detail = detail;
      this.data = data;
      this.mappedJsonRpcError = jsonRpcError;
    } else {
      super(error.message);
    }

    this.statusCode = statusCode;
    Object.setPrototypeOf(this, MirrorNodeClientError.prototype);
  }

  public isTimeout(): boolean {
    return this.statusCode === MirrorNodeClientError.ErrorCodes.ECONNABORTED;
  }

  public isContractReverted(): boolean {
    return this.statusCode === MirrorNodeClientError.ErrorCodes.CONTRACT_REVERT_EXECUTED;
  }

  public isContractRevertOpcodeExecuted() {
    return this.message === MirrorNodeClientError.messages.CONTRACT_REVERT_EXECUTED;
  }

  public isNotFound(): boolean {
    return this.statusCode === MirrorNodeClientError.statusCodes.NOT_FOUND;
  }

  public isNotSupported(): boolean {
    return this.statusCode === MirrorNodeClientError.ErrorCodes.NOT_SUPPORTED;
  }

  public isEmpty(): boolean {
    return this.statusCode === MirrorNodeClientError.statusCodes.NO_CONTENT;
  }

  public isRateLimit(): boolean {
    return this.statusCode === MirrorNodeClientError.statusCodes.TOO_MANY_REQUESTS;
  }

  public isNotSupportedSystemContractOperaton(): boolean {
    return this.message === 'Precompile not supported';
  }

  isFailInvalid() {
    return this.message === 'FAIL_INVALID';
  }

  isInvalidTransaction() {
    return this.message === 'INVALID_TRANSACTION';
  }

  // get the mapped JsonRpcError
  public getMappedJsonRpcError(): JsonRpcError | undefined {
    return this.mappedJsonRpcError;
  }
}

/**
 * Maps Mirror Node HTTP errors to appropriate JsonRpcError types.
 * Centralizes error handling logic for consistent error responses.
 */
export class MirrorNodeErrorMapper {
  private static readonly REQUESTID_LABEL = 'requestId';

  // Map HTTP status codes to JsonRpcError factory functions
  // No 404 and 501 because:
  //   - 404 - NOT FOUND: are mostly accepted error and handled gracefully
  //   - 501 - NOT IMPLEMENTED: are handled by MirrorNodeClientError.isNotSupported()
  private static errorMap = {
    400: (error: any, logger: Logger) => this.handleBadRequest(error, logger),
    429: () => predefined.MIRROR_NODE_UPSTREAM_FAIL(429, 'Rate limit exceeded'),
    500: () => predefined.MIRROR_NODE_UPSTREAM_FAIL(500, 'Internal server error'),
    502: () => predefined.MIRROR_NODE_UPSTREAM_FAIL(502, 'Bad gateway'),
    503: () => predefined.MIRROR_NODE_UPSTREAM_FAIL(503, 'Service unavailable'),
    504: () => predefined.MIRROR_NODE_UPSTREAM_FAIL(504, 'Gateway timeout'),
  };

  // Special handling for 400 errors which could be contract reverts or other issues
  private static handleBadRequest(error: any, logger: Logger): JsonRpcError {
    // Handle contract reverts differently
    if (
      error.response?.data?._status?.messages?.some((m: any) =>
        m.message.includes(MirrorNodeClientError.messages.CONTRACT_REVERT_EXECUTED),
      )
    ) {
      const config = error.config || {};
      const requestId = config.headers?.[MirrorNodeErrorMapper.REQUESTID_LABEL] || '';
      const msg = error.response.data._status.messages[0];
      const { message, detail, data } = msg;

      // Contract Call returns 400 for a CONTRACT_REVERT but is a valid response, expected and should not be logged as error:
      if (logger.isLevelEnabled('debug')) {
        logger.debug(
          `${requestId} [${config.method}] ${config.url} Contract Revert: ( statusCode: ${error.response
            ?.status}, statusText: '${error.response?.statusText || ''}', detail: '${JSON.stringify(
            error.response?.detail || '',
          )}', data: '${JSON.stringify(error.response?.data || '')}')`,
        );
      }
      return predefined.CONTRACT_REVERT(detail || message, data);
    }
    // Handle other 400 errors
    return predefined.MIRROR_NODE_UPSTREAM_FAIL(400, 'Bad request');
  }

  /**
   * Maps HTTP errors to JsonRpcErrors
   * @param error The HTTP error from Axios
   * @param pathLabel The endpoint path label for context
   * @param acceptedErrorStatuses List of status codes that are considered "accepted" errors
   * @param logger The logger instance
   * @returns JsonRpcError or null for accepted errors
   */
  public static mapError(
    error: any,
    effectiveStatusCode: any,
    pathLabel: string,
    acceptedErrorStatuses: number[] | undefined,
    logger: Logger,
  ): JsonRpcError | null {
    const config = error.config || {};
    const requestId = config.headers?.[MirrorNodeErrorMapper.REQUESTID_LABEL] || '';

    // Check if this is an accepted error for this path
    if (acceptedErrorStatuses?.includes(effectiveStatusCode)) {
      if (logger.isLevelEnabled('debug')) {
        logger.debug(
          `${requestId} An accepted error occurred while communicating with the mirror node server: method=${config.method}, path=${pathLabel}, status=${effectiveStatusCode}`,
        );
      }
      return null; // Return null for accepted errors
    }

    logger.error(
      new Error(error.message),
      `${requestId} Error encountered while communicating with the mirror node server: method=${
        config.method || ''
      }, path=${pathLabel || ''}, status=${effectiveStatusCode}`,
    );

    // Find the appropriate error mapper
    const errorMapper =
      this.errorMap[effectiveStatusCode] ||
      (() => predefined.MIRROR_NODE_UPSTREAM_FAIL(effectiveStatusCode, error.message));

    return errorMapper(error, logger);
  }
}
