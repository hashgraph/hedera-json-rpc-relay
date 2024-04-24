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
import { predefined } from '@hashgraph/json-rpc-relay/src';
import constants from '@hashgraph/json-rpc-relay/src/lib/constants';
import { numberTo0x } from '@hashgraph/json-rpc-relay/src/formatters';
import { Utils } from '@hashgraph/json-rpc-server/tests/helpers/utils';
import { AliasAccount } from '@hashgraph/json-rpc-server/tests/types/AliasAccount';
import { ONE_TINYBAR_IN_WEI_HEX } from '@hashgraph/json-rpc-relay/tests/lib/eth/eth-config';

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
  const { mirrorNode, relay } = global;
  const initialBalance = '5000000000'; // 50hbar

  let tx: any,
    sendHbarToProxyContractDeployerTx: any,
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

    sendHbarToProxyContractDeployerTx = {
      value: (10 * 10 ** 18).toString(), // 10hbar - the gasPrice to deploy deterministic proxy contract
      to: constants.DETERMINISTIC_DEPLOYMENT_SIGNER,
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

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.STANDARD_WEB_SOCKET} for the deterministic deployment transaction`, async () => {
      // send gas money to the proxy deployer
      sendHbarToProxyContractDeployerTx.nonce = await global.relay.getAccountNonce(accounts[0].address);
      const signedSendHbarTx = await accounts[0].wallet.signTransaction(sendHbarToProxyContractDeployerTx);
      await WsTestHelper.sendRequestToStandardWebSocket(METHOD_NAME, [signedSendHbarTx], 1000);
      await new Promise((r) => setTimeout(r, 5000)); // wait for signer's account to propagate accross the network
      const deployerBalance = await global.relay.getBalance(constants.DETERMINISTIC_DEPLOYMENT_SIGNER, 'latest');
      expect(deployerBalance).to.not.eq(0);

      // @logic: since the DETERMINISTIC_DEPLOYER_TRANSACTION is a deterministic transaction hash which is signed
      //          by the DETERMINISTIC_DEPLOYMENT_SIGNER with tx.nonce = 0. With that reason, if the current nonce of the signer
      //          is not 0, it means the DETERMINISTIC_DEPLOYER_TRANSACTION has already been submitted, and the DETERMINISTIC_PROXY_CONTRACT
      //          has already been deployed to the network. Therefore, it only matters to test this flow once.
      const signerNonce = await global.relay.getAccountNonce(constants.DETERMINISTIC_DEPLOYMENT_SIGNER);

      if (signerNonce === 0) {
        // send transaction to deploy proxy transaction
        const deterministicDeploymentTransactionHash = await WsTestHelper.sendRequestToStandardWebSocket(
          METHOD_NAME,
          [constants.DETERMINISTIC_DEPLOYER_TRANSACTION],
          1000,
        );

        const receipt = await global.mirrorNode.get(
          `/contracts/results/${deterministicDeploymentTransactionHash.result}`,
        );
        const fromAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.from}`);
        const toAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.to}`);

        expect(receipt).to.exist;
        expect(fromAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_DEPLOYMENT_SIGNER);
        expect(toAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
        expect(receipt.address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
      } else {
        const response = await WsTestHelper.sendRequestToStandardWebSocket(
          METHOD_NAME,
          [constants.DETERMINISTIC_DEPLOYER_TRANSACTION],
          1000,
        );
        const expectedNonceTooLowError = predefined.NONCE_TOO_LOW(0, signerNonce);
        const errObj = response.result;
        expect(errObj.code).to.eq(expectedNonceTooLowError.code);
        expect(errObj.name).to.eq(expectedNonceTooLowError.name);
        expect(errObj.message).to.contain(expectedNonceTooLowError.message);
      }
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

    it(`Should execute ${METHOD_NAME} on ${WsTestConstant.ETHERS_WS_PROVIDER} for the deterministic deployment transaction`, async () => {
      // send gas money to the proxy deployer
      sendHbarToProxyContractDeployerTx.nonce = await global.relay.getAccountNonce(accounts[1].address);
      const signedSendHbarTx = await accounts[1].wallet.signTransaction(sendHbarToProxyContractDeployerTx);
      await ethersWsProvider.send(METHOD_NAME, [signedSendHbarTx]);
      await new Promise((r) => setTimeout(r, 5000)); // wait for signer's account to propagate accross the network
      const deployerBalance = await global.relay.getBalance(constants.DETERMINISTIC_DEPLOYMENT_SIGNER, 'latest');
      expect(deployerBalance).to.not.eq(0);

      // @logic: since the DETERMINISTIC_DEPLOYER_TRANSACTION is a deterministic transaction hash which is signed
      //          by the DETERMINISTIC_DEPLOYMENT_SIGNER with tx.nonce = 0. With that reason, if the current nonce of the signer
      //          is not 0, it means the DETERMINISTIC_DEPLOYER_TRANSACTION has already been submitted, and the DETERMINISTIC_PROXY_CONTRACT
      //          has already been deployed to the network. Therefore, it only matters to test this flow once.
      const signerNonce = await global.relay.getAccountNonce(constants.DETERMINISTIC_DEPLOYMENT_SIGNER);

      if (signerNonce === 0) {
        // send transaction to deploy proxy transaction
        const deterministicDeploymentTransactionHash = await ethersWsProvider.send(METHOD_NAME, [
          constants.DETERMINISTIC_DEPLOYER_TRANSACTION,
        ]);

        const receipt = await global.mirrorNode.get(`/contracts/results/${deterministicDeploymentTransactionHash}`);
        const fromAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.from}`);
        const toAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.to}`);

        expect(receipt).to.exist;
        expect(fromAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_DEPLOYMENT_SIGNER);
        expect(toAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
        expect(receipt.address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
      } else {
        const errObj = await ethersWsProvider.send(METHOD_NAME, [constants.DETERMINISTIC_DEPLOYER_TRANSACTION]);
        const expectedNonceTooLowError = predefined.NONCE_TOO_LOW(0, signerNonce);
        expect(errObj.code).to.eq(expectedNonceTooLowError.code);
        expect(errObj.name).to.eq(expectedNonceTooLowError.name);
        expect(errObj.message).to.contain(expectedNonceTooLowError.message);
      }
    });
  });
});
