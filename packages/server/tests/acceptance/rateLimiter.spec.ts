/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2023-2024 Hedera Hashgraph, LLC
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

// External resources
import { expect } from 'chai';
import { ethers } from 'ethers';
import { AliasAccount } from '../types/AliasAccount';

// Assertions and constants from local resources
import Assertions from '../helpers/assertions';
import testConstants from '../../tests/helpers/constants';
import relayConstants from '../../../../packages/relay/src/lib/constants';

// Local resources
import parentContractJson from '../contracts/Parent.json';
import largeContractJson from '../contracts/EstimatePrecompileContract.json';
import { Utils } from '../helpers/utils';
import { predefined } from '@hashgraph/json-rpc-relay';

describe('@ratelimiter Rate Limiters Acceptance Tests', function () {
  this.timeout(480 * 1000); // 480 seconds

  const accounts: AliasAccount[] = [];

  // @ts-ignore
  const { mirrorNode, relay, logger, initialBalance, metrics } = global;

  // cached entities
  let parentContractAddress: string;
  let requestId: string;

  const CHAIN_ID = process.env.CHAIN_ID || 0;
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));
  const TIER_2_RATE_LIMIT =
    (process.env.TIER_2_RATE_LIMIT as unknown as number) || relayConstants.DEFAULT_RATE_LIMIT.TIER_2;
  const LIMIT_DURATION =
    (process.env.LIMIT_DURATION as unknown as number) || relayConstants.DEFAULT_RATE_LIMIT.DURATION;

  describe('RPC Rate Limiter Acceptance Tests', () => {
    it('should throw rate limit exceeded error', async function () {
      const sendMultipleRequests = async () => {
        for (let index = 0; index < TIER_2_RATE_LIMIT * 2; index++) {
          await relay.call(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], requestId);
          // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
          await new Promise((r) => setTimeout(r, 1));
        }
      };

      try {
        await sendMultipleRequests();
        Assertions.expectedError();
      } catch (e) {}

      await new Promise((r) => setTimeout(r, LIMIT_DURATION as number));
    });

    it('should not throw rate limit exceeded error', async function () {
      for (let index = 0; index < TIER_2_RATE_LIMIT; index++) {
        await relay.call(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], requestId);
        // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
        await new Promise((r) => setTimeout(r, 1));
      }

      // wait until rate limit is reset
      await new Promise((r) => setTimeout(r, LIMIT_DURATION));

      for (let index = 0; index < TIER_2_RATE_LIMIT; index++) {
        await relay.call(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], requestId);
        // If we don't wait between calls, the relay can't register so many request at one time. So instead of 200 requests for example, it registers only 5.
        await new Promise((r) => setTimeout(r, 1));
      }

      // wait until rate limit is reset
      await new Promise((r) => setTimeout(r, LIMIT_DURATION));
    });
  });

  // The following tests exhaust the hbar limit, so they should only be run against a local relay
  if (global.relayIsLocal) {
    describe('HBAR Limiter Acceptance Tests', function () {
      const originalOperatorId = process.env.OPERATOR_ID_MAIN;
      const originalOperatorKey = process.env.OPERATOR_KEY_MAIN;
      const originalHbarRateLimit = process.env.HBAR_RATE_LIMIT_TINYBAR;

      before(async () => {
        // Set new env values and restart the relay
        // Make sure the operator is not 0.0.2 because it is exempt from fees
        process.env.OPERATOR_ID_MAIN = process.env.OPERATOR_ID_MAIN_NON_GENESIS;
        process.env.OPERATOR_ID_MAIN = process.env.OPERATOR_KEY_MAIN_NON_GENESIS;

        // Set the limit to a lower value
        process.env.HBAR_RATE_LIMIT_TINYBAR = '3000000000';
        await global.restartLocalRelay();
      });

      after(async () => {
        // Reset original env values
        process.env.OPERATOR_ID_MAIN = originalOperatorId;
        process.env.OPERATOR_ID_MAIN = originalOperatorKey;
        process.env.HBAR_RATE_LIMIT_TINYBAR = originalHbarRateLimit;
      });

      this.timeout(480 * 1000); // 480 seconds

      this.beforeAll(async () => {
        requestId = Utils.generateRequestId();
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);

        logger.info(`${requestIdPrefix} Creating accounts`);
        logger.info(`${requestIdPrefix} HBAR_RATE_LIMIT_TINYBAR: ${process.env.HBAR_RATE_LIMIT_TINYBAR}`);

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

        const parentContract = await Utils.deployContract(
          parentContractJson.abi,
          parentContractJson.bytecode,
          accounts[0].wallet,
        );

        parentContractAddress = parentContract.target as string;
        global.logger.trace(`${requestIdPrefix} Deploy parent contract on address ${parentContractAddress}`);
      });

      this.beforeEach(async () => {
        requestId = Utils.generateRequestId();
      });

      describe('HBAR Rate Limit Tests', () => {
        const defaultGasPrice = Assertions.defaultGasPrice;
        const defaultGasLimit = 3_000_000;

        const defaultLondonTransactionData = {
          value: ONE_TINYBAR,
          chainId: Number(CHAIN_ID),
          maxPriorityFeePerGas: defaultGasPrice,
          maxFeePerGas: defaultGasPrice,
          gasLimit: defaultGasLimit,
          type: 2,
        };

        it('should execute "eth_sendRawTransaction" without triggering HBAR rate limit exceeded', async function () {
          const gasPrice = await relay.gasPrice(requestId);
          const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));

          const transaction = {
            ...defaultLondonTransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[1].address, requestId),
            maxPriorityFeePerGas: gasPrice,
            maxFeePerGas: gasPrice,
          };
          const signedTx = await accounts[1].wallet.signTransaction(transaction);

          await expect(relay.call(testConstants.ETH_ENDPOINTS.ETH_SEND_RAW_TRANSACTION, [signedTx], requestId)).to.be
            .fulfilled;
          const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
          expect(remainingHbarsAfter).to.be.eq(remainingHbarsBefore);
        });

        it('should deploy a large contract and decrease remaining HBAR in limiter when transaction data is large', async function () {
          const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
          expect(remainingHbarsBefore).to.be.gt(0);

          const largeContract = await Utils.deployContract(
            largeContractJson.abi,
            largeContractJson.bytecode,
            accounts[0].wallet,
          );
          await largeContract.waitForDeployment();
          const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
          expect(largeContract.target).to.not.be.null;
          expect(remainingHbarsAfter).to.be.lt(remainingHbarsBefore);
        });

        it('multiple deployments of large contracts should eventually exhaust the remaining hbar limit', async function () {
          const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
          expect(remainingHbarsBefore).to.be.gt(0);
          try {
            for (let i = 0; i < 1000; i++) {
              const largeContract = await Utils.deployContract(
                largeContractJson.abi,
                largeContractJson.bytecode,
                accounts[0].wallet,
              );
              await largeContract.waitForDeployment();
              expect(largeContract.target).to.not.be.null;
            }

            expect(true).to.be.false;
          } catch (e: any) {
            expect(e.message).to.contain(predefined.HBAR_RATE_LIMIT_EXCEEDED.message);
          }

          const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
          expect(remainingHbarsAfter).to.be.lte(0);
        });
      });
    });
  }
});
