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
import { WsTestConstant, WsTestHelper } from '../helper';
import { ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import basicContractJson from '@hashgraph/json-rpc-server/tests/contracts/Basic.json';

describe('@release @web-socket eth_getCode', async function () {
  const RELAY_URL = `${process.env.RELAY_ENDPOINT}`;
  const METHOD_NAME = 'eth_getCode';

  let basicContract: any, codeFromRPC: string, provider: JsonRpcProvider, ethersWsProvider: WebSocketProvider;

  before(async () => {
    basicContract = await global.servicesNode.deployContract(basicContractJson);
    provider = new ethers.JsonRpcProvider(RELAY_URL);
    codeFromRPC = await provider.getCode(`0x${basicContract.contractId.toSolidityAddress()}`);
  });

  beforeEach(async () => {
    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to be closed after all
    expect(global.socketServer._connections).to.eq(0);
  });

  it('should return the code ethers WebSocketProvider', async function () {
    const codeFromWs = await ethersWsProvider.getCode(`0x${basicContract.contractId.toSolidityAddress()}`);
    expect(codeFromWs).to.be.a('string');
    expect(codeFromRPC).to.equal(codeFromWs);
  });

  it('should return the code through a websocket', async () => {
    const param = [`0x${basicContract.contractId.toSolidityAddress()}`, 'latest'];
    const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, param);
    WsTestHelper.assertJsonRpcObject(response);
    expect(response.result).to.equal(codeFromRPC);
  });
});
