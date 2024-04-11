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
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import { Utils } from '../../helpers/utils';
import Assertions from '../../helpers/assertions';
const CHAIN_ID = process.env.CHAIN_ID || 0;
const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));

describe('@release @web-socket eth_getTransactionCount', async function () {
  const RELAY_URL = `${process.env.RELAY_ENDPOINT}`;
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const defaultGasPrice = numberTo0x(Assertions.defaultGasPrice);

  let accounts: AliasAccount[] = [],
    basicContract: Contract,
    codeFromRPC: string,
    nonce: string,
    provider: JsonRpcProvider,
    requestId: string,
    wsProvider: WebSocketProvider,
    webSocket: WebSocket;

  // @ts-ignore
  const { servicesNode, mirrorNode, relay } = global;

  this.beforeEach(async () => {
    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    basicContract = await servicesNode.deployContract(basicContractJson);
    wsProvider = await new ethers.WebSocketProvider(WS_RELAY_URL);
    provider = new ethers.JsonRpcProvider(RELAY_URL);
    codeFromRPC = await provider.getCode(`0x${basicContract.contractId.toSolidityAddress()}`);

    webSocket = new WebSocket(WS_RELAY_URL);
  });

  it('should return the transaction count through an ethers WebSocketProvider', async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const beforeTransactionCountFromWs = await wsProvider.getTransactionCount(accounts[0].address);
    await Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, relay, requestId, mirrorNode);
    const afterTransactionCountFromWs = await wsProvider.getTransactionCount(accounts[0].address);
    expect(afterTransactionCountFromWs).to.equal(beforeTransactionCountFromWs + 1);
  });

  it('should return the transaction count through a websocket', async () => {
    const transaction = {
      value: ONE_TINYBAR,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      maxFeePerGas: defaultGasPrice,
    };

    const signedTx = await accounts[0].wallet.signTransaction(transaction);

    // Open the WebSocket connection and send the message
    const openPromise = new Promise<void>(async (resolve, reject) => {
      webSocket.on('open', async () => {
        await relay.sendRawTransaction(signedTx, requestId);
        webSocket.send(
          JSON.stringify({
            id: 1,
            jsonrpc: '2.0',
            method: 'eth_getTransactionCount',
            params: [accounts[0].address, 'latest'],
          }),
        );
        resolve();
      });
    });

    // Wait for the WebSocket to open before proceeding
    await openPromise;

    // Handle incoming messages from the WebSocket
    const messagePromise = new Promise<void>((resolve, reject) => {
      webSocket.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.result) {
          expect(response.result).to.equal('0x1');
          webSocket.close();
          resolve();
        }
      });
    });

    await messagePromise;
  });
});
