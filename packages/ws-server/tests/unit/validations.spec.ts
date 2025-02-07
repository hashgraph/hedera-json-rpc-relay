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

import { RequestDetails } from '@hashgraph/json-rpc-relay/dist/lib/types';
import { expect } from 'chai';
import pino from 'pino';

import { WS_CONSTANTS } from '../../src/utils/constants';
import { validateJsonRpcRequest, verifySupportedMethod } from '../../src/utils/utils';
import { WsTestHelper } from '../helper';

const logger = pino({ level: 'silent' });

describe('validations unit test', async function () {
  const FAKE_REQUEST_ID = '3';
  const FAKE_CONNECTION_ID = '9';
  const requestDetails = new RequestDetails({
    requestId: FAKE_REQUEST_ID,
    ipAddress: '0.0.0.0',
    connectionId: FAKE_CONNECTION_ID,
  });

  it('Should execute validateJsonRpcRequest() to validate valid JSON RPC request and return true', () => {
    const VALID_REQEST = {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
    };

    expect(validateJsonRpcRequest(VALID_REQEST, logger, requestDetails)).to.be.true;
  });

  it('Should execute validateJsonRpcRequest() to validate invalid JSON RPC requests and return false', () => {
    const INVALID_REQUESTS = [
      {
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      },
      {
        id: 1,
        method: 'eth_chainId',
        params: [],
      },
      {
        id: 1,
        jsonrpc: '2.0',
        params: [],
      },
    ];

    INVALID_REQUESTS.forEach((request) => {
      // @ts-ignore
      expect(validateJsonRpcRequest(request, logger, requestDetails)).to.be.false;
    });
  });

  WsTestHelper.withOverriddenEnvsInMochaTest({ REQUEST_ID_IS_OPTIONAL: 'true' }, () => {
    it('Should execute validateJsonRpcRequest() to validate JSON RPC request that has no id field but return true because REQUEST_ID_IS_OPTIONAL=true', () => {
      const REQUEST = {
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
      };
      // @ts-ignore
      expect(validateJsonRpcRequest(REQUEST, logger, requestDetails)).to.be.true;
    });
  });

  it("Should execute verifySupportedMethod() to validate requests' methods and return true if methods are supported", () => {
    const SUPPORTED_METHODS = Object.keys(WS_CONSTANTS.METHODS);

    SUPPORTED_METHODS.forEach((method) => {
      expect(verifySupportedMethod(method)).to.be.true;
    });
  });

  it("Should execute verifySupportedMethod() to validate requests' methods and return false if methods are not supported", () => {
    const UNSUPPORTED_METHODS = ['eth_contractIdd', 'eth_getCall', 'getLogs', 'blockNum'];

    UNSUPPORTED_METHODS.forEach((method) => {
      expect(verifySupportedMethod(method)).to.be.false;
    });
  });
});
