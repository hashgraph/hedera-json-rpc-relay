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

import { predefined } from '@hashgraph/json-rpc-relay';
import { BaseContract, ethers } from 'ethers';
import { expect } from 'chai';

// Local resources
import { Utils } from '../helpers/utils';
import { AliasAccount } from '../types/AliasAccount';
import Assertions from '../helpers/assertions';
import testConstants from '../helpers/constants';

// Contracts used in tests
import parentContractJson from '../contracts/Parent.json';
import EstimateGasContract from '../contracts/EstimateGasContract.json';
import largeContractJson from '../contracts/hbarLimiterContracts/largeSizeContract.json';
import mediumSizeContract from '../contracts/hbarLimiterContracts/mediumSizeContract.json';

describe('@hbarlimiter HBAR Limiter Acceptance Tests', function () {
  const CHAIN_ID = process.env.CHAIN_ID || 0;
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10)));

  const accounts: AliasAccount[] = [];

  // @ts-ignore
  const { mirrorNode, relay, logger, initialBalance, metrics, relayIsLocal } = global;

  // The following tests exhaust the hbar limit, so they should only be run against a local relay
  if (relayIsLocal) {
    describe('HBAR Rate Limit Tests', function () {
      this.timeout(480 * 1000); // 480 seconds

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

      // cached entities
      let requestId: string;
      let requestIdPrefix: string;

      before(async function () {
        // Restart the relay to reset the limits
        await global.restartLocalRelay();

        requestId = Utils.generateRequestId();
        requestIdPrefix = Utils.formatRequestIdMessage(requestId);

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
      });

      beforeEach(async function () {
        requestId = Utils.generateRequestId();
        requestIdPrefix = Utils.formatRequestIdMessage(requestId);
      });

      it('should execute "eth_sendRawTransaction" without triggering HBAR rate limit exceeded', async function () {
        const parentContract = await Utils.deployContract(
          parentContractJson.abi,
          parentContractJson.bytecode,
          accounts[0].wallet,
        );

        const parentContractAddress = parentContract.target as string;
        global.logger.trace(`${requestIdPrefix} Deploy parent contract on address ${parentContractAddress}`);

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
          expect.fail(`Expected an error but nothing was thrown`);
        } catch (e: any) {
          expect(e.message).to.contain(predefined.HBAR_RATE_LIMIT_EXCEEDED.message);
        }

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsAfter).to.be.lte(0);
      });

      it('should be able to deploy a medium size contract with fileCreate', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);

        // This flow should spend hbars from the operator, for fileCreate
        const contract = await Utils.deployContract(
          mediumSizeContract.abi,
          mediumSizeContract.bytecode,
          accounts[0].wallet,
        );
        expect(contract).to.be.instanceOf(BaseContract);
        await contract.waitForDeployment();

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(contract.target).to.not.be.null;
        expect(remainingHbarsAfter).to.be.lt(remainingHbarsBefore);
      });

      it('should be able to deploy a contract without creating file', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);

        // This flow should not spend any hbars from the operator, as it's fully paid by the signer
        const contract = await Utils.deployContract(
          EstimateGasContract.abi,
          EstimateGasContract.bytecode,
          accounts[0].wallet,
        );
        expect(contract).to.be.instanceOf(BaseContract);
        await contract.waitForDeployment();

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(contract.target).to.not.be.null;
        expect(remainingHbarsAfter).to.be.lt(remainingHbarsBefore);
      });
    });
  }
});
