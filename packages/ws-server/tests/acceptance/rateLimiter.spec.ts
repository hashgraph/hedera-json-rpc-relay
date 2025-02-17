// SPDX-License-Identifier: Apache-2.0

// external resources
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import relayConstants from '@hashgraph/json-rpc-relay/dist/lib/constants';
import { IPRateLimitExceeded } from '@hashgraph/json-rpc-server/dist/koaJsonRpc/lib/RpcError';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { expect } from 'chai';

import { ConfigServiceTestHelper } from '../../../config-service/tests/configServiceTestHelper';
import { WsTestHelper } from '../helper';

describe('@web-socket-ratelimiter Rate Limit Tests', async function () {
  const rateLimitTier2 = ConfigService.get('TIER_2_RATE_LIMIT');
  const limitDuration = ConfigService.get('LIMIT_DURATION');

  const batchRequests = [
    {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
    },
    {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
    },
  ];

  before(async () => {
    ConfigServiceTestHelper.dynamicOverride('WS_BATCH_REQUESTS_ENABLED', true);
  });

  after(async () => {
    ConfigServiceTestHelper.dynamicOverride('WS_BATCH_REQUESTS_ENABLED', false);
    // expect all the connections to the WS server to be closed after all
    if (global && global.socketServer) {
      expect(global.socketServer._connections).to.eq(0);
    }
  });

  it(`Should submit single requests to WS server and receive IPRateLimitExceeded error until rate limit is reached`, async () => {
    const SINGLE_REQUEST_METHOD_NAME = 'eth_gasPrice';
    for (let i = 0; i < rateLimitTier2; i++) {
      await WsTestHelper.sendRequestToStandardWebSocket(SINGLE_REQUEST_METHOD_NAME, []);
    }

    // exceed rate limit
    const response = await WsTestHelper.sendRequestToStandardWebSocket(SINGLE_REQUEST_METHOD_NAME, []);
    const ipRateLimitError = new IPRateLimitExceeded(SINGLE_REQUEST_METHOD_NAME);
    expect(response.error.code).to.deep.eq(ipRateLimitError.code);
    expect(response.error.message).to.deep.eq(ipRateLimitError.message);

    // wait until rate limit is reset
    await new Promise((r) => setTimeout(r, limitDuration));
  });

  it(`Should submit batch requests to WS server and receive IPRateLimitExceeded error until rate limit is reached`, async () => {
    const BATCH_REQUEST_METHOD_NAME = 'batch_request';

    // call batch request multitime to reach limit
    for (let i = 0; i < rateLimitTier2; i++) {
      await WsTestHelper.sendRequestToStandardWebSocket(BATCH_REQUEST_METHOD_NAME, batchRequests);
    }

    // exceed rate limit
    const batchResponses = await WsTestHelper.sendRequestToStandardWebSocket(BATCH_REQUEST_METHOD_NAME, batchRequests);
    const possibleErrors = batchRequests.map((r) => new IPRateLimitExceeded(r.method));

    expect(batchResponses[0].error.code).to.deep.eq(possibleErrors[0].code);
    expect(batchResponses[0].error.message).to.be.oneOf(possibleErrors.map((e) => e.message));

    // wait until rate limit is reset
    await new Promise((r) => setTimeout(r, limitDuration));
  });

  it(`Should reset limit for requests`, async () => {
    const SINGLE_REQUEST_METHOD_NAME = 'eth_getBalance';
    const account: AliasAccount = global.accounts[0];

    for (let i = 0; i < rateLimitTier2; i++) {
      await WsTestHelper.sendRequestToStandardWebSocket(SINGLE_REQUEST_METHOD_NAME, [account.address, 'latest']);
    }
    // exceed rate limit
    const rateLimitResponse = await WsTestHelper.sendRequestToStandardWebSocket(SINGLE_REQUEST_METHOD_NAME, [
      account.address,
      'latest',
    ]);
    const ipRateLimitError = new IPRateLimitExceeded(SINGLE_REQUEST_METHOD_NAME);
    expect(rateLimitResponse.error.code).to.deep.eq(ipRateLimitError.code);
    expect(rateLimitResponse.error.message).to.deep.eq(ipRateLimitError.message);

    // wait until rate limit is reset
    await new Promise((r) => setTimeout(r, limitDuration));
    const response = await WsTestHelper.sendRequestToStandardWebSocket(SINGLE_REQUEST_METHOD_NAME, [
      account.address,
      'latest',
    ]);
    const expectedResult = await global.relay.call(SINGLE_REQUEST_METHOD_NAME, [account.address, 'latest']);
    expect(response.result).to.eq(expectedResult);
  });
});
