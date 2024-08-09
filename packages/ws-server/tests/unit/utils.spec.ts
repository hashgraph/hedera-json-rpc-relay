/*-
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

import { expect } from 'chai';
import sinon from 'sinon';
import {
  constructValidLogSubscriptionFilter,
  getBatchRequestsMaxSize,
  getMultipleAddressesEnabled,
  getWsBatchRequestsEnabled,
  handleConnectionClose,
  resolveParams,
  sendToClient,
} from '../../src/utils/utils';
import { WS_CONSTANTS } from '../../src/utils/constants';
import { Relay } from '@hashgraph/json-rpc-relay/src';
import ConnectionLimiter from '../../src/metrics/connectionLimiter';
import WsMetricRegistry from '../../src/metrics/wsMetricRegistry';

describe('Utilities unit tests', async function () {
  describe('constructValidLogSubscriptionFilter tests', () => {
    it('Should ignore all the unexpected params and return a new filter object with valid params (address, topics)', () => {
      const originalFilter = {
        address: '0x23f5e49569A835d7bf9AefD30e4f60CdD570f225',
        topics: ['0x1d29d0f04057864b829c60f025fdba344f1623eb30b90820f5a6c39ffbd1c512'],
        fromBlock: '0x0',
        toBlock: 'latest',
        hedera: '0xhbar',
      };
      const originalFilterKeys = Object.keys(originalFilter);

      const validFilter = constructValidLogSubscriptionFilter(originalFilter);
      const validFilterKeys = Object.keys(validFilter);

      expect(validFilterKeys).to.not.deep.eq(originalFilterKeys);
      expect(validFilterKeys.length).to.eq(2); // address & topics
      expect(validFilter['address']).to.eq(originalFilter.address);
      expect(validFilter['topics']).to.eq(originalFilter.topics);
      expect(validFilter['fromBlock']).to.not.exist;
      expect(validFilter['toBlock']).to.not.exist;
      expect(validFilter['hedera']).to.not.exist;
    });

    it('Should only add valid params if presented in original filter object', () => {
      // original missing `address` param
      const originalFilter1 = {
        topics: ['0x1d29d0f04057864b829c60f025fdba344f1623eb30b90820f5a6c39ffbd1c512'],
      };
      const validFilter1 = constructValidLogSubscriptionFilter(originalFilter1);
      const validFilter1Keys = Object.keys(validFilter1);
      expect(validFilter1Keys.length).to.eq(1);
      expect(validFilter1['address']).to.not.exist;
      expect(validFilter1['topics']).to.eq(originalFilter1.topics);

      // original missing `topics` param
      const originalFilter2 = {
        address: '0x23f5e49569A835d7bf9AefD30e4f60CdD570f225',
      };
      const validFilter2 = constructValidLogSubscriptionFilter(originalFilter2);
      const validFilter2Keys = Object.keys(validFilter2);
      expect(validFilter2Keys.length).to.eq(1);
      expect(validFilter2['topics']).to.not.exist;
      expect(validFilter2['address']).to.eq(originalFilter2.address);
    });
  });

  describe('sendToClient', () => {
    let connectionMock: any;
    let loggerMock: any;
    let request: any;
    let response: any;
    const requestIdPrefix = 'req-123';
    const connectionIdPrefix = 'conn-456';

    beforeEach(() => {
      connectionMock = {
        send: sinon.stub(),
        limiter: {
          resetInactivityTTLTimer: sinon.stub(),
        },
      };

      loggerMock = {
        trace: sinon.stub(),
      };

      request = { id: '1', method: 'testMethod' };
      response = { result: 'testResult' };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should log the response being sent to the client', () => {
      sendToClient(connectionMock, request, response, loggerMock, requestIdPrefix, connectionIdPrefix);

      const expectedLogMessage = `${connectionIdPrefix} ${requestIdPrefix}: Sending result=${JSON.stringify(
        response,
      )} to client for request=${JSON.stringify(request)}`;

      expect(loggerMock.trace.calledOnce).to.be.true;
      expect(loggerMock.trace.calledWith(expectedLogMessage)).to.be.true;
    });

    it('should send the response to the client connection', () => {
      sendToClient(connectionMock, request, response, loggerMock, requestIdPrefix, connectionIdPrefix);

      expect(connectionMock.send.calledOnce).to.be.true;
      expect(connectionMock.send.calledWith(JSON.stringify(response))).to.be.true;
    });

    it('should reset the inactivity TTL timer for the client connection', () => {
      sendToClient(connectionMock, request, response, loggerMock, requestIdPrefix, connectionIdPrefix);

      expect(connectionMock.limiter.resetInactivityTTLTimer.calledOnce).to.be.true;
      expect(connectionMock.limiter.resetInactivityTTLTimer.calledWith(connectionMock)).to.be.true;
    });
  });

  describe('resolveParams', () => {
    const mockParams = [
      {
        blockHash: '0x1234',
        fromBlock: '0x1',
        toBlock: '0x2',
        address: '0xAddress',
        topics: ['0xTopic1', '0xTopic2'],
      },
    ];

    it('should resolve parameters for ETH_GETLOGS method', () => {
      const method = WS_CONSTANTS.METHODS.ETH_GETLOGS;
      const resolvedParams = resolveParams(method, mockParams);

      expect(resolvedParams).to.deep.equal([
        mockParams[0].blockHash,
        mockParams[0].fromBlock,
        mockParams[0].toBlock,
        mockParams[0].address,
        mockParams[0].topics,
      ]);
    });

    it('should resolve parameters for ETH_NEWFILTER method', () => {
      const method = WS_CONSTANTS.METHODS.ETH_NEWFILTER;
      const resolvedParams = resolveParams(method, mockParams);

      expect(resolvedParams).to.deep.equal([
        mockParams[0].fromBlock,
        mockParams[0].toBlock,
        mockParams[0].address,
        mockParams[0].topics,
      ]);
    });

    it('should return original parameters for an unknown method', () => {
      const method = 'unknownMethod';
      const resolvedParams = resolveParams(method, mockParams);

      expect(resolvedParams).to.deep.equal(mockParams);
    });

    it('should return the original params if method requires no special handling', () => {
      const method = 'anotherMethod';
      const resolvedParams = resolveParams(method, mockParams);

      expect(resolvedParams).to.deep.equal(mockParams);
    });
  });

  describe('handleConnectionClose', () => {
    let relayStub: sinon.SinonStubbedInstance<Relay>;
    let limiterStub: sinon.SinonStubbedInstance<ConnectionLimiter>;
    let wsMetricRegistryStub: sinon.SinonStubbedInstance<WsMetricRegistry>;
    let ctxStub: any;
    let startTime: [number, number];

    beforeEach(() => {
      relayStub = {
        subs: sinon.stub().returns({
          unsubscribe: sinon.spy(),
        }),
      } as any;

      limiterStub = {
        decrementCounters: sinon.spy(),
      } as any;

      wsMetricRegistryStub = {
        getCounter: sinon.stub().returns({
          inc: sinon.spy(),
        }),
        getHistogram: sinon.stub().returns({
          labels: sinon.stub().returns({
            observe: sinon.spy(),
          }),
        }),
      } as any;

      ctxStub = {
        websocket: {
          id: 'mock-id',
          terminate: sinon.spy(),
        },
      };

      startTime = process.hrtime();
    });

    it('should unsubscribe subscriptions', async () => {
      await handleConnectionClose(
        ctxStub,
        relayStub as Relay,
        limiterStub as ConnectionLimiter,
        wsMetricRegistryStub as WsMetricRegistry,
        startTime,
      );

      expect(relayStub.subs()?.unsubscribe.calledWith(ctxStub.websocket)).to.be.true;
    });

    it('should decrement the limiter counters', async () => {
      await handleConnectionClose(
        ctxStub,
        relayStub as Relay,
        limiterStub as ConnectionLimiter,
        wsMetricRegistryStub as WsMetricRegistry,
        startTime,
      );

      expect(limiterStub.decrementCounters.calledWith(ctxStub)).to.be.true;
    });

    it('should increment the total closed connections counter', async () => {
      await handleConnectionClose(
        ctxStub,
        relayStub as Relay,
        limiterStub as ConnectionLimiter,
        wsMetricRegistryStub as WsMetricRegistry,
        startTime,
      );

      const incStub = wsMetricRegistryStub.getCounter('totalClosedConnections').inc as sinon.SinonSpy;
      expect(incStub.calledOnce).to.be.true;
    });

    it('should update the connection duration histogram', async () => {
      await handleConnectionClose(
        ctxStub,
        relayStub as Relay,
        limiterStub as ConnectionLimiter,
        wsMetricRegistryStub as WsMetricRegistry,
        startTime,
      );

      const labelsStub = wsMetricRegistryStub.getHistogram('connectionDuration').labels as sinon.SinonStub;
      const observeSpy = labelsStub().observe as sinon.SinonSpy;

      expect(labelsStub.calledWith(ctxStub.websocket.id)).to.be.true;
      expect(observeSpy.calledOnce).to.be.true;
    });

    it('should terminate the websocket connection', async () => {
      await handleConnectionClose(
        ctxStub,
        relayStub as Relay,
        limiterStub as ConnectionLimiter,
        wsMetricRegistryStub as WsMetricRegistry,
        startTime,
      );

      expect(ctxStub.websocket.terminate.calledOnce).to.be.true;
    });
  });

  describe('getMultipleAddressesEnabled', () => {
    it('should return true when WS_MULTIPLE_ADDRESSES_ENABLED is set to "true"', () => {
      process.env.WS_MULTIPLE_ADDRESSES_ENABLED = 'true';
      expect(getMultipleAddressesEnabled()).to.be.true;
    });

    it('should return false when WS_MULTIPLE_ADDRESSES_ENABLED is set to "false"', () => {
      process.env.WS_MULTIPLE_ADDRESSES_ENABLED = 'false';
      expect(getMultipleAddressesEnabled()).to.be.false;
    });

    it('should return false when WS_MULTIPLE_ADDRESSES_ENABLED is undefined', () => {
      delete process.env.WS_MULTIPLE_ADDRESSES_ENABLED;
      expect(getMultipleAddressesEnabled()).to.be.false;
    });
  });

  describe('getWsBatchRequestsEnabled', () => {
    it('should return true when WS_BATCH_REQUESTS_ENABLED is set to "true"', () => {
      process.env.WS_BATCH_REQUESTS_ENABLED = 'true';
      expect(getWsBatchRequestsEnabled()).to.be.true;
    });

    it('should return false when WS_BATCH_REQUESTS_ENABLED is set to "false"', () => {
      process.env.WS_BATCH_REQUESTS_ENABLED = 'false';
      expect(getWsBatchRequestsEnabled()).to.be.false;
    });

    it('should return true when WS_BATCH_REQUESTS_ENABLED is undefined', () => {
      delete process.env.WS_BATCH_REQUESTS_ENABLED;
      expect(getWsBatchRequestsEnabled()).to.be.true;
    });
  });

  describe('getBatchRequestsMaxSize', () => {
    it('should return the value of WS_BATCH_REQUESTS_MAX_SIZE when it is set', () => {
      process.env.WS_BATCH_REQUESTS_MAX_SIZE = '50';
      expect(getBatchRequestsMaxSize()).to.equal(50);
    });

    it('should return 20 when WS_BATCH_REQUESTS_MAX_SIZE is not set', () => {
      delete process.env.WS_BATCH_REQUESTS_MAX_SIZE;
      expect(getBatchRequestsMaxSize()).to.equal(20);
    });
  });
});
