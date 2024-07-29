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
  // @ts-ignore
  const { mirrorNode, relay, logger, initialBalance, metrics, relayIsLocal } = global;

  // The following tests exhaust the hbar limit, so they should only be run against a local relay
  if (relayIsLocal) {
    const deployContract = async (contractJson: any, wallet: ethers.Wallet): Promise<ethers.Contract> => {
      const contract = await Utils.deployContract(contractJson.abi, contractJson.bytecode, wallet);
      expect(contract).to.be.instanceOf(BaseContract);
      await contract.waitForDeployment();
      expect(contract.target).to.not.be.null;
      return contract;
    };

    const verifyRemainingLimit = (expectedCost: number, remainingHbarsBefore: number, remainingHbarsAfter: number) => {
      const delta = 0.001 * expectedCost; // 0.1% tolerance
      global.logger.trace(`Expected cost: ${expectedCost} ±${delta}`);
      global.logger.trace(`Actual cost: ${remainingHbarsBefore - remainingHbarsAfter}`);
      expect(remainingHbarsAfter).to.be.approximately(remainingHbarsBefore - expectedCost, delta);
    };

    const sumAccountTransfers = (transfers: any, account?: string) => {
      return transfers
        .filter((transfer) => transfer.account === account)
        .reduce((acc, transfer) => acc + transfer.amount, 0);
    };

    describe('HBAR Rate Limit Tests', function () {
      this.timeout(480 * 1000); // 480 seconds

      const accounts: AliasAccount[] = [];
      const defaultLondonTransactionData = {
        value: Utils.add0xPrefix(Utils.toHex(ethers.parseUnits('1', 10))), // 1 tinybar
        chainId: Number(process.env.CHAIN_ID || 0),
        maxPriorityFeePerGas: Assertions.defaultGasPrice,
        maxFeePerGas: Assertions.defaultGasPrice,
        gasLimit: 3_000_000,
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
        const parentContract = await deployContract(parentContractJson, accounts[0].wallet);
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
        const expectedCost = 44732838;
        verifyRemainingLimit(expectedCost, remainingHbarsBefore, remainingHbarsAfter);
      });

      it('should deploy a large contract and decrease remaining HBAR in limiter when transaction data is large', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);

        await deployContract(largeContractJson, accounts[0].wallet);

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        const expectedCost = 570177621;
        verifyRemainingLimit(expectedCost, remainingHbarsBefore, remainingHbarsAfter);
      });

      it('should be able to deploy a contract without creating file', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);

        // This flow should not spend any hbars from the operator, as it's fully paid by the signer
        await deployContract(EstimateGasContract, accounts[0].wallet);

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        const expectedCost = 83131926;
        verifyRemainingLimit(expectedCost, remainingHbarsBefore, remainingHbarsAfter);
      });

      it('should be able to deploy a medium size contract with fileCreate', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);

        // This flow should spend hbars from the operator, for fileCreate
        await deployContract(mediumSizeContract, accounts[0].wallet);

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        const expectedCost = 331926551;
        verifyRemainingLimit(expectedCost, remainingHbarsBefore, remainingHbarsAfter);
      });

      it('HBAR limiter is updated within acceptable tolerance range in relation to actual spent amount by the relay operator', async function () {
        const TOLERANCE = 0.01;
        await new Promise((r) => setTimeout(r, 3000));
        const operatorAccount = process.env.OPERATOR_ID_MAIN;
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);
        const operatorBalanceBefore = (await mirrorNode.get(`/accounts/${operatorAccount}`, requestId)).balance.balance;
        const largeContract = await deployContract(largeContractJson, accounts[0].wallet);

        const operatorBalanceAfter = (await mirrorNode.get(`/accounts/${operatorAccount}`, requestId)).balance.balance;

        const amountPaidByOperator = operatorBalanceBefore - operatorBalanceAfter;

        // Calculate all fees based on transaction records in the mirror node
        const fileCreateTx = (
          await mirrorNode.get(
            `/transactions?transactiontype=FILECREATE&order=desc&account.id=${operatorAccount}&limit=1`,
            requestId,
          )
        ).transactions[0];
        const fileCreateTimestamp = fileCreateTx.consensus_timestamp;
        const fileAppendTxs = (
          await mirrorNode.get(
            `/transactions?order=desc&transactiontype=FILEAPPEND&account.id=${operatorAccount}&timestamp=gt:${fileCreateTimestamp}`,
            requestId,
          )
        ).transactions;

        const fileAppendChunkSize = Number(process.env.FILE_APPEND_CHUNK_SIZE) || 5120;

        // The first chunk goes in with FileCreateTransaciton, the rest are FileAppendTransactions
        const expectedChunks = Math.ceil(largeContract.deploymentTransaction().data.length / fileAppendChunkSize) - 1;
        expect(fileAppendTxs.length).to.eq(expectedChunks);

        const ethereumTransaction = (
          await mirrorNode.get(
            `/transactions?transactiontype=ETHEREUMTRANSACTION&order=desc&account.id=${operatorAccount}&limit=1`,
            requestId,
          )
        ).transactions[0];

        const fileCreateFee = sumAccountTransfers(fileCreateTx.transfers, operatorAccount);
        const fileAppendFee = fileAppendTxs.reduce((total, data) => {
          const sum = sumAccountTransfers(data.transfers, operatorAccount);
          return total + sum;
        }, 0);

        const ethTxFee = sumAccountTransfers(ethereumTransaction.transfers, operatorAccount);
        const totalOperatorFees = Math.abs(fileCreateFee + fileAppendFee + ethTxFee);
        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        const hbarLimitReducedAmount = remainingHbarsBefore - remainingHbarsAfter;

        expect(remainingHbarsAfter).to.be.lt(remainingHbarsBefore);
        Assertions.expectWithinTolerance(amountPaidByOperator, hbarLimitReducedAmount, TOLERANCE);
        Assertions.expectWithinTolerance(amountPaidByOperator, totalOperatorFees, TOLERANCE);
      });

      it('multiple deployments of large contracts should eventually exhaust the remaining hbar limit', async function () {
        const remainingHbarsBefore = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsBefore).to.be.gt(0);
        try {
          for (let i = 0; i < 50; i++) {
            await deployContract(largeContractJson, accounts[0].wallet);
          }
          expect.fail(`Expected an error but nothing was thrown`);
        } catch (e: any) {
          expect(e.message).to.contain(predefined.HBAR_RATE_LIMIT_EXCEEDED.message);
        }

        const remainingHbarsAfter = Number(await metrics.get(testConstants.METRICS.REMAINING_HBAR_LIMIT));
        expect(remainingHbarsAfter).to.be.lte(0);
      });
    });
  }
});
