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
import { Contract, ethers, WebSocketProvider } from 'ethers';
import { WsTestConstant, WsTestHelper } from '../helper';
import basicContractJson from '@hashgraph/json-rpc-server/tests/contracts/Basic.json';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';

describe('@release @web-socket-batch-1 eth_estimateGas', async function () {
  const METHOD_NAME = 'eth_estimateGas';
  const PING_CALL_ESTIMATED_GAS = '0x6122';
  const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';

  // @ts-ignore
  const { mirrorNode } = global;
  let accounts: AliasAccount[] = [],
    basicContract: ethers.Contract,
    currentPrice: number,
    expectedGas: number,
    gasPriceDeviation: number,
    ethersWsProvider: WebSocketProvider,
    requestId = 'eth_estimateGas';

  before(async () => {
    requestId = Utils.generateRequestId();
    const initialAccount: AliasAccount = global.accounts[0];
    const initialAmount: string = '2500000000'; //25 Hbar

    const neededAccounts: number = 1;
    accounts.push(
      ...(await Utils.createMultipleAliasAccounts(
        mirrorNode,
        initialAccount,
        neededAccounts,
        initialAmount,
        requestId,
      )),
    );
    global.accounts.push(...accounts);

    currentPrice = await global.relay.gasPrice();
    expectedGas = parseInt(PING_CALL_ESTIMATED_GAS, 16);

    // handle deviation in gas price of 20%.  On testnet gas price can vary depending on the network congestion
    gasPriceDeviation = parseFloat(expectedGas.toString() ?? '0.2');
  });

  beforeEach(async () => {
    ethersWsProvider = new ethers.WebSocketProvider(WsTestConstant.WS_RELAY_URL);
    const wallet = new ethers.Wallet(accounts[0].wallet.privateKey, ethersWsProvider);
    basicContract = await Utils.deployContract(basicContractJson.abi, basicContractJson.bytecode, wallet);
  });

  afterEach(async () => {
    if (ethersWsProvider) await ethersWsProvider.destroy();
  });

  after(async () => {
    // expect all the connections to be closed after all
    expect(global.socketServer._connections).to.eq(0);
  });

  it('@release should execute "eth_estimateGas" for contract call, using a websocket provider', async function () {
    const estimatedGas = await ethersWsProvider.estimateGas({
      to: basicContract.target,
      data: BASIC_CONTRACT_PING_CALL_DATA,
    });

    // handle deviation in gas price.  On testnet gas price can vary depending on the network congestion
    expect(Number(estimatedGas)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
    expect(Number(estimatedGas)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
  });

  it('should return the code through a websocket', async () => {
    const tx = { to: basicContract.target, data: BASIC_CONTRACT_PING_CALL_DATA };
    const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [tx]);
    WsTestHelper.assertJsonRpcObject(response);
    expect(Number(response.result)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
    expect(Number(response.result)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
  });
});
