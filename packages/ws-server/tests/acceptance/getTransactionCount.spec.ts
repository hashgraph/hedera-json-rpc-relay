/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
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
import { ConfigService } from '@hashgraph/json-rpc-config-service/dist/services';
import { numberTo0x } from '@hashgraph/json-rpc-relay/dist/formatters';
import { RequestDetails } from '@hashgraph/json-rpc-relay/dist/lib/types';
import MirrorClient from '@hashgraph/json-rpc-server/tests/clients/mirrorClient';
import RelayClient from '@hashgraph/json-rpc-server/tests/clients/relayClient';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { expect } from 'chai';
import { ethers, WebSocketProvider } from 'ethers';

import { ConfigName } from '../../../config-service/src/services/configName';
import { WsTestConstant, WsTestHelper } from '../helper';

describe('@release @web-socket-batch-2 eth_getTransactionCount', async function () {
  const METHOD_NAME = 'eth_getTransactionCount';
  const CHAIN_ID = ConfigService.get(ConfigName.CHAIN_ID) || '0x12a';
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));

  // @ts-ignore
  const { mirrorNode, relay }: { mirrorNode: MirrorClient; relay: RelayClient } = global;
  const requestId = 'getTransactionCount_ws-server';
  const requestDetails = new RequestDetails({ requestId: requestId, ipAddress: '0.0.0.0' });

  let accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    const initialAccount: AliasAccount = global.accounts[0];
    const initialAmount: string = '100000000'; //1 Hbar

    const neededAccounts: number = 2;
    accounts.push(
      ...(await Utils.createMultipleAliasAccounts(
        mirrorNode,
        initialAccount,
        neededAccounts,
        initialAmount,
        requestDetails,
      )),
    );
    global.accounts.push(...accounts);

    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to be closed after all
    if (global && global.socketServer) {
      expect(global.socketServer._connections).to.eq(0);
    }
  });

  it('should return the transaction count through an ethers WebSocketProvider', async () => {
    const beforeTransactionCountFromWs = await ethersWsProvider.getTransactionCount(accounts[0].address);
    await Utils.sendTransaction(ONE_TINYBAR, CHAIN_ID, accounts, relay, requestId, mirrorNode);
    const afterTransactionCountFromWs = await ethersWsProvider.getTransactionCount(accounts[0].address);
    expect(afterTransactionCountFromWs).to.equal(beforeTransactionCountFromWs + 1);
  });

  it('should return the transaction count through a websocket', async () => {
    // get correct gas price for different network environments
    const defaultGasPrice = await relay.gasPrice(requestId);

    const beforeSendRawTransactionCountResponse = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [
      accounts[0].address,
      'latest',
    ]);
    WsTestHelper.assertJsonRpcObject(beforeSendRawTransactionCountResponse);
    const transactionCountBefore = await relay.getAccountNonce(accounts[0].address, requestId);
    expect(Number(beforeSendRawTransactionCountResponse.result)).to.eq(transactionCountBefore);

    const transaction = {
      value: ONE_TINYBAR,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      maxFeePerGas: defaultGasPrice,
      nonce: await relay.getAccountNonce(accounts[0].address, requestId),
    };
    const signedTx = await accounts[0].wallet.signTransaction(transaction);
    // @notice submit a transaction to increase transaction count
    await relay.sendRawTransaction(signedTx, requestId);

    const afterSendRawTransactionCountResponse = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [
      accounts[0].address,
      'latest',
    ]);
    WsTestHelper.assertJsonRpcObject(afterSendRawTransactionCountResponse);
    const transactionCountAfter = await relay.getAccountNonce(accounts[0].address, requestId);
    expect(Number(afterSendRawTransactionCountResponse.result)).to.eq(transactionCountAfter);
  });
});
