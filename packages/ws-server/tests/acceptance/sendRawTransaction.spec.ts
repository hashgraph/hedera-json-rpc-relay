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
import constants from '@hashgraph/json-rpc-relay/src/lib/constants';
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/clients/servicesClient';
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';

describe('@release @web-socket eth_sendRawTransaction', async function () {
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

  let tx: any,
    sendHbarToProxyContractDeployerTx: any,
    accounts: AliasAccount[] = [],
    ethersWsProvider: WebSocketProvider;

  before(async () => {
    accounts[0] = await global.servicesNode.createAliasAccount(100, global.relay.provider);
    accounts[1] = await global.servicesNode.createAliasAccount(100, global.relay.provider);
    accounts[2] = await global.servicesNode.createAliasAccount(5, global.relay.provider);
    await new Promise((r) => setTimeout(r, 1000)); // wait for accounts to propagate

    tx = {
      value: ONE_TINYBAR_IN_WEI_HEX,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[2].address,
      maxFeePerGas: await global.relay.gasPrice(),
    };

    sendHbarToProxyContractDeployerTx = {
      value: (10 * 10 ** 18).toString(), // 10hbar - the gasPrice to deploy Foundry deterministic proxy contract
      to: constants.FOUDRY_DETERMINISTIC_DEPLOYMENT_SIGNER,
      gasPrice: await global.relay.gasPrice(),
      gasLimit: numberTo0x(30000),
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
      tx.nonce = await global.relay.getAccountNonce(accounts[0].address);
      const signedTx = await accounts[0].wallet.signTransaction(tx);

      const response = await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [signedTx], 1000);
      WsTestHelper.assertJsonRpcObject(response);

      const txHash = response.result;
      const txReceipt = await global.mirrorNode.get(`/contracts/results/${txHash}`);
      const fromAccountInfo = await global.mirrorNode.get(`/accounts/${txReceipt.from}`);

      expect(txReceipt.to).to.eq(accounts[2].address);
      expect(fromAccountInfo.evm_address).to.eq(accounts[0].address);
    });

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} for the Foundry deterministic deployment transaction`, async () => {
      // send gas money to the proxy deployer
      sendHbarToProxyContractDeployerTx.nonce = await global.relay.getAccountNonce(accounts[0].address);
      const signedSendHbarTx = await accounts[0].wallet.signTransaction(sendHbarToProxyContractDeployerTx);
      await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [signedSendHbarTx], 1000);
      const deployerBalance = await global.relay.getBalance(constants.FOUDRY_DETERMINISTIC_DEPLOYMENT_SIGNER, 'latest');
      expect(deployerBalance).to.not.eq(0);

      // send transaction to deploy proxy transaction
      const foundryDeterministicDeploymentTransactionHash = await WsTestHelper.sendRequestToStandardWebSocket(
        METHOD_NAME,
        [constants.FOUNDRY_DETERMINISTIC_DEPLOYER_TRANSACTION],
        1000,
      );

      const receipt = await global.mirrorNode.get(
        `/contracts/results/${foundryDeterministicDeploymentTransactionHash.result}`,
      );
      const fromAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.from}`);
      expect(receipt).to.exist;
      expect(fromAccountInfo.evm_address).to.eq(constants.FOUDRY_DETERMINISTIC_DEPLOYMENT_SIGNER);
      // notice: the assertion below is currently blocked by the Services
      // expect(receipt.address).to.eq(constants.FOUDRY_DETERMINISTIC_PROXY_CONTRACT);
    });
  });

  describe(WsTestConstant.ETHERS_WS_PROVIDER, () => {
    for (const params of INVALID_PARAMS) {
      it(`Should fail ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and throw predefined.INVALID_PARAMETERS if the request's params variable is invalid. params=[${params}]`, async () => {
        await WsTestHelper.assertFailInvalidParamsEthersWsProvider(ethersWsProvider, METHOD_NAME, params);
      });
    }

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} and handle valid requests correctly`, async () => {
      tx.nonce = await global.relay.getAccountNonce(accounts[1].address);
      const signedTx = await accounts[1].wallet.signTransaction(tx); // const signedTx = await accounts[0].wallet.signTransaction(tx);

      const txHash = await ethersWsProvider.send(METHOD_NAME, [signedTx]);

      const txReceipt = await global.mirrorNode.get(`/contracts/results/${txHash}`);
      const fromAccountInfo = await global.mirrorNode.get(`/accounts/${txReceipt.from}`);

      expect(txReceipt.to).to.eq(accounts[2].address);
      expect(fromAccountInfo.evm_address).to.eq(accounts[1].address);
    });

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} for the Foundry deterministic deployment transaction`, async () => {
      // send gas money to the proxy deployer
      sendHbarToProxyContractDeployerTx.nonce = await global.relay.getAccountNonce(accounts[1].address);
      const signedSendHbarTx = await accounts[1].wallet.signTransaction(sendHbarToProxyContractDeployerTx);
      await ethersWsProvider.send(METHOD_NAME, [signedSendHbarTx]);
      const deployerBalance = await global.relay.getBalance(constants.FOUDRY_DETERMINISTIC_DEPLOYMENT_SIGNER, 'latest');
      expect(deployerBalance).to.not.eq(0);

      // send transaction to deploy proxy transaction
      const foundryDeterministicDeploymentTransactionHash = await ethersWsProvider.send(METHOD_NAME, [
        constants.FOUNDRY_DETERMINISTIC_DEPLOYER_TRANSACTION,
      ]);

      const receipt = await global.mirrorNode.get(
        `/contracts/results/${foundryDeterministicDeploymentTransactionHash}`,
      );
      const fromAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.from}`);

      expect(receipt).to.exist;
      expect(fromAccountInfo.evm_address).to.eq(constants.FOUDRY_DETERMINISTIC_DEPLOYMENT_SIGNER);
      // notice: the assertion below is currently blocked by the Services
      // expect(receipt.address).to.eq(constants.FOUDRY_DETERMINISTIC_PROXY_CONTRACT);
    });
  });
});
