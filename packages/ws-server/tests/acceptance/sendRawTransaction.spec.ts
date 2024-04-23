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
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';

describe('@release @web-socket-batch-2 eth_sendRawTransaction', async function () {
  const METHOD_NAME = 'eth_sendRawTransaction';
  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
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
    [WsTestConstant.FAKE_TX_HASH, 'hbar'],
    [WsTestConstant.FAKE_TX_HASH, 'rpc', 'invalid'],
  ];

  // @ts-ignore
  const { mirrorNode, relay, initialBalance } = global;

  let tx: any,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;
  let requestId: string;
  before(async () => {
    requestId = Utils.generateRequestId();
    const initialAccount: AliasAccount = global.accounts[0];

    const neededAccounts: number = 3;
    accounts.push(
      ...(await Utils.createMultipleAliasAccounts(
        mirrorNode,
        initialAccount,
        neededAccounts,
        initialBalance,
        requestId,
      )),
    );
    global.accounts.push(...accounts);

    tx = {
      value: ONE_TINYBAR_IN_WEI_HEX,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[2].address,
      maxFeePerGas: await relay.gasPrice(),
    };
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
      tx.nonce = await relay.getAccountNonce(accounts[0].address);
      const signedTx = await accounts[0].wallet.signTransaction(tx);

      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [signedTx], 1000);
      WsTestHelper.assertJsonRpcObject(response);

      const txHash = response.result;
      const txReceipt = await mirrorNode.get(`/contracts/results/${txHash}`);
      const fromAccountInfo = await mirrorNode.get(`/accounts/${txReceipt.from}`);

      expect(txReceipt.to).to.eq(accounts[2].address.toLowerCase());
      expect(fromAccountInfo.evm_address).to.eq(accounts[0].address.toLowerCase());
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
      tx.nonce = await relay.getAccountNonce(accounts[1].address);
      const signedTx = await accounts[1].wallet.signTransaction(tx); // const signedTx = await accounts[0].wallet.signTransaction(tx);

      const txHash = await ethersWsProvider.send(METHOD_NAME, [signedTx]);

      const txReceipt = await mirrorNode.get(`/contracts/results/${txHash}`);
      const fromAccountInfo = await mirrorNode.get(`/accounts/${txReceipt.from}`);

      expect(txReceipt.to).to.eq(accounts[2].address.toLowerCase());
      expect(fromAccountInfo.evm_address).to.eq(accounts[1].address.toLowerCase());
    });
  });
});
