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
import { Server } from 'http';
import * as utils from '../../../src/koaJsonRpc/lib/utils';
import constants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { configServiceTestHelper } from '../../../../config-service/tests/configServiceTestHelper';

describe('utils.ts', () => {
  describe('hasOwnProperty', () => {
    it('should return true when the object has the specified property', () => {
      const obj = { a: 1 };
      const result = utils.hasOwnProperty(obj, 'a');
      expect(result).to.be.true;
    });

    it('should return false when the object does not have the specified property', () => {
      const obj = { a: 1 };
      const result = utils.hasOwnProperty(obj, 'b');
      expect(result).to.be.false;
    });
  });

  describe('setServerTimeout', () => {
    let server: Server;
    let spy: sinon.SinonSpy;
    beforeEach(() => {
      server = new Server();
      spy = sinon.spy(server, 'setTimeout');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should set server timeout from environment variable', () => {
      configServiceTestHelper.dynamicOverride('SERVER_REQUEST_TIMEOUT_MS', '30000');

      utils.setServerTimeout(server);
      expect(spy.calledWith(30000)).to.eq(true);
    });

    it('should set server timeout to default value when environment variable is not set', () => {
      configServiceTestHelper.remove('SERVER_REQUEST_TIMEOUT_MS');

      utils.setServerTimeout(server);
      expect(spy.calledWith(60000)).to.eq(true);
    });
  });

  describe('getBatchRequestsMaxSize', () => {
    it('should return the batch request max size from environment variable', () => {
      configServiceTestHelper.dynamicOverride('BATCH_REQUESTS_MAX_SIZE', '150');

      const result = utils.getBatchRequestsMaxSize();
      expect(result).to.equal(150);
    });

    it('should return default batch request max size when environment variable is not set', () => {
      configServiceTestHelper.remove('BATCH_REQUESTS_MAX_SIZE');

      const result = utils.getBatchRequestsMaxSize();
      expect(result).to.equal(100);
    });
  });

  describe('getLimitDuration', () => {
    it('should return the limit duration from environment variable', () => {
      configServiceTestHelper.dynamicOverride('LIMIT_DURATION', '500');

      const result = utils.getLimitDuration();
      expect(result).to.equal(500);
    });

    it('should return the default limit duration when environment variable is not set', () => {
      configServiceTestHelper.remove('LIMIT_DURATION');

      const result = utils.getLimitDuration();
      expect(result).to.equal(constants.DEFAULT_RATE_LIMIT.DURATION);
    });
  });

  describe('getDefaultRateLimit', () => {
    it('should return the default rate limit from environment variable', () => {
      configServiceTestHelper.dynamicOverride('DEFAULT_RATE_LIMIT', '250');

      const result = utils.getDefaultRateLimit();
      expect(result).to.equal(250);
    });

    it('should return the default rate limit when environment variable is not set', () => {
      configServiceTestHelper.remove('DEFAULT_RATE_LIMIT');

      const result = utils.getDefaultRateLimit();
      expect(result).to.equal(200);
    });
  });

  describe('getRequestIdIsOptional', () => {
    it('should return true when REQUEST_ID_IS_OPTIONAL is set to true', () => {
      configServiceTestHelper.dynamicOverride('REQUEST_ID_IS_OPTIONAL', true);

      const result = utils.getRequestIdIsOptional();
      expect(result).to.be.true;
    });

    it('should return false when REQUEST_ID_IS_OPTIONAL is not set to true', () => {
      configServiceTestHelper.dynamicOverride('REQUEST_ID_IS_OPTIONAL', false);

      const result = utils.getRequestIdIsOptional();
      expect(result).to.be.false;
    });
  });

  describe('getBatchRequestsEnabled', () => {
    it('should return true when BATCH_REQUESTS_ENABLED is set to true', () => {
      configServiceTestHelper.dynamicOverride('BATCH_REQUESTS_ENABLED', true);

      const result = utils.getBatchRequestsEnabled();
      expect(result).to.be.true;
    });

    it('should return false when BATCH_REQUESTS_ENABLED is not set to true', () => {
      configServiceTestHelper.dynamicOverride('BATCH_REQUESTS_ENABLED', false);

      const result = utils.getBatchRequestsEnabled();
      expect(result).to.be.false;
    });
  });
});
