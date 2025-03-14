// SPDX-License-Identifier: Apache-2.0

import { JsonRpcMethods } from '../constants/';
import { EthImpl } from '../eth';
import { JsonRpcResponse, predefinedJsonRpcErrors } from '../jsonRpcResponse';
import { NetImpl } from '../net';
import { RequestDetails } from '../types';
import { Web3Impl } from '../web3';
import { IRequestDispatcher } from './interfaces/requestDispatcher.interface';

/**
 * Implements the request dispatcher interface to handle JSON-RPC requests.
 * This class is responsible for routing incoming requests to the appropriate service
 * implementation, handling errors, and formatting responses according to the JSON-RPC 2.0 specification.
 */
export class RelayRequestDispatcher implements IRequestDispatcher {
  /**
   * Creates a new instance of the RelayRequestDispatcher.
   *
   * @param validationService - Service responsible for validating incoming JSON-RPC requests
   * @param errorHandlingService - Service responsible for standardizing error responses
   * @param ethService - Implementation of Ethereum JSON-RPC methods
   * @param web3Service - Implementation of Web3 JSON-RPC methods
   * @param netService - Implementation of Net JSON-RPC methods
   */
  constructor(
    // @fixme: fixed types
    private readonly validationService: any,
    private readonly errorHandlingService: any,
    private readonly ethService: EthImpl,
    private readonly web3Service: Web3Impl,
    private readonly netService: NetImpl,
  ) {}

  /**
   * Dispatches an incoming JSON-RPC request to the appropriate service implementation.
   * Handles validation, routing, and error processing.
   *
   * @param method - The JSON-RPC method name (e.g., "eth_blockNumber")
   * @param params - Array of parameters for the method
   * @param requestDetails - Additional context about the request including the request ID
   * @returns A Promise resolving to a properly formatted JSON-RPC response
   */
  public async dispatchRequest(
    method: string,
    params: any[],
    requestDetails: RequestDetails,
  ): Promise<JsonRpcResponse> {
    try {
      // Validate the request
      this.validationService.validateRequest(method, params);

      // Dispatch to the appropriate service
      const result = await this.routeRequestToService(method, params, requestDetails);

      // Return successful response
      return JsonRpcResponse.success(requestDetails.jsonRpcRequestId!, result);
    } catch (error) {
      // Process all errors through centralized handler
      const jsonRpcError = this.errorHandlingService.handleError(error, method, requestDetails);

      // Return error response
      return JsonRpcResponse.error(requestDetails.jsonRpcRequestId!, jsonRpcError);
    }
  }

  /**
   * Routes a request to the appropriate service based on method name convention.
   * Parses the method name to determine which service should handle the request.
   *
   * @param method - The JSON-RPC method name (e.g., "eth_blockNumber")
   * @param params - Array of parameters for the method
   * @param requestDetails - Additional context about the request
   * @returns A Promise resolving to the result of the method call
   * @throws {JsonRpcError} If the method or service is not supported
   */
  private async routeRequestToService(
    method: string,
    params: any[] | null,
    requestDetails: RequestDetails,
  ): Promise<any> {
    // Normalize params to be an array (handle null/undefined case)
    const normalizedParams = Array.isArray(params) ? params : [];

    // Split the method name to get service and method parts (e.g., "eth_blockNumber" -> ["eth", "blockNumber"])
    const [serviceName, methodName] = method.split('_');

    // Get the appropriate service based on the service name
    const service = this.getServiceByName(serviceName);
    if (!service) {
      throw predefinedJsonRpcErrors.UNSUPPORTED_METHOD;
    }

    // Handle special cases (like filter service methods)
    if (method === JsonRpcMethods.ETH_NEW_FILTER) {
      return await this.ethService.filterService()[methodName](...normalizedParams, requestDetails);
    }

    // Check if the method exists on the service
    if (typeof service[methodName] !== 'function') {
      throw predefinedJsonRpcErrors.UNSUPPORTED_METHOD;
    }

    // Add request context to parameters and invoke the method
    return service[methodName](...normalizedParams, requestDetails);
  }

  /**
   * Gets the appropriate service instance based on service name.
   *
   * @param serviceName - The name of the service (e.g., "eth", "web3", "net")
   * @returns The service implementation or null if not found
   */
  private getServiceByName(serviceName: string): EthImpl | Web3Impl | NetImpl | null {
    switch (serviceName.toLowerCase()) {
      case 'eth':
        return this.ethService;
      case 'web3':
        return this.web3Service;
      case 'net':
        return this.netService;
      default:
        return null;
    }
  }
}
