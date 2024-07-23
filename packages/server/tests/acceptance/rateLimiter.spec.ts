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
import { BaseContract, ethers } from 'ethers';
import { AliasAccount } from '../types/AliasAccount';
import { JsonRpcError, predefined } from '@hashgraph/json-rpc-relay';
import { Suite } from 'mocha';

// Assertions and constants from local resources
import Assertions from '../helpers/assertions';
import testConstants from '../../tests/helpers/constants';
import relayConstants from '../../../../packages/relay/src/lib/constants';

// Local resources
import parentContractJson from '../contracts/Parent.json';
import EstimateGasContract from '../contracts/EstimateGasContract.json';
import largeContractJson from '../contracts/EstimatePrecompileContract.json';
import largeSizeContract from '../contracts/hbarLimiterContracts/largeSizeContract.json';
import mediumSizeContract from '../contracts/hbarLimiterContracts/mediumSizeContract.json';
import { Utils } from '../helpers/utils';

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
    const sendMultipleRequests = async (method: string, params: any[], threshold: number) => {
      for (let index = 0; index < threshold; index++) {
        await relay.call(method, params, requestId);
        // If we don't wait between calls, the relay can't register so many request at one time.
        // So instead of 200 requests for example, it registers only 5.
        await new Promise((r) => setTimeout(r, 1));
      }
    };

    describe(`Given requests exceeding the Tier 2 rate limit`, function () {
      const aboveThreshold: number = TIER_2_RATE_LIMIT * 2;

      afterEach(async () => {
        // wait until rate limit is reset
        await new Promise((r) => setTimeout(r, LIMIT_DURATION as number));
      });

      it(`should throw rate limit exceeded error for ${testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID}`, async function () {
        try {
          await sendMultipleRequests(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], aboveThreshold);
          Assertions.expectedError();
        } catch (ignored) {}
      });
    });

    describe(`Given requests within the Tier 2 rate limit`, function () {
      const belowThreshold: number = TIER_2_RATE_LIMIT;

      afterEach(async function () {
        // wait until rate limit is reset
        await new Promise((r) => setTimeout(r, LIMIT_DURATION as number));
      });

      it(`should not throw rate limit exceeded error for ${testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID}`, async function () {
        await sendMultipleRequests(testConstants.ETH_ENDPOINTS.ETH_CHAIN_ID, [null], belowThreshold);
      });
    });
  });

  // The following tests exhaust the hbar limit, so they should only be run against a local relay
  if (global.relayIsLocal) {
    describe('HBAR Limiter Acceptance Tests', function () {
      before(async () => {
        // Restart the relay to reset the limits
        await global.restartLocalRelay();
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
          expect(remainingHbarsAfter).to.be.lt(remainingHbarsBefore);
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
            for (let i = 0; i < 50; i++) {
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

        it('should be able to deploy a contract without creating file', async function () {
          // This flow should not spend any hbars from the operator, as it's fully paid by the signer
          expect(
            await Utils.deployContract(EstimateGasContract.abi, EstimateGasContract.bytecode, accounts[0].wallet),
          ).to.be.instanceOf(BaseContract);
        });

        it('should be able to deploy a medium size contract with fileCreate', async function () {
          // This flow should spend hbars from the operator, for fileCreate
          expect(
            await Utils.deployContract(mediumSizeContract.abi, mediumSizeContract.bytecode, accounts[0].wallet),
          ).to.be.instanceOf(BaseContract);
        });

        it('should fail to deploy a larger size contract with fileCreate and fileAppend due to hbar limit exceeded', async function () {
          // This flow should not allow spending hbars from the operator, for fileCreate operation and fileAppend operation
          try {
            await Utils.deployContract(largeSizeContract.abi, largeSizeContract.bytecode, accounts[0].wallet);
            expect(true).to.be.false;
          } catch (e) {
            expect(e.message).to.contain(predefined.HBAR_RATE_LIMIT_EXCEEDED.message);
          }
        });
      });
    });
  }
});
