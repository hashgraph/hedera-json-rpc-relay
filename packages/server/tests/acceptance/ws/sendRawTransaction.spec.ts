/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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
import RelayClient from '../../clients/relayClient';
import MirrorClient from '../../clients/mirrorClient';
import { AliasAccount } from '../../clients/servicesClient';
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';

describe('@web-socket eth_sendRawTransaction', async function () {
  const WS_RELAY_URL = `${process.env.WS_RELAY_URL}`;
  const METHOD_NAME = 'eth_sendRawTransaction';
  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
  const INVALID_PARAMS = [['hedera', 'hbar'], [], ['websocket', 'rpc', 'invalid']];
  const INVALID_TX_HASH = ['0xhbar', '0xHedera', '', 66, 'abc', true, false, 39];

  let accounts: AliasAccount[] = [];
  let mirrorNodeServer: MirrorClient, requestId: string, relayClient: RelayClient, wsProvider: WebSocketProvider;

  before(async () => {
    // @ts-ignore
    const { servicesNode, mirrorNode, relay } = global;

    mirrorNodeServer = mirrorNode;
    relayClient = relay;

    accounts[0] = await servicesNode.createAliasAccount(100, relay.provider, requestId);
    accounts[1] = await servicesNode.createAliasAccount(5, relay.provider, requestId);
  });

  beforeEach(async () => {
    wsProvider = new ethers.WebSocketProvider(WS_RELAY_URL);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    if (wsProvider) {
      await wsProvider.destroy();
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  for (const params of INVALID_PARAMS) {
    it(`Should throw predefined.INVALID_PARAMETERS if the request's params variable is invalid (params.length !== 1). params=[${params}]`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, params);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.error).to.exist;
        expect(error.error.code).to.eq(-32602);
        expect(error.error.name).to.eq('Invalid parameters');
        expect(error.error.message).to.eq('Invalid params');
      }
    });
  }

  for (const txHash of INVALID_TX_HASH) {
    it(`Should handle invalid data correctly. txHash = ${txHash}`, async () => {
      try {
        await wsProvider.send(METHOD_NAME, [txHash]);
        expect(true).to.eq(false);
      } catch (error) {
        expect(error.error.code).to.eq(-32603);

        if (txHash === '') {
          expect(error.error.message).to.contain('Error invoking RPC: Passed hex an empty string');
        } else if (typeof txHash !== 'string') {
          expect(error.error.message).to.contain('Error invoking RPC: hex.startsWith is not a function');
        } else {
          expect(error.error.message).to.contain('Error invoking RPC: invalid BytesLike value');
        }
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
