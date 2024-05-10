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
import { ethers, WebSocketProvider } from 'ethers';
import { WsTestConstant, WsTestHelper } from '../helper';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import basicContractJson from '@hashgraph/json-rpc-server/tests/contracts/Basic.json';

describe('@release @web-socket-batch-2 eth_getCode', async function () {
  const METHOD_NAME = 'eth_getCode';

  let basicContract: ethers.Contract,
    basicContractAddress: string,
    codeFromRPC: string,
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    const account: AliasAccount = global.accounts[0];
    basicContract = await Utils.deployContract(basicContractJson.abi, basicContractJson.bytecode, account.wallet);
    basicContractAddress = basicContract.target as string;
    codeFromRPC = (await account.wallet.provider?.getCode(basicContractAddress)) as string;
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
    const codeFromWs = await ethersWsProvider.getCode(basicContractAddress);
    expect(codeFromWs).to.be.a('string');
    expect(codeFromRPC).to.equal(codeFromWs);
  });

  it('should return the code through a websocket', async () => {
    const param = [basicContractAddress, 'latest'];
    const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, param);
    WsTestHelper.assertJsonRpcObject(response);
    expect(response.result).to.equal(codeFromRPC);
  });
});
