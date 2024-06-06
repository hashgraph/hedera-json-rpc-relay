/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2024 Hedera Hashgraph, LLC
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

// external resources
import { expect } from 'chai';
import { WsTestHelper } from '../helper';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';

describe('@web-socket-batch-2 web3_clientVersion', async function () {
  const METHOD_NAME = 'web3_clientVersion';

  let requestId: string;

  // @ts-ignore
  const { relay } = global;

  before(async () => {
    requestId = Utils.generateRequestId();
  });

  it(`@release Should execute web3_clientVersion on Standard Web Socket and handle valid requests correctly`, async () => {
    const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, []);
    expect(response.result).to.exist;
    expect(response.result).to.be.a('string');
    const clientVersion = await relay.call('web3_clientVersion', [], requestId);
    expect(response.result).to.equal(clientVersion);
  });
});
