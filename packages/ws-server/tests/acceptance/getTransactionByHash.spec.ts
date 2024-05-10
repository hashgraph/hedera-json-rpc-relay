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

describe('@release @web-socket-batch-2 eth_getTransactionByHash', async function () {
  const METHOD_NAME = 'eth_getTransactionByHash';
  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
  const INVALID_PARAMS = [
    [],
    [''],
    [66],
    [39],
    [true],
    ['abc'],
    ['0xhbar'],
    ['txHash'],
    ['0xHedera'],
    [WsTestConstant.FAKE_TX_HASH, 'hbar'],
    [WsTestConstant.FAKE_TX_HASH, 'rpc', 'invalid'],
  ];

  // @ts-ignore
  const { mirrorNode, relay, initialBalance } = global;
  let txHash: string,
    expectedTxReceipt: any,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;
  let requestId: string;

  before(async () => {
    requestId = Utils.generateRequestId();
    const initialAccount: AliasAccount = global.accounts[0];

    const neededAccounts: number = 2;
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

    const tx = {
      value: ONE_TINYBAR_IN_WEI_HEX,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      nonce: await relay.getAccountNonce(accounts[0].address),
      maxFeePerGas: await relay.gasPrice(),
    };
    const signedTx = await accounts[0].wallet.signTransaction(tx);
    txHash = await relay.sendRawTransaction(signedTx);
    expectedTxReceipt = await mirrorNode.get(`/contracts/results/${txHash}`);
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
      it(`Should fail eth_getTransactionByHash on Standard Web Socket and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsStandardWebSocket(METHOD_NAME, params);
      });
    }

    it(`Should execute eth_getTransactionByHash on Standard Web Socket and handle valid requests correctly`, async () => {
      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [txHash]);
      WsTestHelper.assertJsonRpcObject(response);

      const txReceipt = response.result;
      expect(txReceipt.from).to.be.eq(accounts[0].address.toLowerCase());
      expect(txReceipt.to).to.be.eq(accounts[1].address.toLowerCase());
      expect(txReceipt.blockHash).to.be.eq(expectedTxReceipt.block_hash.slice(0, 66));
      expect(txReceipt.hash).to.be.eq(expectedTxReceipt.hash);
      expect(txReceipt.r).to.be.eq(expectedTxReceipt.r);
      expect(txReceipt.s).to.be.eq(expectedTxReceipt.s);
      expect(Number(txReceipt.v)).to.be.eq(expectedTxReceipt.v);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail eth_getTransactionByHash on Ethers Web Socket Provider and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute eth_getTransactionByHash on Ethers Web Socket Provider and handle valid requests correctly`, async () => {
      const txReceipt = await ethersWsProvider.send(METHOD_NAME, [txHash]);
      expect(txReceipt.from).to.be.eq(accounts[0].address.toLowerCase());
      expect(txReceipt.to).to.be.eq(accounts[1].address.toLowerCase());
      expect(txReceipt.blockHash).to.be.eq(expectedTxReceipt.block_hash.slice(0, 66));
      expect(txReceipt.hash).to.be.eq(expectedTxReceipt.hash);
      expect(txReceipt.r).to.be.eq(expectedTxReceipt.r);
      expect(txReceipt.s).to.be.eq(expectedTxReceipt.s);
      expect(Number(txReceipt.v)).to.be.eq(expectedTxReceipt.v);
    });
  });
});
