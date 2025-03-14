// SPDX-License-Identifier: Apache-2.0

// SPDX-License-Identifier: Apache-2.0

import { expect } from 'chai';
import sinon from 'sinon';

import { JsonRpcMethods } from '../../../src/lib/constants/';
import { RelayRequestDispatcher } from '../../../src/lib/dispatcher';
import { JsonRpcError, JsonRpcResponse, predefinedJsonRpcErrors } from '../../../src/lib/jsonRpcResponse';
import { RequestDetails } from '../../../src/lib/types';

describe('RelayRequestDispatcher', () => {
  // Stubs for dependencies
  let validationServiceStub;
  let errorHandlingServiceStub;
  let filterServiceStub;
  let ethServiceStub;
  let web3ServiceStub;
  let netServiceStub;
  let dispatcher: RelayRequestDispatcher;
  let requestDetails: RequestDetails;

  beforeEach(() => {
    // Create stubs for all dependencies
    validationServiceStub = {
      validateRequest: sinon.stub(),
    };

    errorHandlingServiceStub = {
      handleError: sinon.stub().returns(new JsonRpcError(-32603, 'Internal error')),
    };

    filterServiceStub = {
      newFilter: sinon.stub(),
    };

    ethServiceStub = {
      blockNumber: sinon.stub(),
      getBalance: sinon.stub(),
      filterService: sinon.stub().returns(filterServiceStub),
    };

    web3ServiceStub = {
      clientVersion: sinon.stub(),
      sha3: sinon.stub(),
    };

    netServiceStub = {
      listening: sinon.stub(),
      version: sinon.stub(),
    };

    // Create a new dispatcher instance with stubbed dependencies
    dispatcher = new RelayRequestDispatcher(
      validationServiceStub,
      errorHandlingServiceStub,
      ethServiceStub as any,
      web3ServiceStub as any,
      netServiceStub as any,
    );

    // Create request details
    requestDetails = new RequestDetails({
      requestId: 'test-request-id',
      ipAddress: '127.0.0.1',
      connectionId: 'test-connection-id',
    });

    // Add jsonRpcRequestId to the requestDetails
    requestDetails.jsonRpcRequestId = 'test-json-rpc-id';
  });

  afterEach(() => {
    // Restore all stubs after each test
    sinon.restore();
  });

  describe('dispatchRequest', () => {
    it('should successfully dispatch a request to eth service', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_BLOCK_NUMBER;
      const params: any[] = [];
      ethServiceStub.blockNumber.resolves('0x1234');

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(ethServiceStub.blockNumber.calledWith(requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect((result as any).result).to.equal('0x1234');
      expect(result).to.have.property('result');
    });

    it('should successfully dispatch a request to web3 service', async () => {
      // Setup
      const method = JsonRpcMethods.WEB3_CLIENT_VERSION;
      const params: any[] = [];
      web3ServiceStub.clientVersion.resolves('relay/1.0.0');

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(web3ServiceStub.clientVersion.calledWith(requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect((result as any).result).to.equal('relay/1.0.0');
      expect(result).to.have.property('result');
    });

    it('should successfully dispatch a request to net service', async () => {
      // Setup
      const method = JsonRpcMethods.NET_VERSION;
      const params: any[] = [];
      netServiceStub.version.resolves('1');

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(netServiceStub.version.calledWith(requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect((result as any).result).to.equal('1');
      expect(result).to.have.property('result');
    });

    it('should handle validation errors', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_BLOCK_NUMBER;
      const params: any[] = [];
      const validationError = new JsonRpcError(-32602, 'Invalid parameters'); // Using actual JsonRpcError

      // Make validation throw the error
      validationServiceStub.validateRequest.throws(validationError);

      // Make error handler return the same error
      errorHandlingServiceStub.handleError.returns(validationError);

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(errorHandlingServiceStub.handleError.calledWith(validationError, method, requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect(result).to.have.property('error');
      expect((result as any).error).to.equal(validationError);
    });

    it('should handle service method errors', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_GET_BALANCE;
      const params = ['0x1234', 'latest'];
      const serviceError = new Error('Account not found');

      // Make getBalance reject with an error
      ethServiceStub.getBalance.rejects(serviceError);

      // Create a proper JsonRpcError for the error handler to return
      const returnedError = new JsonRpcError(-32603, 'Error invoking RPC: Account not found');
      errorHandlingServiceStub.handleError.returns(returnedError);

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(ethServiceStub.getBalance.calledWith('0x1234', 'latest', requestDetails)).to.be.true;
      expect(errorHandlingServiceStub.handleError.calledWith(serviceError, method, requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect(result).to.have.property('error');
      expect((result as any).error).to.equal(returnedError);
    });

    it('should handle unknown service error', async () => {
      // Setup
      const method = 'unknown_method';
      const params: any[] = [];

      // Create a proper JsonRpcError for unknown method
      const unsupportedError = new JsonRpcError(-32601, 'Method not found');

      // Make error handler return the proper JSON-RPC error
      errorHandlingServiceStub.handleError.returns(unsupportedError);

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(errorHandlingServiceStub.handleError.called).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect(result).to.not.have.property('result');
      expect((result as any).error).to.equal(unsupportedError);
    });

    it('should handle filter service method', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_NEW_FILTER;
      const params = [{ fromBlock: 'latest', toBlock: 'latest' }];

      // Make filterService.newFilter return a value
      filterServiceStub.newFilter.resolves('0x1');

      // Execute
      const result = await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(validationServiceStub.validateRequest.calledWith(method, params)).to.be.true;
      expect(ethServiceStub.filterService.called).to.be.true;
      expect(filterServiceStub.newFilter.calledWith(params[0], requestDetails)).to.be.true;
      expect(result).to.be.instanceOf(JsonRpcResponse);
      expect(result.id).to.equal(requestDetails.jsonRpcRequestId);
      expect((result as any).result).to.equal('0x1');
      expect(result).to.not.have.property('error');
    });
  });

  describe('getServiceByName', () => {
    it('should return ethService for "eth"', () => {
      // Get a reference to the private method
      const getServiceByName = (dispatcher as any).getServiceByName.bind(dispatcher);

      expect(getServiceByName('eth')).to.equal(ethServiceStub);
    });

    it('should return web3Service for "web3"', () => {
      // Get a reference to the private method
      const getServiceByName = (dispatcher as any).getServiceByName.bind(dispatcher);

      expect(getServiceByName('web3')).to.equal(web3ServiceStub);
    });

    it('should return netService for "net"', () => {
      // Get a reference to the private method
      const getServiceByName = (dispatcher as any).getServiceByName.bind(dispatcher);

      expect(getServiceByName('net')).to.equal(netServiceStub);
    });

    it('should return null for unknown service', () => {
      // Get a reference to the private method
      const getServiceByName = (dispatcher as any).getServiceByName.bind(dispatcher);

      expect(getServiceByName('unknown')).to.be.null;
    });
  });

  describe('routeRequestToService', () => {
    it('should throw error for unknown service', async () => {
      // Get a reference to the private method
      const routeRequestToService = (dispatcher as any).routeRequestToService.bind(dispatcher);

      // Execute and expect error
      try {
        await routeRequestToService('unknown_method', [], requestDetails);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.deep.equal(predefinedJsonRpcErrors.UNSUPPORTED_METHOD);
      }
    });

    it('should throw error for unknown method on valid service', async () => {
      // Get a reference to the private method
      const routeRequestToService = (dispatcher as any).routeRequestToService.bind(dispatcher);

      // Execute and expect error
      try {
        await routeRequestToService('eth_unknownMethod', [], requestDetails);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.deep.equal(predefinedJsonRpcErrors.UNSUPPORTED_METHOD);
      }
    });
  });

  // Additional edge cases and special scenarios
  describe('edge cases', () => {
    it('should properly pass parameters to service methods', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_GET_BALANCE;
      const params = ['0xaddress', 'latest'];
      ethServiceStub.getBalance.resolves('0x100');

      // Execute
      await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify parameters are passed correctly
      expect(ethServiceStub.getBalance.calledWith('0xaddress', 'latest', requestDetails)).to.be.true;
    });

    it('should handle empty params array', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_BLOCK_NUMBER;
      const params: any[] = [];
      ethServiceStub.blockNumber.resolves('0x1234');

      // Execute
      await dispatcher.dispatchRequest(method, params, requestDetails);

      // Verify
      expect(ethServiceStub.blockNumber.calledWith(requestDetails)).to.be.true;
    });

    it('should handle null params', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_BLOCK_NUMBER;
      const params = null;
      ethServiceStub.blockNumber.resolves('0x1234');

      // Execute - should treat null params as empty array
      await dispatcher.dispatchRequest(method, params as any, requestDetails);

      // Verify
      expect(ethServiceStub.blockNumber.calledWith(requestDetails)).to.be.true;
    });

    it('should handle undefined params', async () => {
      // Setup
      const method = JsonRpcMethods.ETH_BLOCK_NUMBER;
      const params = undefined;
      ethServiceStub.blockNumber.resolves('0x1234');

      // Execute - should treat undefined params as empty array
      await dispatcher.dispatchRequest(method, params as any, requestDetails);

      // Verify
      expect(ethServiceStub.blockNumber.calledWith(requestDetails)).to.be.true;
    });
  });
});
