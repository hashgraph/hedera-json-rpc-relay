/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
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

import { ContractFactory, ethers } from 'ethers';
import { AliasAccount } from '../clients/servicesClient';
import Assertions from './assertions';
import crypto from 'crypto';
import RelayClient from '../clients/relayClient';
import RelayCall from '../../tests/helpers/constants';
import Constants from './constants';
import { numberTo0x } from '../../../relay/src/formatters';

export class Utils {
  static toHex = (num) => {
    return parseInt(num).toString(16);
  };

  static idToEvmAddress = (id): string => {
    Assertions.assertId(id);
    const [shard, realm, num] = id.split('.');

    return [
      '0x',
      this.toHex(shard).padStart(8, '0'),
      this.toHex(realm).padStart(16, '0'),
      this.toHex(num).padStart(16, '0'),
    ].join('');
  };

  static tinyBarsToWeibars = (value) => {
    return ethers.parseUnits(Number(value).toString(), 10);
  };

  static randomString(length) {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generates random trace id for requests.
   *
   * returns: string
   */
  static generateRequestId = (): string => {
    return crypto.randomUUID();
  };

  /**
   * Format message prefix for logger.
   */
  static formatRequestIdMessage = (requestId?: string): string => {
    return requestId ? `[Request ID: ${requestId}]` : '';
  };

  static deployContractWithEthers = async (constructorArgs: any[] = [], contractJson, wallet, relay) => {
    const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
    let contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();

    // re-init the contract with the deployed address
    const receipt = await relay.provider.getTransactionReceipt(contract.deploymentTransaction()?.hash);
    contract = new ethers.Contract(receipt.to, contractJson.abi, wallet);

    return contract;
  };

  // The main difference between this and deployContractWithEthers is that this does not re-init the contract with the deployed address
  // and that results in the contract address coming in EVM Format instead of LongZero format
  static deployContractWithEthersV2 = async (constructorArgs: any[] = [], contractJson, wallet) => {
    const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet);
    const contract = await factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    // no need to re-init the contract with the deployed address
    return contract;
  };

  static createHTS = async (
    tokenName,
    symbol,
    adminAccount,
    initialSupply,
    abi,
    associatedAccounts,
    owner,
    servicesNode,
    requestId,
  ) => {
    const htsResult = await servicesNode.createHTS({
      tokenName,
      symbol,
      treasuryAccountId: adminAccount.accountId.toString(),
      initialSupply,
      adminPrivateKey: adminAccount.privateKey,
    });

    // Associate and approve token for all accounts
    for (const account of associatedAccounts) {
      await servicesNode.associateHTSToken(
        account.accountId,
        htsResult.receipt.tokenId,
        account.privateKey,
        htsResult.client,
        requestId,
      );
      await servicesNode.approveHTSToken(account.accountId, htsResult.receipt.tokenId, htsResult.client, requestId);
    }

    // Setup initial balance of token owner account
    await servicesNode.transferHTSToken(
      owner.accountId,
      htsResult.receipt.tokenId,
      initialSupply,
      htsResult.client,
      requestId,
    );
    const evmAddress = Utils.idToEvmAddress(htsResult.receipt.tokenId.toString());
    return new ethers.Contract(evmAddress, abi, owner.wallet);
  };

  static add0xPrefix = (num) => {
    return num.startsWith('0x') ? num : '0x' + num;
  };

  static gasOptions = async (requestId, gasLimit = 1_500_000) => {
    return {
      gasLimit: gasLimit,
      gasPrice: await global.relay.gasPrice(requestId),
    };
  };

  static convertEthersResultIntoStringsArray = (res) => {
    if (typeof res === 'object') {
      return res.toArray().map((e) => Utils.convertEthersResultIntoStringsArray(e));
    }
    return res.toString();
  };

  static ethCallWRetries = async (
    relay: RelayClient,
    callData: { from: string; to: any; gas: string; data: string },
    blockNumber: string,
    requestId: string,
  ): Promise<string> => {
    let numberOfCalls = 0;
    let res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, blockNumber], requestId);
    while (res === '0x' && numberOfCalls < 3) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await relay.call(RelayCall.ETH_ENDPOINTS.ETH_CALL, [callData, blockNumber], requestId);
      numberOfCalls++;
    }
    return res;
  };

  // Handles the odd case where the contract is loading in the factory but for some reason
  // ethers is not able to deploy it.  The ethers deploy returns a 4001 error.
  static deployContract = async (contractFactory: ContractFactory): Promise<ethers.Contract> => {
    let deployRan = false;
    let numberOfAttempts = 0;
    let contract;
    while (!deployRan && numberOfAttempts < 3) {
      try {
        contract = await contractFactory.deploy(Constants.GAS.LIMIT_15_000_000);
        await contract.waitForDeployment();
      } catch (e) {
        await new Promise((r) => setTimeout(r, 1000));
        numberOfAttempts++;
        continue;
      }
      deployRan = true;
    }

    return contract;
  };

  static sendTransaction = async (
    ONE_TINYBAR: any,
    CHAIN_ID: string | number,
    accounts: AliasAccount[],
    rpcServer: any,
    requestId: any,
    mirrorNodeServer: any,
  ) => {
    const transaction = {
      value: ONE_TINYBAR,
      gasLimit: numberTo0x(30000),
      chainId: Number(CHAIN_ID),
      to: accounts[1].address,
      nonce: await rpcServer.getAccountNonce(accounts[0].address, requestId),
      maxFeePerGas: await rpcServer.gasPrice(requestId),
    };

    const signedTx = await accounts[0].wallet.signTransaction(transaction);
    const transactionHash = await rpcServer.sendRawTransaction(signedTx, requestId);

    await mirrorNodeServer.get(`/contracts/results/${transactionHash}`, requestId);

    return await rpcServer.call(RelayCall.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [transactionHash], requestId);
  };
}
