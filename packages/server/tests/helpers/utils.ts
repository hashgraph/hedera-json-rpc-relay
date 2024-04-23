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

import { ethers } from 'ethers';
import Assertions from './assertions';
import crypto from 'crypto';
import RelayClient from '../clients/relayClient';
import { numberTo0x } from '../../../relay/src/formatters';
import RelayCall from '../../tests/helpers/constants';
import { AccountId, KeyList, PrivateKey } from '@hashgraph/sdk';
import { AliasAccount } from '../types/AliasAccount';
import ServicesClient from '../clients/servicesClient';

export class Utils {
  /**
   * Converts a number to its hexadecimal representation.
   *
   * @param {number} num The number to convert to hexadecimal.
   * @returns {string} The hexadecimal representation of the number.
   */
  static toHex = (num) => {
    return parseInt(num).toString(16);
  };

  /**
   * Converts a given Hedera account ID to an EVM compatible address.
   *
   * @param {string} id The Hedera account ID to convert.
   * @returns {string} The EVM compatible address.
   */
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

  /**
   * Converts a value from tinybars to weibars.
   *
   * @param {number} value The value in tinybars to convert.
   * @returns {ethers.BigNumber} The value converted to weibars.
   */
  static tinyBarsToWeibars = (value) => {
    return ethers.parseUnits(Number(value).toString(), 10);
  };

  /**
   * Generates a random string of the specified length.
   *
   * @param {number} length The length of the random string to generate.
   * @returns {string} The generated random string.
   */
  static randomString(length) {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generates a random trace ID for requests.
   *
   * @returns {string} The generated random trace ID.
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

  /**
   * Deploys a contract using the provided ABI and bytecode.
   *
   * @param {ethers.InterfaceAbi} abi The ABI of the contract.
   * @param {string} bytecode The bytecode of the contract.
   * @param {ethers.Wallet} signer The wallet used to sign the deployment transaction.
   * @returns {Promise<ethers.Contract>} A promise resolving to the deployed contract.
   */
  static readonly deployContract = async (
    abi: ethers.InterfaceAbi,
    bytecode: string,
    signer: ethers.Wallet,
  ): Promise<ethers.Contract> => {
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    return contract as ethers.Contract;
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
  /**
   * Creates an alias account on the mirror node with the provided details.
   *
   * @param {MirrorClient} mirrorNode The mirror node client.
   * @param {AliasAccount} creator The creator account for the alias.
   * @param {string} requestId The unique identifier for the request.
   * @param {string} balanceInWeiBars The initial balance for the alias account in wei bars. Defaults to 10 HBAR (10,000,000,000,000,000,000 wei).
   * @returns {Promise<AliasAccount>} A promise resolving to the created alias account.
   */
  static readonly createAliasAccount = async (
    mirrorNode,
    creator: AliasAccount,
    requestId: string,
    balanceInTinyBar: string = '1000000000', //10 HBAR
  ): Promise<AliasAccount> => {
    const signer = creator.wallet;
    const accountBalance = Utils.tinyBarsToWeibars(balanceInTinyBar);
    const privateKey = PrivateKey.generateECDSA();
    const wallet = new ethers.Wallet(privateKey.toStringRaw(), signer.provider);
    const address = wallet.address;

    // create hollow account
    await signer.sendTransaction({
      to: wallet.address,
      value: accountBalance,
    });

    const mirrorNodeAccount = (await mirrorNode.get(`/accounts/${address}`, requestId)).account;
    const accountId = AccountId.fromString(mirrorNodeAccount);
    const client: ServicesClient = new ServicesClient(
      process.env.HEDERA_NETWORK!,
      accountId.toString(),
      privateKey.toStringDer(),
      creator.client.getLogger(),
    );

    const account: AliasAccount = {
      alias: accountId,
      accountId,
      address: wallet.address,
      client: client,
      privateKey,
      wallet,
      keyList: KeyList.from([privateKey]),
    };

    return account;
  };

  static async createMultipleAliasAccounts(
    mirrorNode,
    initialAccount: AliasAccount,
    neededAccounts: number,
    initialAmountInTinyBar: string,
    requestId: string,
  ): Promise<AliasAccount[]> {
    const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
    const accounts: AliasAccount[] = [];
    for (let i = 0; i < neededAccounts; i++) {
      const account = await Utils.createAliasAccount(mirrorNode, initialAccount, requestId, initialAmountInTinyBar);
      global.logger.trace(
        `${requestIdPrefix} Create new Eth compatible account w privateKey: ${account.privateKey}, alias: ${account.address} and balance ~${initialAmountInTinyBar} wei`,
      );
      accounts.push(account);
    }
    return accounts;
  }
}
