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
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import RelayClient from '@hashgraph/json-rpc-server/tests/clients/relayClient';
import MirrorClient from '@hashgraph/json-rpc-server/tests/clients/mirrorClient';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/clients/servicesClient';
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';

describe('@release @web-socket eth_sendRawTransaction', async function () {
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const METHOD_NAME = 'eth_sendRawTransaction';
  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
  const FAKE_TX_HASH = `0x${'00'.repeat(32)}`;
  const INVALID_PARAMS = [
    [],
    [''],
    [66],
    [39],
    [true],
    [false],
    ['abc'],
    ['0xhbar'],
    ['0xHedera'],
    [FAKE_TX_HASH, 'hbar'],
    [FAKE_TX_HASH, 'rpc', 'invalid'],
  ];

  let accounts: AliasAccount[] = [];
  let mirrorNodeServer: MirrorClient, requestId: string, relayClient: RelayClient, wsProvider: WebSocketProvider;

  before(async () => {
    // @ts-ignore
    const { servicesNode, mirrorNode, relay } = global;

    mirrorNodeServer = mirrorNode;
    relayClient = relay;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(5, relay.provider, requestId);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts to propagate
  });

  beforeEach(async () => {
    wsProvider = new ethers.WebSocketProvider(WS_RELAY_URL);
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
    }
  });

  for (const params of INVALID_PARAMS) {
    it(`Should throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, params);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.error).to.exist;
        expect(error.error.code).to.eq(-32602);
      }
    });
  }

  it('Should handle valid data correctly', async () => {
    const tx = {
      value: ONE_TINYBAR_IN_WEI_HEX,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      nonce: await relayClient.getAccountNonce(accounts[0].address, requestId),
      maxFeePerGas: await relayClient.gasPrice(requestId),
    };

    const signedTx = await accounts[0].wallet.signTransaction(tx);
    const txHash = await wsProvider.send(METHOD_NAME, [signedTx]);

    const txReceipt = await mirrorNodeServer.get(`/contracts/results/${txHash}`);
    const fromAccountInfo = await mirrorNodeServer.get(`/accounts/${txReceipt.from}`);

    expect(txReceipt.to).to.eq(accounts[1].address);
    expect(fromAccountInfo.evm_address).to.eq(accounts[0].address);
  });
});
