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

import { ethers } from 'ethers';
import Assertions from './assertions';
import crypto from 'crypto';
import RelayClient from '../clients/relayClient';
import { numberTo0x } from '../../../relay/src/formatters';
import RelayCall from '../../tests/helpers/constants';
import { AccountId, KeyList, PrivateKey } from '@hashgraph/sdk';
import { AliasAccount } from '../types/AliasAccount';
import ServicesClient from '../clients/servicesClient';
import http from 'http';
import { GCProfiler, setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';
import { Context } from 'mocha';
import { writeSnapshot } from 'heapdump';
import path from 'path';
import { GitHubClient } from '../clients/githubClient';
import MirrorClient from '../clients/mirrorClient';

export class Utils {
  static readonly PROJECT_ROOT_PATH = path.resolve('../..');
  static readonly TOTAL_HEAP_SIZE_MEMORY_LEAK_THRESHOLD: number = 100e6; // 100 MB
  static readonly MEMORY_LEAK_SNAPSHOT_THRESHOLD: number = 1e6; // 1 MB

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
   * @param {string} balanceInTinyBar The initial balance for the alias account in tiny bars. Defaults to 10 HBAR.
   * @returns {Promise<AliasAccount>} A promise resolving to the created alias account.
   */
  static readonly createAliasAccount = async (
    mirrorNode: MirrorClient,
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
    mirrorNode: MirrorClient,
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

  static sendJsonRpcRequestWithDelay(
    host: string,
    port: number,
    method: string,
    params: any[],
    delayMs: number,
  ): Promise<any> {
    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: 1,
    });

    const options = {
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
      },
      timeout: delayMs,
    };

    return new Promise((resolve, reject) => {
      // setup the request
      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      });

      // handle request errors for testing purposes
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after ${delayMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      // Introduce a delay with inactivity, before sending the request
      setTimeout(async () => {
        req.write(requestData);
        req.end();
        await new Promise((r) => setTimeout(r, delayMs + 1000));
      }, delayMs);
    });
  }

  static async wait(time: number): Promise<void> {
    await new Promise((r) => setTimeout(r, time));
  }

  static async writeHeapSnapshotAsync(): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      writeSnapshot((error, fileName) => {
        if (error) {
          reject(error);
        }
        console.info(`Heap snapshot written to ${fileName}`);
        resolve(fileName);
      });
    });
  }

  /**
   * Captures memory leaks in the test suite.
   * The function will start the profiler before each test and stop it after each test.
   * If a memory leak is detected, the function will log the difference in memory usage.
   */
  static captureMemoryLeaks(profiler: GCProfiler): void {
    setFlagsFromString('--expose_gc');
    // TODO: Used for debugging, remove this as its cluttering the logs with traces from the garbage collector
    setFlagsFromString('--trace_gc');
    const gc = runInNewContext('gc');
    const githubClient = new GitHubClient();

    beforeEach(function () {
      profiler.start();
    });

    afterEach(async function (this: Context) {
      this.timeout(60000);
      await gc(); // force a garbage collection to get accurate memory usage
      try {
        const result = profiler.stop();
        const statsGrowingHeapSize = result.statistics.filter((stats) => {
          return stats.afterGC.heapStatistics.totalHeapSize > stats.beforeGC.heapStatistics.totalHeapSize;
        });
        const isPotentialMemoryLeak = statsGrowingHeapSize.some((stats) => {
          return stats.afterGC.heapStatistics.totalHeapSize > Utils.TOTAL_HEAP_SIZE_MEMORY_LEAK_THRESHOLD;
        });

        if (isPotentialMemoryLeak) {
          console.warn('Potential memory leak detected!');
          const totalDiffBytes = statsGrowingHeapSize.reduce((acc, stats) => {
            const diff = stats.afterGC.heapStatistics.totalHeapSize - stats.beforeGC.heapStatistics.totalHeapSize;
            return acc + diff;
          }, 0);
          const statsDiff = statsGrowingHeapSize.map((stats) => ({
            gcType: stats.gcType,
            cost: stats.cost,
            diffGC: {
              heapStatistics: Utils.difference(stats.afterGC.heapStatistics, stats.beforeGC.heapStatistics),
              heapSpaceStatistics: Utils.difference(
                stats.afterGC.heapSpaceStatistics,
                stats.beforeGC.heapSpaceStatistics,
              ),
            },
          }));
          console.error(
            `Memory leak of ${Utils.formatBytes(totalDiffBytes)}: --> ` + JSON.stringify(statsDiff, null, 2),
          );
          // add comment on PR highlighting after which test the memory leak is happening
          await githubClient.addCommentToPullRequest(
            `Memory leak detected in test: ${this.currentTest?.title}\n
            Details: ${JSON.stringify(statsDiff, null, 2)}`,
            this.test?.file ? path.relative(Utils.PROJECT_ROOT_PATH, this.test?.file) : '',
          );
          // write a heap snapshot if the memory leak is more than 1 MB
          const isMemoryLeakSnapshotEnabled = process.env.WRITE_SNAPSHOT_ON_MEMORY_LEAK === 'true';
          if (isMemoryLeakSnapshotEnabled && totalDiffBytes > Utils.MEMORY_LEAK_SNAPSHOT_THRESHOLD) {
            console.info('Writing heap snapshot...');
            await Utils.writeHeapSnapshotAsync();
          }
        }
      } catch (error) {
        console.error('Error capturing memory leaks:', error);
      }
    });
  }

  /**
   * Calculates the difference between two objects or arrays of objects.
   * This utility method is used to calculate the difference in heap statistics before and after GC.
   * @param after The object representing the state after an operation.
   * @param before The object representing the state before the operation.
   * @returns The difference between the two states.
   */
  static difference<T extends number | string | object | object[]>(after: T, before: T): T {
    if (Array.isArray(after) && Array.isArray(before)) {
      return this.arrayDifference(after, before);
    } else if (typeof after === 'object' && typeof before === 'object') {
      return this.objectDifference(after, before);
    } else if (typeof after === 'number' && typeof before === 'number') {
      return (after - before) as T;
    } else if (typeof after === 'string' && typeof before === 'string') {
      if (after !== before) {
        throw new Error(`Mismatched values: ${after} is not equal to ${before}`);
      }
      return after as T;
    } else {
      throw new Error('Invalid input: both parameters must be objects or arrays of objects');
    }
  }

  /**
   * Calculates the difference between two objects
   * @param after
   * @param before
   */
  private static objectDifference<T extends object>(after: T, before: T): T {
    const diff = { ...after };
    for (const key of Object.keys(after)) {
      if (!(key in before)) {
        throw new Error(`Mismatched properties: ${key} is not present in both objects`);
      }
      diff[key] = this.difference(after[key], before[key]);
    }
    return diff as T;
  }

  /**
   * Calculates the difference between two arrays of objects
   * @param after
   * @param before
   */
  private static arrayDifference<T extends object[]>(after: T, before: T): T {
    return after.map((item: object, index: number) => this.difference(item, before[index])) as T;
  }

  /**
   * Formats bytes into a readable string.
   * @param {number} bytes The number of bytes.
   * @returns {string} A formatted string representing the size in bytes, KB, MB, GB, or TB.
   */
  private static formatBytes(bytes: number): string {
    const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
    let power = Math.floor(Math.log(bytes) / Math.log(1000));
    power = Math.min(power, units.length - 1);
    const size = bytes / Math.pow(1000, power);
    return `${size.toFixed(2)} ${units[power]}`;
  }
}
