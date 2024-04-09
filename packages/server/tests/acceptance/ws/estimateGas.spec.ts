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
import WebSocket from 'ws';
import { expect } from 'chai';
import basicContractJson from '../../contracts/Basic.json';
import { AliasAccount } from '../../clients/servicesClient';
import { Contract, ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';

describe('@release @web-socket eth_estimateGas', async function () {
  // @ts-ignore
  const { servicesNode, relay } = global;

  const RELAY_URL = `${process.env.RELAY_ENDPOINT}`;
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
  const PING_CALL_ESTIMATED_GAS = '0x6122';

  let accounts: AliasAccount[] = [],
    basicContract: Contract,
    currentPrice: number,
    expectedGas: number,
    gasPriceDeviation: number,
    provider: JsonRpcProvider,
    requestId: string,
    wsProvider: WebSocketProvider,
    webSocket: WebSocket;

  before(async () => {
    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    basicContract = await servicesNode.deployContract(basicContractJson);
    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    provider = new ethers.JsonRpcProvider(RELAY_URL);

    webSocket = new WebSocket(WS_RELAY_URL);
    currentPrice = await relay.gasPrice(requestId);
    expectedGas = parseInt(PING_CALL_ESTIMATED_GAS, 16);

    // handle deviation in gas price of 20%.  On testnet gas price can vary depending on the network congestion
    gasPriceDeviation = parseFloat(expectedGas.toString() ?? '0.2');
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
    }
  });

  it('@release should execute "eth_estimateGas" for contract call, using a websocket provider', async function () {
    const estimatedGas = await wsProvider.estimateGas({
      to: `0x${basicContract.contractId.toSolidityAddress()}`,
      data: BASIC_CONTRACT_PING_CALL_DATA,
    });

    // handle deviation in gas price.  On testnet gas price can vary depending on the network congestion
    expect(Number(estimatedGas)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
    expect(Number(estimatedGas)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
  });

  it('should return the code through a websocket', (done) => {
    webSocket.on('open', function open() {
      webSocket.send(
        JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [
            {
              to: `0x${basicContract.contractId.toSolidityAddress()}`,
              data: BASIC_CONTRACT_PING_CALL_DATA,
            },
          ],
        }),
      );
    });
    let responseCounter = 0;
    webSocket.on('message', function incoming(data) {
      const response = JSON.parse(data);
      if (response.result) {
        expect(Number(response.result)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
        expect(Number(response.result)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
      }

      responseCounter++;
      if (responseCounter > 1) {
        webSocket.close();
        done();
      }
    });
  });
});
