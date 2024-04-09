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
import { Contract, ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import { AliasAccount } from '../../clients/servicesClient';
import WebSocket from 'ws';
import basicContractJson from '../../contracts/Basic.json';

describe('@release @web-socket eth_getCode', async function () {
  const RELAY_URL = `${process.env.RELAY_ENDPOINT}`;
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;

  let accounts: AliasAccount[] = [],
    basicContract: Contract,
    codeFromRPC: string,
    provider: JsonRpcProvider,
    requestId: string,
    wsProvider: WebSocketProvider,
    webSocket: WebSocket;

  before(async () => {
    // @ts-ignore
    const { servicesNode, relay } = global;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    basicContract = await servicesNode.deployContract(basicContractJson);
    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    provider = new ethers.JsonRpcProvider(RELAY_URL);
    codeFromRPC = await provider.getCode(`0x${basicContract.contractId.toSolidityAddress()}`);

    webSocket = new WebSocket(WS_RELAY_URL);
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  it('should return the code ethers WebSocketProvider', async function () {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const codeFromWs = await wsProvider.getCode(`0x${basicContract.contractId.toSolidityAddress()}`);
    expect(codeFromWs).to.be.a('string');
    expect(codeFromRPC).to.equal(codeFromWs);
  });

  it('should return the code through a websocket', (done) => {
    webSocket.on('open', function open() {
      webSocket.send(
        JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_getCode',
          params: [`0x${basicContract.contractId.toSolidityAddress()}`, 'latest'],
        }),
      );
    });
    let responseCounter = 0;
    webSocket.on('message', function incoming(data) {
      const response = JSON.parse(data);
      if (response.result) {
        expect(response.result).to.equal(codeFromRPC);
      }

      responseCounter++;
      if (responseCounter > 1) {
        webSocket.close();
        done();
      }
    });
  });
});
