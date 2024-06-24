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

// External resources
import { expect } from 'chai';
import { ethers } from 'ethers';
import { AliasAccount } from '../types/AliasAccount';
import { Utils } from '../helpers/utils';
import { FileInfo, FileInfoQuery, TransferTransaction } from '@hashgraph/sdk';

// Assertions from local resources
import Assertions from '../helpers/assertions';

// Local resources from contracts directory
import parentContractJson from '../contracts/Parent.json';
import logsContractJson from '../contracts/Logs.json';
import basicContract from '../../tests/contracts/Basic.json';

// Errors and constants from local resources
import { predefined } from '../../../relay/src/lib/errors/JsonRpcError';
import Constants from '../../../relay/src/lib/constants';
import RelayCalls from '../../tests/helpers/constants';

// Other imports
import { numberTo0x, prepend0x } from '../../../../packages/relay/src/formatters';
import constants from '../../../relay/src/lib/constants';
const Address = RelayCalls;

describe('@api-batch-1 RPC Server Acceptance Tests', function () {
  this.timeout(240 * 1000); // 240 seconds

  const accounts: AliasAccount[] = [];

  // @ts-ignore
  const { servicesNode, mirrorNode, relay, initialBalance } = global;

  // cached entities
  let parentContractAddress: string;
  let mirrorContractDetails;
  let requestId: string;
  let account2Address: string;
  let expectedGasPrice: string;

  const CHAIN_ID = process.env.CHAIN_ID || '0x12a';
  const INCORRECT_CHAIN_ID = 999;
  const GAS_PRICE_TOO_LOW = '0x1';
  const GAS_PRICE_REF = '0x123456';
  const ONE_TINYBAR = Utils.add0xPrefix(Utils.toHex(Constants.TINYBAR_TO_WEIBAR_COEF));
  const sendRawTransaction = relay.sendRawTransaction;

  /**
   * resolves long zero addresses to EVM addresses by querying mirror node
   * @param tx: any - supposedly a proper transaction that has `from` and `to` fields
   * @returns Promise<{from: any|null, to: any|null}>
   */
  const resolveAccountEvmAddresses = async (tx: any) => {
    const fromAccountInfo = await mirrorNode.get(`/accounts/${tx.from}`);
    const toAccountInfo = await mirrorNode.get(`/accounts/${tx.to}`);
    return {
      from: fromAccountInfo?.evm_address ?? tx.from,
      to: toAccountInfo?.evm_address ?? tx.to,
    };
  };

  describe('RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    this.beforeAll(async () => {
      requestId = Utils.generateRequestId();
      const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
      expectedGasPrice = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GAS_PRICE, [], requestId);

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

      const parentContract = await Utils.deployContract(
        parentContractJson.abi,
        parentContractJson.bytecode,
        accounts[0].wallet,
      );
      parentContractAddress = parentContract.target as string;
      global.logger.trace(`${requestIdPrefix} Deploy parent contract on address ${parentContractAddress}`);

      await accounts[0].wallet.sendTransaction({
        to: parentContractAddress,
        value: ethers.parseEther('1'),
      });

      // @ts-ignore
      const createChildTx: ethers.ContractTransactionResponse = await parentContract.createChild(1);

      global.logger.trace(
        `${requestIdPrefix} Contract call createChild on parentContract results in tx hash: ${createChildTx.hash}`,
      );
      // get contract result details
      mirrorContractDetails = await mirrorNode.get(`/contracts/results/${createChildTx.hash}`, requestId);

      mirrorContractDetails.from = accounts[0].address;
      account2Address = accounts[2].address;
    });

    this.beforeEach(async () => {
      requestId = Utils.generateRequestId();
    });

    describe('eth_getLogs', () => {
      let log0Block, log4Block, contractAddress: string, contractAddress2: string, latestBlock, previousTwelveBlocks;

      before(async () => {
        const logsContract = await Utils.deployContract(
          logsContractJson.abi,
          logsContractJson.bytecode,
          accounts[2].wallet,
        );
        const logsContract2 = await Utils.deployContract(
          logsContractJson.abi,
          logsContractJson.bytecode,
          accounts[2].wallet,
        );
        contractAddress = logsContract.target.toString();
        contractAddress2 = logsContract2.target.toString();

        // @ts-ignore
        await logsContract.connect(accounts[1].wallet).log0(1);
        // @ts-ignore
        await logsContract.connect(accounts[1].wallet).log1(1);
        // @ts-ignore
        await logsContract.connect(accounts[1].wallet).log2(1, 1);
        // @ts-ignore
        await logsContract.connect(accounts[1].wallet).log3(1, 1, 1);
        // @ts-ignore
        await logsContract.connect(accounts[1].wallet).log4(1, 1, 1, 1);
        // @ts-ignore
        await logsContract2.connect(accounts[1].wallet).log4(1, 1, 1, 1);

        latestBlock = Number(await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId));
        previousTwelveBlocks = latestBlock - 12;
      });

      it('@release should deploy a contract', async () => {
        //empty params for get logs defaults to latest block, which doesn't have required logs, that's why we fetch the last 12
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: numberTo0x(previousTwelveBlocks),
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );

        expect(logs.length).to.be.greaterThan(0);
        const txIndexLogIndexMapping: any[] = [];
        for (const i in logs) {
          expect(logs[i]).to.have.property('address');
          expect(logs[i]).to.have.property('logIndex');

          const key = `${logs[i].transactionHash}---${logs[i].logIndex}`;
          txIndexLogIndexMapping.push(key);
        }
        const uniqueTxIndexLogIndexMapping = txIndexLogIndexMapping.filter(
          (value, index, self) => self.indexOf(value) === index,
        );
        expect(txIndexLogIndexMapping.length).to.equal(uniqueTxIndexLogIndexMapping.length);

        log0Block = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
          [logs[0].transactionHash],
          requestId,
        );
        const transactionCountLog0Block = await relay.provider.getTransactionCount(
          log0Block.from,
          log0Block.blockNumber,
        );

        log4Block = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
          [logs[logs.length - 1].transactionHash],
          requestId,
        );
        const transactionCountLog4Block = await relay.provider.getTransactionCount(
          log4Block.from,
          log4Block.blockNumber,
        );

        expect(log0Block).to.exist;
        expect(log0Block).to.have.property('blockNumber');

        // nonce is zero based, so we need to subtract 1
        expect(parseInt(log0Block.nonce, 16)).to.equal(transactionCountLog0Block - 1);

        expect(log4Block).to.exist;
        expect(log4Block).to.have.property('blockNumber');

        // nonce is zero based, so we need to subtract 1
        expect(parseInt(log4Block.nonce, 16)).to.equal(transactionCountLog4Block - 1);
      });

      it('should be able to use `fromBlock` param', async () => {
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: log0Block.blockNumber,
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(0);

        const log0BlockInt = parseInt(log0Block.blockNumber);
        for (const i in logs) {
          expect(parseInt(logs[i].blockNumber, 16)).to.be.greaterThanOrEqual(log0BlockInt);
        }
      });

      it('should not be able to use `toBlock` without `fromBlock` param if `toBlock` is not latest', async () => {
        await relay.callFailing(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              toBlock: log0Block.blockNumber,
            },
          ],
          predefined.MISSING_FROM_BLOCK_PARAM,
          requestId,
        );
      });

      it('should be able to use range of `fromBlock` and `toBlock` params', async () => {
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: log0Block.blockNumber,
              toBlock: log4Block.blockNumber,
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(0);

        const log0BlockInt = parseInt(log0Block.blockNumber);
        const log4BlockInt = parseInt(log4Block.blockNumber);
        for (const i in logs) {
          expect(parseInt(logs[i].blockNumber, 16)).to.be.greaterThanOrEqual(log0BlockInt);
          expect(parseInt(logs[i].blockNumber, 16)).to.be.lessThanOrEqual(log4BlockInt);
        }
      });

      it('should be able to use `address` param', async () => {
        //when we pass only address, it defaults to the latest block
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: numberTo0x(previousTwelveBlocks),
              address: contractAddress,
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(0);

        for (const i in logs) {
          expect(logs[i].address.toLowerCase()).to.equal(contractAddress.toLowerCase());
        }
      });

      it('should be able to use `address` param with a large block range', async () => {
        const blockRangeLimit = constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT;
        constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT = 10;
        try {
          //when we pass only address, it defaults to the latest block
          const logs = await relay.call(
            RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
            [
              {
                fromBlock: numberTo0x(latestBlock - constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT - 1),
                address: contractAddress,
              },
            ],
            requestId,
          );
          expect(logs.length).to.be.greaterThan(0);

          for (const i in logs) {
            expect(logs[i].address.toLowerCase()).to.equal(contractAddress.toLowerCase());
          }
        } finally {
          constants.DEFAULT_ETH_GET_LOGS_BLOCK_RANGE_LIMIT = blockRangeLimit;
        }
      });

      it('should be able to use `address` param with multiple addresses', async () => {
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: numberTo0x(previousTwelveBlocks),
              address: [contractAddress, contractAddress2, Address.NON_EXISTING_ADDRESS],
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(0);
        expect(logs.length).to.be.eq(6);

        for (let i = 0; i < 5; i++) {
          expect(logs[i].address.toLowerCase()).to.equal(contractAddress.toLowerCase());
        }

        expect(logs[5].address.toLowerCase()).to.equal(contractAddress2.toLowerCase());
      });

      it('should be able to use `blockHash` param', async () => {
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              blockHash: log0Block.blockHash,
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(0);

        for (const i in logs) {
          expect(logs[i].blockHash).to.equal(log0Block.blockHash);
        }
      });

      it('should return empty result for  non-existing `blockHash`', async () => {
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              blockHash: Address.NON_EXISTING_BLOCK_HASH,
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );
        expect(logs).to.exist;
        expect(logs.length).to.be.eq(0);
      });

      it('should be able to use `topics` param', async () => {
        const logs = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS, [
          {
            fromBlock: log0Block.blockNumber,
            toBlock: log4Block.blockNumber,
            address: [contractAddress, contractAddress2],
          },
        ]);
        expect(logs.length).to.be.greaterThan(0);
        //using second log in array, because the first doesn't contain any topics
        const topic = logs[1].topics[0];

        const logsWithTopic = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: log0Block.blockNumber,
              toBlock: log4Block.blockNumber,
              topics: [topic],
            },
          ],
          requestId,
        );
        expect(logsWithTopic.length).to.be.greaterThan(0);

        for (const i in logsWithTopic) {
          expect(logsWithTopic[i].topics.length).to.be.greaterThan(0);
          expect(logsWithTopic[i].topics[0]).to.be.equal(topic);
        }
      });

      it('should be able to return more than 2 logs with limit of 2 logs per request', async () => {
        //for the purpose of the test, we are settings limit to 2, and fetching all.
        //setting mirror node limit to 2 for this test only
        process.env['MIRROR_NODE_LIMIT_PARAM'] = '2';
        // calculate blocks behind latest, so we can fetch logs from the past.
        // if current block is less than 10, we will fetch logs from the beginning otherwise we will fetch logs from 10 blocks behind latest
        const currentBlock = Number(await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId));
        let blocksBehindLatest = 0;
        if (currentBlock > 10) {
          blocksBehindLatest = currentBlock - 10;
        }
        const logs = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_LOGS,
          [
            {
              fromBlock: numberTo0x(blocksBehindLatest),
              toBlock: 'latest',
              address: [contractAddress, contractAddress2],
            },
          ],
          requestId,
        );
        expect(logs.length).to.be.greaterThan(2);
      });
    });

    describe('Block related RPC calls', () => {
      let mirrorBlock;
      let mirrorContractResults;
      const mirrorTransactions: any[] = [];

      before(async () => {
        mirrorBlock = (await mirrorNode.get(`/blocks?block.number=${mirrorContractDetails.block_number}`, requestId))
          .blocks[0];
        const timestampQuery = `timestamp=gte:${mirrorBlock.timestamp.from}&timestamp=lte:${mirrorBlock.timestamp.to}`;
        mirrorContractResults = (await mirrorNode.get(`/contracts/results?${timestampQuery}`, requestId)).results;

        for (const res of mirrorContractResults) {
          mirrorTransactions.push(
            await mirrorNode.get(`/contracts/${res.contract_id}/results/${res.timestamp}`, requestId),
          );
        }

        // resolve EVM address for `from` and `to`
        for (const mirrorTx of mirrorTransactions) {
          const resolvedAddresses = await resolveAccountEvmAddresses(mirrorTx);

          mirrorTx.from = resolvedAddresses.from;
          mirrorTx.to = resolvedAddresses.to;
        }
      });

      it('should execute "eth_getBlockByHash", hydrated transactions = false', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
          [mirrorBlock.hash.substring(0, 66), false],
          requestId,
        );
        Assertions.block(blockResult, mirrorBlock, mirrorTransactions, expectedGasPrice, false);
      });

      it('@release should execute "eth_getBlockByHash", hydrated transactions = true', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
          [mirrorBlock.hash.substring(0, 66), true],
          requestId,
        );
        // Remove synthetic transactions
        blockResult.transactions = blockResult.transactions.filter((transaction) => transaction.value !== '0x1234');
        Assertions.block(blockResult, mirrorBlock, mirrorTransactions, expectedGasPrice, true);
      });

      it('should execute "eth_getBlockByHash" for non-existing block hash and hydrated transactions = false', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
          [Address.NON_EXISTING_BLOCK_HASH, false],
          requestId,
        );
        expect(blockResult).to.be.null;
      });

      it('should execute "eth_getBlockByHash" for non-existing block hash and hydrated transactions = true', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_HASH,
          [Address.NON_EXISTING_BLOCK_HASH, true],
          requestId,
        );
        expect(blockResult).to.be.null;
      });

      it('should execute "eth_getBlockByNumber", hydrated transactions = false', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
          [numberTo0x(mirrorBlock.number), false],
          requestId,
        );
        // Remove synthetic transactions
        blockResult.transactions = blockResult.transactions.filter((transaction) => transaction.value !== '0x1234');
        Assertions.block(blockResult, mirrorBlock, mirrorTransactions, expectedGasPrice, false);
      });

      it('@release should execute "eth_getBlockByNumber", hydrated transactions = true', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
          [numberTo0x(mirrorBlock.number), true],
          requestId,
        );
        // Remove synthetic transactions
        blockResult.transactions = blockResult.transactions.filter((transaction) => transaction.value !== '0x1234');
        Assertions.block(blockResult, mirrorBlock, mirrorTransactions, expectedGasPrice, true);
      });

      it('should execute "eth_getBlockByNumber" for non existing block number and hydrated transactions = true', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
          [Address.NON_EXISTING_BLOCK_NUMBER, true],
          requestId,
        );
        expect(blockResult).to.be.null;
      });

      it('should execute "eth_getBlockByNumber" for non existing block number and hydrated transactions = false', async function () {
        const blockResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER,
          [Address.NON_EXISTING_BLOCK_NUMBER, false],
          requestId,
        );
        expect(blockResult).to.be.null;
      });

      it('@release should execute "eth_getBlockTransactionCountByNumber"', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
          [numberTo0x(mirrorBlock.number)],
          requestId,
        );
        expect(res).to.be.equal(ethers.toQuantity(mirrorBlock.count));
      });

      it('should execute "eth_getBlockTransactionCountByNumber" for non-existing block number', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_NUMBER,
          [Address.NON_EXISTING_BLOCK_NUMBER],
          requestId,
        );
        expect(res).to.be.null;
      });

      it('@release should execute "eth_getBlockTransactionCountByHash"', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
          [mirrorBlock.hash.substring(0, 66)],
          requestId,
        );
        expect(res).to.be.equal(ethers.toQuantity(mirrorBlock.count));
      });

      it('should execute "eth_getBlockTransactionCountByHash" for non-existing block hash', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_TRANSACTION_COUNT_BY_HASH,
          [Address.NON_EXISTING_BLOCK_HASH],
          requestId,
        );
        expect(res).to.be.null;
      });

      it('should execute "eth_getBlockTransactionCountByNumber"', async function () {
        it('@release should execute "eth_blockNumber"', async function () {
          const mirrorBlocks = await mirrorNode.get(`blocks`, requestId);
          expect(mirrorBlocks).to.have.property('blocks');
          expect(mirrorBlocks.blocks.length).to.gt(0);
          const mirrorBlockNumber = mirrorBlocks.blocks[0].number;

          const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_BLOCK_NUMBER, [], requestId);
          const blockNumber = Number(res);
          expect(blockNumber).to.exist;

          // In some rare occasions, the relay block might be equal to the mirror node block + 1
          // due to the mirror node block updating after it was retrieved and before the relay.call completes
          expect(blockNumber).to.be.oneOf([mirrorBlockNumber, mirrorBlockNumber + 1]);
        });
      });
    });

    describe('Transaction related RPC Calls', () => {
      const defaultGasPrice = numberTo0x(Assertions.defaultGasPrice);
      const defaultGasLimit = numberTo0x(3_000_000);
      const defaultLegacyTransactionData = {
        value: ONE_TINYBAR,
        gasPrice: defaultGasPrice,
        gasLimit: defaultGasLimit,
      };

      const default155TransactionData = {
        ...defaultLegacyTransactionData,
        chainId: Number(CHAIN_ID),
      };

      const defaultLondonTransactionData = {
        value: ONE_TINYBAR,
        chainId: Number(CHAIN_ID),
        maxPriorityFeePerGas: defaultGasPrice,
        maxFeePerGas: defaultGasPrice,
        gasLimit: defaultGasLimit,
        type: 2,
      };

      const defaultLegacy2930TransactionData = {
        value: ONE_TINYBAR,
        chainId: Number(CHAIN_ID),
        gasPrice: defaultGasPrice,
        gasLimit: defaultGasLimit,
        type: 1,
      };

      const gasPriceDeviation = parseFloat(process.env.TEST_GAS_PRICE_DEVIATION ?? '0.2');

      it('@release should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
          [mirrorContractDetails.block_hash.substring(0, 66), numberTo0x(mirrorContractDetails.transaction_index)],
          requestId,
        );
        Assertions.transaction(response, mirrorContractDetails);
      });

      it('should execute "eth_getTransactionByBlockHashAndIndex" for invalid block hash', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
          [Address.NON_EXISTING_BLOCK_HASH, numberTo0x(mirrorContractDetails.transaction_index)],
          requestId,
        );
        expect(response).to.be.null;
      });

      it('should execute "eth_getTransactionByBlockHashAndIndex" for invalid index', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_HASH_AND_INDEX,
          [mirrorContractDetails.block_hash.substring(0, 66), Address.NON_EXISTING_INDEX],
          requestId,
        );
        expect(response).to.be.null;
      });

      it('@release should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
          [numberTo0x(mirrorContractDetails.block_number), numberTo0x(mirrorContractDetails.transaction_index)],
          requestId,
        );
        Assertions.transaction(response, mirrorContractDetails);
      });

      it('should execute "eth_getTransactionByBlockNumberAndIndex" for invalid index', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
          [numberTo0x(mirrorContractDetails.block_number), Address.NON_EXISTING_INDEX],
          requestId,
        );
        expect(response).to.be.null;
      });

      it('should execute "eth_getTransactionByBlockNumberAndIndex" for non-exising block number', async function () {
        const response = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_BLOCK_NUMBER_AND_INDEX,
          [Address.NON_EXISTING_BLOCK_NUMBER, numberTo0x(mirrorContractDetails.transaction_index)],
          requestId,
        );
        expect(response).to.be.null;
      });

      it('@release should execute "eth_getTransactionReceipt" for hash of legacy transaction', async function () {
        const transaction = {
          ...default155TransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
          type: 0,
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const legacyTxHash = await relay.sendRawTransaction(signedTx, requestId);
        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        const mirrorResult = await mirrorNode.get(`/contracts/results/${legacyTxHash}`, requestId);
        mirrorResult.from = accounts[2].wallet.address;
        mirrorResult.to = parentContractAddress;

        const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [legacyTxHash], requestId);
        const currentPrice = await relay.gasPrice(requestId);

        Assertions.transactionReceipt(res, mirrorResult, currentPrice);
      });

      it('@release should execute "eth_getTransactionReceipt" for hash of London transaction', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          ...defaultLondonTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        const mirrorResult = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        mirrorResult.from = accounts[2].wallet.address;
        mirrorResult.to = parentContractAddress;

        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
          [transactionHash],
          requestId,
        );
        const currentPrice = await relay.gasPrice(requestId);

        Assertions.transactionReceipt(res, mirrorResult, currentPrice);
      });

      it('@release should execute "eth_getTransactionReceipt" for hash of 2930 transaction', async function () {
        const transaction = {
          ...defaultLegacy2930TransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        const mirrorResult = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        mirrorResult.from = accounts[2].wallet.address;
        mirrorResult.to = parentContractAddress;

        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
          [transactionHash],
          requestId,
        );
        const currentPrice = await relay.gasPrice(requestId);

        Assertions.transactionReceipt(res, mirrorResult, currentPrice);
      });

      it('@release should fail to execute "eth_getTransactionReceipt" for hash of London transaction', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          ...defaultLondonTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice,
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.INTERNAL_ERROR();

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [
          signedTx + '11',
          requestId,
        ]);
      });

      it('@release should return the right "effectiveGasPrice" for SYNTHETIC HTS transaction', async function () {
        const tokenId = await servicesNode.createToken(1000, requestId);
        await accounts[2].client.associateToken(tokenId, requestId);
        const currentPrice = await relay.gasPrice(requestId);
        const transaction = new TransferTransaction()
          .addTokenTransfer(tokenId, servicesNode._thisAccountId(), -10)
          .addTokenTransfer(tokenId, accounts[2].accountId, 10)
          .setTransactionMemo('Relay test token transfer');
        const resp = await transaction.execute(servicesNode.client);
        await resp.getRecord(servicesNode.client);
        await Utils.wait(1000);
        const logsRes = await mirrorNode.get(`/contracts/results/logs?limit=1`, requestId);
        const blockNumber = logsRes.logs[0].block_number;
        const formattedBlockNumber = prepend0x(blockNumber.toString(16));
        const contractId = logsRes.logs[0].contract_id;
        const transactionHash = logsRes.logs[0].transaction_hash;
        if (contractId !== tokenId.toString()) {
          return;
        }

        // load the block in cache
        await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER, [formattedBlockNumber, true], requestId);
        const receiptFromRelay = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
          [transactionHash],
          requestId,
        );

        // handle deviation in gas price
        expect(parseInt(receiptFromRelay.effectiveGasPrice)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
        expect(parseInt(receiptFromRelay.effectiveGasPrice)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
      });

      it('@release should return the right "effectiveGasPrice" for SYNTHETIC Contract Call transaction', async function () {
        const currentPrice = await relay.gasPrice(requestId);
        const transactionHash = mirrorContractDetails.hash;
        const formattedBlockNumber = prepend0x(mirrorContractDetails.block_number.toString(16));

        // load the block in cache
        await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_BLOCK_BY_NUMBER, [formattedBlockNumber, true], requestId);
        const receiptFromRelay = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
          [transactionHash],
          requestId,
        );

        // handle deviation in gas price
        expect(parseInt(receiptFromRelay.effectiveGasPrice)).to.be.lessThan(currentPrice * (1 + gasPriceDeviation));
        expect(parseInt(receiptFromRelay.effectiveGasPrice)).to.be.greaterThan(currentPrice * (1 - gasPriceDeviation));
      });

      it('should execute "eth_getTransactionReceipt" for non-existing hash', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT,
          [Address.NON_EXISTING_TX_HASH],
          requestId,
        );
        expect(res).to.be.null;
      });

      it('should fail "eth_sendRawTransaction" for transaction with incorrect chain_id', async function () {
        const transaction = {
          ...default155TransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          chainId: INCORRECT_CHAIN_ID,
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.UNSUPPORTED_CHAIN_ID(ethers.toQuantity(INCORRECT_CHAIN_ID), CHAIN_ID);

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
      });

      it('should execute "eth_sendRawTransaction" for deterministic deployment transaction', async function () {
        // send gas money to the proxy deployer
        const sendHbarTx = {
          ...defaultLegacyTransactionData,
          value: (10 * ONE_TINYBAR * 10 ** 8).toString(), // 10hbar - the gasPrice to deploy the deterministic proxy contract
          to: constants.DETERMINISTIC_DEPLOYMENT_SIGNER,
          nonce: await relay.getAccountNonce(accounts[0].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedSendHbarTx = await accounts[0].wallet.signTransaction(sendHbarTx);
        await relay.sendRawTransaction(signedSendHbarTx, requestId);
        await Utils.wait(5000); // wait for signer's account to propagate accross the network
        const deployerBalance = await global.relay.getBalance(constants.DETERMINISTIC_DEPLOYMENT_SIGNER, 'latest');
        expect(deployerBalance).to.not.eq(0);

        // @logic: since the DETERMINISTIC_DEPLOYER_TRANSACTION is a deterministic transaction hash which is signed
        //          by the DETERMINISTIC_DEPLOYMENT_SIGNER with tx.nonce = 0. With that reason, if the current nonce of the signer
        //          is not 0, it means the DETERMINISTIC_DEPLOYER_TRANSACTION has already been submitted, and the DETERMINISTIC_PROXY_CONTRACT
        //          has already been deployed to the network. Therefore, it only matters to test this flow once.
        const signerNonce = await relay.getAccountNonce(constants.DETERMINISTIC_DEPLOYMENT_SIGNER, requestId);

        if (signerNonce === 0) {
          const deployerBalance = await relay.getBalance(
            constants.DETERMINISTIC_DEPLOYMENT_SIGNER,
            'latest',
            requestId,
          );
          expect(deployerBalance).to.not.eq(0);

          // send transaction to deploy proxy transaction
          const deterministicDeployTransactionHash = await relay.sendRawTransaction(
            constants.DETERMINISTIC_DEPLOYER_TRANSACTION,
            requestId,
          );

          const receipt = await mirrorNode.get(`/contracts/results/${deterministicDeployTransactionHash}`, requestId);
          const fromAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.from}`);
          const toAccountInfo = await global.mirrorNode.get(`/accounts/${receipt.to}`);

          expect(receipt).to.exist;
          expect(fromAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_DEPLOYMENT_SIGNER);
          expect(toAccountInfo.evm_address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
          expect(receipt.address).to.eq(constants.DETERMINISTIC_PROXY_CONTRACT);
        } else {
          try {
            await relay.sendRawTransaction(constants.DETERMINISTIC_DEPLOYER_TRANSACTION, requestId);
            expect(true).to.be.false;
          } catch (error) {
            const expectedNonceTooLowError = predefined.NONCE_TOO_LOW(0, signerNonce);
            const errObj = JSON.parse(error.info.responseBody).error;
            expect(errObj.code).to.eq(expectedNonceTooLowError.code);
            expect(errObj.name).to.eq(expectedNonceTooLowError.name);
            expect(errObj.message).to.contain(expectedNonceTooLowError.message);
          }
        }
      });

      it('@release should execute "eth_sendRawTransaction" for legacy EIP 155 transactions', async function () {
        const receiverInitialBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const transaction = {
          ...default155TransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        await Utils.wait(5000);
        await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

        const receiverEndBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const balanceChange = receiverEndBalance - receiverInitialBalance;
        expect(balanceChange.toString()).to.eq(Number(ONE_TINYBAR).toString());
      });

      it('should fail "eth_sendRawTransaction" for legacy EIP 155 transactions (with insufficient balance)', async function () {
        const balanceInWeiBars = await relay.getBalance(account2Address, 'latest', requestId);
        const transaction = {
          ...default155TransactionData,
          to: parentContractAddress,
          value: balanceInWeiBars,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.INSUFFICIENT_ACCOUNT_BALANCE;

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
      });

      it('should execute "eth_sendRawTransaction" for legacy transactions (with no chainId i.e. chainId=0x0)', async function () {
        const receiverInitialBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const transaction = {
          ...defaultLegacyTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        await Utils.wait(5000);
        await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

        const receiverEndBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const balanceChange = receiverEndBalance - receiverInitialBalance;
        expect(balanceChange.toString()).to.eq(Number(ONE_TINYBAR).toString());
      });

      it('should return transaction result with no chainId field for legacy EIP155 transactions  (with no chainId i.e. chainId=0x0)', async function () {
        const transaction = {
          ...defaultLegacyTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[1].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

        const transactionResult = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
          [transactionHash],
          requestId,
        );

        const result = Object.prototype.hasOwnProperty.call(transactionResult, 'chainId');
        expect(result).to.be.false;
      });

      it('should fail "eth_sendRawTransaction" for Legacy transactions (with gas price too low)', async function () {
        const transaction = {
          ...defaultLegacyTransactionData,
          chainId: Number(CHAIN_ID),
          gasPrice: GAS_PRICE_TOO_LOW,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
      });

      it('should not fail "eth_sendRawTransactxion" for Legacy 2930 transactions', async function () {
        const transaction = {
          ...defaultLegacy2930TransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        expect(info).to.exist;
        expect(info.result).to.equal('SUCCESS');
      });

      it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions (with gas price too low)', async function () {
        const transaction = {
          ...defaultLegacy2930TransactionData,
          gasPrice: GAS_PRICE_TOO_LOW,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
      });

      it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions (with insufficient balance)', async function () {
        const balanceInWeiBars = await relay.getBalance(account2Address, 'latest', requestId);
        const transaction = {
          ...defaultLegacy2930TransactionData,
          value: balanceInWeiBars,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          gasPrice: await relay.gasPrice(requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.INSUFFICIENT_ACCOUNT_BALANCE;

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
      });

      it('should fail "eth_sendRawTransaction" for London transactions (with gas price too low)', async function () {
        const transaction = {
          ...defaultLondonTransactionData,
          maxPriorityFeePerGas: GAS_PRICE_TOO_LOW,
          maxFeePerGas: GAS_PRICE_TOO_LOW,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
      });

      it('should fail "eth_sendRawTransaction" for London transactions (with insufficient balance)', async function () {
        const balanceInWeiBars = await relay.getBalance(account2Address, 'latest', requestId);
        const gasPrice = await relay.gasPrice(requestId);

        const transaction = {
          ...defaultLondonTransactionData,
          value: balanceInWeiBars,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.INSUFFICIENT_ACCOUNT_BALANCE;

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
      });

      it('should execute "eth_sendRawTransaction" for London transactions', async function () {
        const receiverInitialBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const gasPrice = await relay.gasPrice(requestId);

        const transaction = {
          ...defaultLondonTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

        // Since the transactionId is not available in this context
        // Wait for the transaction to be processed and imported in the mirror node with axios-retry
        await Utils.wait(5000);

        await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        const receiverEndBalance = await relay.getBalance(parentContractAddress, 'latest', requestId);
        const balanceChange = receiverEndBalance - receiverInitialBalance;
        expect(balanceChange.toString()).to.eq(Number(ONE_TINYBAR).toString());
      });

      it('should execute "eth_sendRawTransaction" and deploy a large contract', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          type: 2,
          chainId: Number(CHAIN_ID),
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: defaultGasLimit,
          data: '0x' + '00'.repeat(5121),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        expect(info).to.have.property('contract_id');
        expect(info.contract_id).to.not.be.null;
        expect(info).to.have.property('created_contract_ids');
        expect(info.created_contract_ids.length).to.be.equal(1);
      });

      // note: according to this ticket https://github.com/hashgraph/hedera-json-rpc-relay/issues/2563,
      //      if calldata's size fails into the range of [2568 bytes, 5217 bytes], the request fails and throw
      //      `Null Entity ID` error. This unit test makes sure that with the new fix, requests should work with all case scenarios.
      it('should execute "eth_sendRawTransaction" and deploy a contract with any arbitrary calldata size', async () => {
        const gasPrice = await relay.gasPrice(requestId);

        const randomBytes = [2566, 2568, 3600, 5217, 7200];

        for (const bytes of randomBytes) {
          const transaction = {
            type: 2,
            chainId: Number(CHAIN_ID),
            nonce: await relay.getAccountNonce(accounts[0].address, requestId),
            maxPriorityFeePerGas: gasPrice,
            maxFeePerGas: gasPrice,
            gasLimit: defaultGasLimit,
            data: '0x' + '00'.repeat(bytes),
          };
          const signedTx = await accounts[0].wallet.signTransaction(transaction);
          const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
          const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
          expect(info).to.have.property('contract_id');
          expect(info.contract_id).to.not.be.null;
          expect(info).to.have.property('created_contract_ids');
          expect(info.created_contract_ids.length).to.be.equal(1);
          await new Promise((r) => setTimeout(r, 3000));
        }
      });

      it('should delete the file created while execute "eth_sendRawTransaction" to deploy a large contract', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          type: 2,
          chainId: Number(CHAIN_ID),
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: defaultGasLimit,
          data: '0x' + '00'.repeat(5121),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);

        await Utils.wait(1000);
        const txInfo = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

        const contractResult = await mirrorNode.get(`/contracts/${txInfo.contract_id}`);
        const fileInfo = await new FileInfoQuery().setFileId(contractResult.file_id).execute(servicesNode.client);
        expect(fileInfo).to.exist;
        expect(fileInfo instanceof FileInfo).to.be.true;
        expect(fileInfo.isDeleted).to.be.true;
        expect(fileInfo.size.toNumber()).to.eq(0);
      });

      it('should execute "eth_sendRawTransaction" and fail when deploying too large contract', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          type: 2,
          chainId: Number(CHAIN_ID),
          nonce: await relay.getAccountNonce(accounts[1].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: defaultGasLimit,
          data: '0x' + '00'.repeat(132221),
        };

        const signedTx = await accounts[1].wallet.signTransaction(transaction);
        const error = predefined.TRANSACTION_SIZE_TOO_BIG('132320', String(constants.SEND_RAW_TRANSACTION_SIZE_LIMIT));

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
      });

      it('should execute "eth_sendRawTransaction" of type 1 and deploy a real contract', async function () {
        //omitting the "to" and "nonce" fields when creating a new contract
        const transaction = {
          ...defaultLegacy2930TransactionData,
          value: 0,
          data: basicContract.bytecode,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        expect(info).to.have.property('contract_id');
        expect(info.contract_id).to.not.be.null;
        expect(info).to.have.property('created_contract_ids');
        expect(info.created_contract_ids.length).to.be.equal(1);
        expect(info.max_fee_per_gas).to.eq('0x');
        expect(info.max_priority_fee_per_gas).to.eq('0x');
        expect(info).to.have.property('access_list');
      });

      it('should execute "eth_sendRawTransaction" of type 2 and deploy a real contract', async function () {
        //omitting the "to" and "nonce" fields when creating a new contract
        const transaction = {
          ...defaultLondonTransactionData,
          value: 0,
          data: basicContract.bytecode,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        expect(info).to.have.property('contract_id');
        expect(info.contract_id).to.not.be.null;
        expect(info).to.have.property('max_fee_per_gas');
        expect(info).to.have.property('max_priority_fee_per_gas');
        expect(info).to.have.property('created_contract_ids');
        expect(info.created_contract_ids.length).to.be.equal(1);
        expect(info).to.have.property('type');
        expect(info.type).to.be.equal(2);
        expect(info).to.have.property('access_list');
      });

      it('should execute "eth_sendRawTransaction" and deploy a contract with more than 2 HBAR transaction fee and less than max transaction fee', async function () {
        const balanceBefore = await relay.getBalance(accounts[2].wallet.address, 'latest', requestId);

        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          type: 2,
          chainId: Number(CHAIN_ID),
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: Constants.BLOCK_GAS_LIMIT,
          data: '0x' + '00'.repeat(40000),
        };

        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const info = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);
        const balanceAfter = await relay.getBalance(accounts[2].wallet.address, 'latest', requestId);
        expect(info).to.have.property('contract_id');
        expect(info.contract_id).to.not.be.null;
        expect(info).to.have.property('created_contract_ids');
        expect(info.created_contract_ids.length).to.be.equal(1);
        const diffInHbars =
          BigInt(balanceBefore - balanceAfter) / BigInt(Constants.TINYBAR_TO_WEIBAR_COEF) / BigInt(100_000_000);
        expect(Number(diffInHbars)).to.be.greaterThan(2);
        expect(Number(diffInHbars)).to.be.lessThan(
          (gasPrice * Constants.BLOCK_GAS_LIMIT) / Constants.TINYBAR_TO_WEIBAR_COEF / 100_000_000,
        );
      });

      it('should execute "eth_sendRawTransaction" and deploy a contract with more than max transaction fee', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          type: 2,
          chainId: Number(CHAIN_ID),
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
          gasLimit: Constants.BLOCK_GAS_LIMIT,
          data: '0x' + '00'.repeat(60000),
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const error = predefined.INTERNAL_ERROR();

        await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
      });

      describe('Prechecks', async function () {
        it('should fail "eth_sendRawTransaction" for transaction with incorrect chain_id', async function () {
          const transaction = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            chainId: INCORRECT_CHAIN_ID,
          };
          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.UNSUPPORTED_CHAIN_ID('0x3e7', CHAIN_ID);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
        });

        it('should fail "eth_sendRawTransaction" for EIP155 transaction with not enough gas', async function () {
          const gasLimit = 100;
          const transaction = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            gasLimit: gasLimit,
            gasPrice: await relay.gasPrice(requestId),
          };

          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.GAS_LIMIT_TOO_LOW(gasLimit, Constants.BLOCK_GAS_LIMIT);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
        });

        it('should fail "eth_sendRawTransaction" for EIP155 transaction with a too high gasLimit', async function () {
          const gasLimit = 999999999;
          const transaction = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            gasLimit: gasLimit,
            gasPrice: await relay.gasPrice(requestId),
          };

          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.GAS_LIMIT_TOO_HIGH(gasLimit, Constants.BLOCK_GAS_LIMIT);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
        });

        it('should fail "eth_sendRawTransaction" for London transaction with not enough gas', async function () {
          const gasLimit = 100;
          const transaction = {
            ...defaultLondonTransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            gasLimit: gasLimit,
          };
          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.GAS_LIMIT_TOO_LOW(gasLimit, Constants.BLOCK_GAS_LIMIT);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
        });

        it('should fail "eth_sendRawTransaction" for London transaction with a too high gasLimit', async function () {
          const gasLimit = 999999999;
          const transaction = {
            ...defaultLondonTransactionData,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
            gasLimit: gasLimit,
          };
          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.GAS_LIMIT_TOO_HIGH(gasLimit, Constants.BLOCK_GAS_LIMIT);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
        });

        it('should fail "eth_sendRawTransaction" for legacy EIP 155 transactions (with gas price too low)', async function () {
          const transaction = {
            ...default155TransactionData,
            gasPrice: GAS_PRICE_TOO_LOW,
            to: parentContractAddress,
            nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          };
          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.GAS_PRICE_TOO_LOW(GAS_PRICE_TOO_LOW, GAS_PRICE_REF);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, false, relay, [signedTx, requestId]);
        });

        it('@release fail "eth_getTransactionReceipt" on precheck with wrong nonce error when sending a tx with the same nonce twice', async function () {
          const nonce = await relay.getAccountNonce(accounts[2].address, requestId);
          const transaction = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: nonce,
            maxFeePerGas: await relay.gasPrice(requestId),
          };

          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const txHash1 = await relay.sendRawTransaction(signedTx, requestId);
          const mirrorResult = await mirrorNode.get(`/contracts/results/${txHash1}`, requestId);
          mirrorResult.from = accounts[2].wallet.address;
          mirrorResult.to = parentContractAddress;

          const res = await relay.call(RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_RECEIPT, [txHash1], requestId);
          const currentPrice = await relay.gasPrice(requestId);
          Assertions.transactionReceipt(res, mirrorResult, currentPrice);
          const error = predefined.NONCE_TOO_LOW(nonce, nonce + 1);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
        });

        it('@release fail "eth_getTransactionReceipt" on precheck with wrong nonce error when sending a tx with a higher nonce', async function () {
          const nonce = await relay.getAccountNonce(accounts[2].address, requestId);

          const transaction = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: nonce + 100,
            gasPrice: await relay.gasPrice(requestId),
          };

          const signedTx = await accounts[2].wallet.signTransaction(transaction);
          const error = predefined.NONCE_TOO_HIGH(nonce + 100, nonce);

          await Assertions.assertPredefinedRpcError(error, sendRawTransaction, true, relay, [signedTx, requestId]);
        });

        it('@release fail "eth_getTransactionReceipt" on submitting with wrong nonce error when sending a tx with the same nonce twice', async function () {
          const nonce = await relay.getAccountNonce(accounts[2].address, requestId);

          const transaction1 = {
            ...default155TransactionData,
            to: parentContractAddress,
            nonce: nonce,
            maxFeePerGas: await relay.gasPrice(requestId),
          };

          const signedTx1 = await accounts[2].wallet.signTransaction(transaction1);

          await Promise.all([
            Promise.allSettled([
              relay.sendRawTransaction(signedTx1, requestId),
              relay.sendRawTransaction(signedTx1, requestId),
            ]).then((values) => {
              const fulfilled = values.find((obj) => obj.status === 'fulfilled');
              const rejected = values.find((obj) => obj.status === 'rejected');

              expect(fulfilled).to.exist;
              expect(fulfilled).to.have.property('value');
              expect(rejected).to.exist;
              expect(rejected).to.have.property('reason');

              Assertions.jsonRpcError(
                // @ts-ignore
                rejected?.reason?.response?.bodyJson?.error,
                predefined.NONCE_TOO_LOW(nonce, nonce + 1),
              );
            }),
          ]);
        });
      });

      it('@release should execute "eth_getTransactionByHash" for existing transaction', async function () {
        const gasPrice = await relay.gasPrice(requestId);
        const transaction = {
          ...defaultLondonTransactionData,
          to: parentContractAddress,
          nonce: await relay.getAccountNonce(accounts[2].address, requestId),
          maxPriorityFeePerGas: gasPrice,
          maxFeePerGas: gasPrice,
        };
        const signedTx = await accounts[2].wallet.signTransaction(transaction);
        const transactionHash = await relay.sendRawTransaction(signedTx, requestId);
        const mirrorTransaction = await mirrorNode.get(`/contracts/results/${transactionHash}`, requestId);

        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
          [transactionHash],
          requestId,
        );
        const addressResult = await mirrorNode.get(`/accounts/${res.from}`, requestId);
        mirrorTransaction.from = addressResult.evm_address;

        Assertions.transaction(res, mirrorTransaction);
      });

      it('should execute "eth_getTransactionByHash" for non-existing transaction and return null', async function () {
        const res = await relay.call(
          RelayCalls.ETH_ENDPOINTS.ETH_GET_TRANSACTION_BY_HASH,
          [Address.NON_EXISTING_TX_HASH],
          requestId,
        );
        expect(res).to.be.null;
      });
    });
  });
});
