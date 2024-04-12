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
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/clients/servicesClient';
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';

describe('@release @web-socket eth_getTransactionReceipt', async function () {
  const METHOD_NAME = 'eth_getTransactionReceipt';
  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
  const INVALID_PARAMS = [
    [],
    [''],
    [39],
    [63],
    [true],
    ['abc'],
    [false],
    ['0xhbar'],
    ['0xHedera'],
    [WsTestConstant.FAKE_TX_HASH, 'hbar'],
    [WsTestConstant.FAKE_TX_HASH, 'rpc', 'invalid'],
  ];

  let txHash: string,
    expectedTxReceipt: any,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    accounts[0] = await global.servicesNode.createAliasAccount(100, global.relay.provider);
    accounts[1] = await global.servicesNode.createAliasAccount(5, global.relay.provider);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts to propagate

    const tx = {
      value: ONE_TINYBAR_IN_WEI_HEX,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      nonce: await global.relay.getAccountNonce(accounts[0].address),
      maxFeePerGas: await global.relay.gasPrice(),
    };

    const signedTx = await accounts[0].wallet.signTransaction(tx);
    txHash = await global.relay.sendRawTransaction(signedTx);
    expectedTxReceipt = await global.mirrorNode.get(`/contracts/results/${txHash}`);
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

  describe(WsTestConstant.STANDARD_WEB_SOCKET, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsStandardWebSocket(METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} and handle valid requests correctly`, async () => {
      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [txHash]);
      WsTestHelper.assertJsonRpcObject(response);

      const txReceipt = response.result;
      expect(txReceipt.to).to.be.eq(accounts[1].address);
      expect(txReceipt.from).to.be.eq(accounts[0].address);
      expect(txReceipt.transactionHash).to.be.eq(expectedTxReceipt.hash);
      expect(txReceipt.contractAddress).to.be.eq(expectedTxReceipt.address);
      expect(txReceipt.blockHash).to.be.eq(expectedTxReceipt.block_hash.slice(0, 66));
      expect(Number(txReceipt.transactionIndex)).to.be.eq(expectedTxReceipt.transaction_index);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
      const txReceipt = await ethersWsProvider.send(METHOD_NAME, [txHash]);

      expect(txReceipt.to).to.be.eq(accounts[1].address);
      expect(txReceipt.from).to.be.eq(accounts[0].address);
      expect(txReceipt.transactionHash).to.be.eq(expectedTxReceipt.hash);
      expect(txReceipt.contractAddress).to.be.eq(expectedTxReceipt.address);
      expect(txReceipt.blockHash).to.be.eq(expectedTxReceipt.block_hash.slice(0, 66));
      expect(Number(txReceipt.transactionIndex)).to.be.eq(expectedTxReceipt.transaction_index);
    });
  });
});
