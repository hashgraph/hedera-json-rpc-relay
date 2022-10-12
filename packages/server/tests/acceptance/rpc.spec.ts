/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022 Hedera Hashgraph, LLC
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
import { BigNumber, ethers } from 'ethers';
import { AliasAccount } from '../clients/servicesClient';
import Assertions from '../helpers/assertions';
import { Utils } from '../helpers/utils';
import { ContractFunctionParameters } from '@hashgraph/sdk';
import TokenCreateJson from '../contracts/TokenCreateContract.json';

// local resources
import parentContractJson from '../contracts/Parent.json';
import basicContractJson from '../contracts/Basic.json';
import reverterContractJson from '../contracts/Reverter.json';
import logsContractJson from '../contracts/Logs.json';
import { predefined } from '../../../relay/src/lib/errors/JsonRpcError';
import { EthImpl } from '@hashgraph/json-rpc-relay/src/lib/eth';
import constants from '@hashgraph/json-rpc-relay/src/lib/constants';

describe('@api RPC Server Acceptance Tests', function () {
    this.timeout(240 * 1000); // 240 seconds

    const accounts: AliasAccount[] = [];

    // @ts-ignore
    const { servicesNode, mirrorNode, relay, logger } = global;

    // cached entities
    let tokenId;
    let contractId;
    let contractExecuteTimestamp;
    let mirrorContract;
    let mirrorContractDetails;
    let mirrorPrimaryAccount;
    let mirrorSecondaryAccount;

    const CHAIN_ID = process.env.CHAIN_ID || 0;
    const INCORRECT_CHAIN_ID = 999;
    const GAS_PRICE_TOO_LOW = 1;
    const ONE_TINYBAR = ethers.utils.parseUnits('1', 10);
    const ONE_WEIBAR = ethers.utils.parseUnits('1', 18);

    const NON_EXISTING_ADDRESS = '0x5555555555555555555555555555555555555555';
    const NON_EXISTING_TX_HASH = '0x5555555555555555555555555555555555555555555555555555555555555555';
    const NON_EXISTING_BLOCK_HASH = '0x555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555555';
    const NON_EXISTING_BLOCK_NUMBER = 99999999;
    const NON_EXISTING_INDEX = 999999;
    const BASIC_CONTRACT_PING_CALL_DATA = '0x5c36b186';
    const BASIC_CONTRACT_PING_RESULT = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const EXCHANGE_RATE_FILE_ID = "0.0.112";
    const EXCHANGE_RATE_FILE_CONTENT_DEFAULT = "0a1008b0ea0110f9bb1b1a0608f0cccf9306121008b0ea0110e9c81a1a060880e9cf9306";
    const FEE_SCHEDULE_FILE_ID = "0.0.111";
    const FEE_SCHEDULE_FILE_CONTENT_DEFAULT = "0a280a0a08541a061a04408888340a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200"; // Eth gas = 853000
    const FEE_SCHEDULE_FILE_CONTENT_UPDATED = "0a280a0a08541a061a0440a8953a0a0a08061a061a0440889d2d0a0a08071a061a0440b0b63c120208011200"; // Eth gas = 953000

    describe('RPC Server Acceptance Tests', function () {
        this.timeout(240 * 1000); // 240 seconds

        this.beforeAll(async () => {
            accounts[0] = await servicesNode.createAliasAccount(15);
            accounts[1] = await servicesNode.createAliasAccount(15);
            accounts[2] = await servicesNode.createAliasAccount(30);
            accounts[3] = await servicesNode.createAliasAccount(60, relay.provider);
            contractId = await accounts[0].client.createParentContract(parentContractJson);

            const params = new ContractFunctionParameters().addUint256(1);
            contractExecuteTimestamp = (await accounts[0].client
                .executeContractCall(contractId, 'createChild', params)).contractExecuteTimestamp;
            tokenId = await servicesNode.createToken();
            logger.info('Associate and transfer tokens');
            await accounts[0].client.associateToken(tokenId);
            await accounts[1].client.associateToken(tokenId);
            await servicesNode.transferToken(tokenId, accounts[0].accountId);
            await servicesNode.transferToken(tokenId, accounts[1].accountId);

            // alow mirror node a 2 full record stream write windows (2 sec) and a buffer to persist setup details
            await new Promise(r => setTimeout(r, 5000));

            // get contract details
            mirrorContract = await mirrorNode.get(`/contracts/${contractId}`);

            // get contract result details
            mirrorContractDetails = await mirrorNode.get(`/contracts/${contractId}/results/${contractExecuteTimestamp}`);

            mirrorPrimaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[0].accountId}`)).accounts[0];
            mirrorSecondaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[1].accountId}`)).accounts[0];
        });

        describe('eth_getLogs', () => {

            let log0Block, log4Block, contractAddress;

            it('@release should deploy a contract', async () => {
                const logsContract = await servicesNode.deployContract(logsContractJson);
                const mirrorNodeResp = await mirrorNode.get(`/contracts/${logsContract.contractId}`);
                expect(mirrorNodeResp).to.have.property('evm_address');
                expect(mirrorNodeResp.env_address).to.not.be.null;
                contractAddress = mirrorNodeResp.evm_address;

                const params = new ContractFunctionParameters().addUint256(1);
                const log0 = await accounts[1].client.executeContractCall(logsContract.contractId, 'log0', params);
                await accounts[1].client.executeContractCall(logsContract.contractId, 'log1', params);

                params.addUint256(1);
                await accounts[1].client.executeContractCall(logsContract.contractId, 'log2', params);

                params.addUint256(1);
                await accounts[1].client.executeContractCall(logsContract.contractId, 'log3', params);

                params.addUint256(1);
                const log4 = await accounts[1].client.executeContractCall(logsContract.contractId, 'log4', params);

                await new Promise(r => setTimeout(r, 5000));

                const logs = await relay.call('eth_getLogs', [{}]);
                expect(logs.length).to.be.greaterThan(0);
                const txIndexLogIndexMapping: any[] = [];
                for (const i in logs) {
                    expect(logs[i]).to.have.property('address');
                    expect(logs[i]).to.have.property('logIndex');

                    // verify logIndex represents index in block across transactions
                    expect(logs[i].logIndex).to.equal(ethers.utils.hexValue(Number(i)));

                    const key = `${logs[i].transactionHash}---${logs[i].logIndex}`;
                    txIndexLogIndexMapping.push(key);
                }
                const uniqueTxIndexLogIndexMapping = txIndexLogIndexMapping.filter((value, index, self) =>
                    self.indexOf(value) === index
                );
                expect(txIndexLogIndexMapping.length).to.equal(uniqueTxIndexLogIndexMapping.length);

                log0Block = await relay.call('eth_getTransactionByHash', [log0.contractExecutedTransactionId]);
                expect(log0Block).to.have.property('blockNumber');
                expect(log0Block.nonce).to.equal('0x0');

                log4Block = await relay.call('eth_getTransactionByHash', [log4.contractExecutedTransactionId]);
                expect(log4Block).to.have.property('blockNumber');
                expect(log4Block.nonce).to.equal('0x0');
            });

            it('should be able to use `fromBlock` param', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'fromBlock': log4Block.blockNumber
                }]);
                expect(logs.length).to.be.greaterThan(0);

                const log4BlockInt = parseInt(log4Block.blockNumber);
                for (let i in logs) {
                    expect(parseInt(logs[i].blockNumber, 16)).to.be.greaterThanOrEqual(log4BlockInt);
                }
            });

            it('should be able to use `toBlock` param', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'toBlock': log0Block.blockNumber
                }]);
                expect(logs.length).to.be.greaterThan(0);

                const log0BlockInt = parseInt(log0Block.blockNumber);
                for (let i in logs) {
                    expect(parseInt(logs[i].blockNumber, 16)).to.be.lessThanOrEqual(log0BlockInt);
                }
            });

            it('should be able to use range of `fromBlock` and `toBlock` params', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'fromBlock': log0Block.blockNumber,
                    'toBlock': log4Block.blockNumber
                }]);
                expect(logs.length).to.be.greaterThan(0);

                const log0BlockInt = parseInt(log0Block.blockNumber);
                const log4BlockInt = parseInt(log4Block.blockNumber);
                for (let i in logs) {
                    expect(parseInt(logs[i].blockNumber, 16)).to.be.greaterThanOrEqual(log0BlockInt);
                    expect(parseInt(logs[i].blockNumber, 16)).to.be.lessThanOrEqual(log4BlockInt);
                }
            });

            it('should be able to use `address` param', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'address': contractAddress
                }]);
                expect(logs.length).to.be.greaterThan(0);

                for (let i in logs) {
                    expect(logs[i].address).to.equal(contractAddress);
                }
            });

            it('should be able to use `blockHash` param', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'blockHash': log0Block.blockHash
                }]);
                expect(logs.length).to.be.greaterThan(0);

                for (let i in logs) {
                    expect(logs[i].blockHash).to.equal(log0Block.blockHash);
                }
            });

            it('should return empty result for  non-existing `blockHash`', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'blockHash': NON_EXISTING_BLOCK_HASH
                }]);
                expect(logs).to.exist;
                expect(logs.length).to.be.eq(0);
            });

            it('should be able to use `topics` param', async () => {
                const logs = await relay.call('eth_getLogs', [{
                    'fromBlock': log0Block.blockNumber,
                    'toBlock': log4Block.blockNumber,
                }]);
                expect(logs.length).to.be.greaterThan(0);
                const topic = logs[0].topics[0];

                const logsWithTopic = await relay.call('eth_getLogs', [{
                    'fromBlock': log0Block.blockNumber,
                    'toBlock': log4Block.blockNumber,
                    'topics': [logs[0].topics[0]]
                }]);
                expect(logsWithTopic.length).to.be.greaterThan(0);

                for (let i in logsWithTopic) {
                    expect(logsWithTopic[i].topics.length).to.be.greaterThan(0);
                    expect(logsWithTopic[i].topics[0]).to.be.equal(topic);
                }
            });
        });

        describe('Block related RPC calls', () => {

            let mirrorBlock;
            let mirrorContractResults;
            const mirrorTransactions: any[] = [];

            before(async () => {
                mirrorBlock = (await mirrorNode.get(`/blocks?block.number=${mirrorContractDetails.block_number}`)).blocks[0];
                const timestampQuery = `timestamp=gte:${mirrorBlock.timestamp.from}&timestamp=lte:${mirrorBlock.timestamp.to}`;
                mirrorContractResults = (await mirrorNode.get(`/contracts/results?${timestampQuery}`)).results;

                for (let i = 0; i < mirrorContractResults.length; i++) {
                    const res = mirrorContractResults[i];
                    mirrorTransactions.push((await mirrorNode.get(`/contracts/${res.contract_id}/results/${res.timestamp}`)));
                }

            });

            it('should execute "eth_getBlockByHash", hydrated transactions not specified', async function () {
                const blockResult = await relay.call('eth_getBlockByHash', [mirrorBlock.hash]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, false);
            });

            it('should execute "eth_getBlockByHash", hydrated transactions = false', async function () {
                const blockResult = await relay.call('eth_getBlockByHash', [mirrorBlock.hash, false]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, false);
            });

            it('@release should execute "eth_getBlockByHash", hydrated transactions = true', async function () {
                const blockResult = await relay.call('eth_getBlockByHash', [mirrorBlock.hash, true]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, true);
            });

            it('should execute "eth_getBlockByHash" for non-existing block hash and hydrated transactions = false', async function () {
                const blockResult = await relay.call('eth_getBlockByHash', [NON_EXISTING_BLOCK_HASH, false]);
                expect(blockResult).to.be.null;
            });

            it('should execute "eth_getBlockByHash" for non-existing block hash and hydrated transactions = true', async function () {
                const blockResult = await relay.call('eth_getBlockByHash', [NON_EXISTING_BLOCK_HASH, true]);
                expect(blockResult).to.be.null;
            });

            it('should execute "eth_getBlockByNumber", hydrated transactions not specified', async function () {
                const blockResult = await relay.call('eth_getBlockByNumber', [mirrorBlock.number]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, false);
            });

            it('should execute "eth_getBlockByNumber", hydrated transactions = false', async function () {
                const blockResult = await relay.call('eth_getBlockByNumber', [mirrorBlock.number, false]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, false);
            });

            it('@release should execute "eth_getBlockByNumber", hydrated transactions = true', async function () {
                const blockResult = await relay.call('eth_getBlockByNumber', [mirrorBlock.number, true]);
                Assertions.block(blockResult, mirrorBlock, mirrorTransactions, true);
            });

            it('should execute "eth_getBlockByNumber" for non existing block number and hydrated transactions = true', async function () {
                const blockResult = await relay.call('eth_getBlockByNumber', [NON_EXISTING_BLOCK_NUMBER, true]);
                expect(blockResult).to.be.null;
            });

            it('should execute "eth_getBlockByNumber" for non existing block number and hydrated transactions = false', async function () {
                const blockResult = await relay.call('eth_getBlockByNumber', [NON_EXISTING_BLOCK_NUMBER, false]);
                expect(blockResult).to.be.null;
            });

            it('@release should execute "eth_getBlockTransactionCountByNumber"', async function () {
                const res = await relay.call('eth_getBlockTransactionCountByNumber', [mirrorBlock.number]);
                expect(res).to.be.equal(ethers.utils.hexValue(mirrorBlock.count));
            });

            it('should execute "eth_getBlockTransactionCountByNumber" for non-existing block number', async function () {
                const res = await relay.call('eth_getBlockTransactionCountByNumber', [NON_EXISTING_BLOCK_NUMBER]);
                expect(res).to.be.null;
            });

            it('@release should execute "eth_getBlockTransactionCountByHash"', async function () {
                const res = await relay.call('eth_getBlockTransactionCountByHash', [mirrorBlock.hash]);
                expect(res).to.be.equal(ethers.utils.hexValue(mirrorBlock.count));
            });

            it('should execute "eth_getBlockTransactionCountByHash" for non-existing block hash', async function () {
                const res = await relay.call('eth_getBlockTransactionCountByHash', [NON_EXISTING_BLOCK_HASH]);
                expect(res).to.be.null;
            });

            it('should execute "eth_getBlockTransactionCountByNumber"', async function () {

                it('@release should execute "eth_blockNumber"', async function () {

                    const mirrorBlocks = await mirrorNode.get(`blocks`);
                    expect(mirrorBlocks).to.have.property('blocks');
                    expect(mirrorBlocks.blocks.length).to.gt(0);
                    const mirrorBlockNumber = mirrorBlocks.blocks[0].number;

                    const res = await relay.call('eth_blockNumber', []);
                    const blockNumber = Number(res);
                    expect(blockNumber).to.exist;

                    // In some rare occasions, the relay block might be equal to the mirror node block + 1
                    // due to the mirror node block updating after it was retrieved and before the relay.call completes
                    expect(blockNumber).to.be.oneOf([mirrorBlockNumber, mirrorBlockNumber + 1]);
                });
            });

            describe('Transaction related RPC Calls', () => {
                const defaultGasPrice = Assertions.defaultGasPrice;
                const defaultGasLimit = 3_000_000;
                const defaultLegacyTransactionData = {
                    value: ONE_TINYBAR,
                    gasPrice: defaultGasPrice,
                    gasLimit: defaultGasLimit
                };

                const default155TransactionData = {
                    ...defaultLegacyTransactionData,
                    chainId: Number(CHAIN_ID)
                };

                const defaultLondonTransactionData = {
                    value: ONE_TINYBAR,
                    chainId: Number(CHAIN_ID),
                    maxPriorityFeePerGas: defaultGasPrice,
                    maxFeePerGas: defaultGasPrice,
                    gasLimit: defaultGasLimit,
                    type: 2
                };

                const defaultLegacy2930TransactionData = {
                    value: ONE_TINYBAR,
                    chainId: Number(CHAIN_ID),
                    gasPrice: defaultGasPrice,
                    gasLimit: defaultGasLimit,
                    type: 1
                };

                it('@release should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
                    const response = await relay.call('eth_getTransactionByBlockHashAndIndex',
                        [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]);
                    Assertions.transaction(response, mirrorContractDetails);
                });

                it('should execute "eth_getTransactionByBlockHashAndIndex" for invalid block hash', async function () {
                    const response = await relay.call('eth_getTransactionByBlockHashAndIndex',
                        [NON_EXISTING_BLOCK_HASH, mirrorContractDetails.transaction_index]);
                    expect(response).to.be.null;
                });

                it('should execute "eth_getTransactionByBlockHashAndIndex" for invalid index', async function () {
                    const response = await relay.call('eth_getTransactionByBlockHashAndIndex',
                        [mirrorContractDetails.block_hash, NON_EXISTING_INDEX]);
                    expect(response).to.be.null;
                });

                it('@release should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
                    const response = await relay.call('eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]);
                    Assertions.transaction(response, mirrorContractDetails);
                });

                it('should execute "eth_getTransactionByBlockNumberAndIndex" for invalid index', async function () {
                    const response = await relay.call('eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, NON_EXISTING_INDEX]);
                    expect(response).to.be.null;
                });

                it('should execute "eth_getTransactionByBlockNumberAndIndex" for non-exising block number', async function () {
                    const response = await relay.call('eth_getTransactionByBlockNumberAndIndex', [NON_EXISTING_BLOCK_NUMBER, mirrorContractDetails.transaction_index]);
                    expect(response).to.be.null;
                });

                it('@release should execute "eth_getTransactionReceipt" for hash of legacy transaction', async function () {
                    const transaction = {
                        ...default155TransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };

                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const legacyTxHash = await relay.sendRawTransaction(signedTx);
                    // Since the transactionId is not available in this context
                    // Wait for the transaction to be processed and imported in the mirror node with axios-retry
                    const mirrorResult = await mirrorNode.get(`/contracts/results/${legacyTxHash}`);

                    const res = await relay.call('eth_getTransactionReceipt', [legacyTxHash]);
                    // FIXME here we must assert that the alias address is the `from` / `to` and not the `0x` prefixed one
                    Assertions.transactionReceipt(res, mirrorResult);
                });

                it('@release should execute "eth_getTransactionReceipt" for hash of London transaction', async function () {
                    const gasPrice = await relay.gasPrice();
                    const transaction = {
                        ...defaultLondonTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        maxFeePerGas: gasPrice,
                        maxPriorityFeePerGas: gasPrice
                    };

                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const transactionHash = await relay.sendRawTransaction(signedTx);
                    // Since the transactionId is not available in this context
                    // Wait for the transaction to be processed and imported in the mirror node with axios-retry
                    const mirrorResult = await mirrorNode.get(`/contracts/results/${transactionHash}`);

                    const res = await relay.call('eth_getTransactionReceipt', [transactionHash]);
                    // FIXME here we must assert that the alias address is the `from` / `to` and not the `0x` prefixed one
                    Assertions.transactionReceipt(res, mirrorResult);
                });

                it('should execute "eth_getTransactionReceipt" for non-existing hash', async function () {
                    const res = await relay.call('eth_getTransactionReceipt', [NON_EXISTING_TX_HASH]);
                    expect(res).to.be.null;
                });

                it('should fail "eth_sendRawTransaction" for transaction with incorrect chain_id', async function () {
                    const transaction = {
                        ...default155TransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        chainId: INCORRECT_CHAIN_ID
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    try {
                        await relay.sendRawTransaction(signedTx);
                        Assertions.expectedError();
                    }
                    catch (e) {
                        Assertions.jsonRpcError(e, predefined.UNSUPPORTED_CHAIN_ID(ethers.utils.hexValue(INCORRECT_CHAIN_ID), CHAIN_ID));
                    }
                });

                it('@release should execute "eth_sendRawTransaction" for legacy EIP 155 transactions', async function () {
                    const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
                    const transaction = {
                        ...default155TransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const transactionHash = await relay.sendRawTransaction(signedTx);
                    // Since the transactionId is not available in this context
                    // Wait for the transaction to be processed and imported in the mirror node with axios-retry
                    await mirrorNode.get(`/contracts/results/${transactionHash}`);

                    const receiverEndBalance = await relay.getBalance(mirrorContract.evm_address);
                    const balanceChange = receiverEndBalance.sub(receiverInitialBalance);
                    expect(balanceChange.toString()).to.eq(ONE_TINYBAR.toString());
                });

                it('should fail "eth_sendRawTransaction" for legacy EIP 155 transactions (with insufficient balance)', async function () {
                    const balanceInWeiBars = await servicesNode.getAccountBalanceInWeiBars(accounts[2].accountId);

                    const transaction = {
                        ...default155TransactionData,
                        to: mirrorContract.evm_address,
                        value: balanceInWeiBars,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.INSUFFICIENT_ACCOUNT_BALANCE);
                });

                it('should fail "eth_sendRawTransaction" for Legacy transactions (with no chainId)', async function () {
                    const transaction = {
                        ...defaultLegacyTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.UNSUPPORTED_CHAIN_ID('0x0', CHAIN_ID));
                });

                it('should fail "eth_sendRawTransaction" for Legacy transactions (with gas price too low)', async function () {
                    const transaction = {
                        ...defaultLegacyTransactionData,
                        chainId: Number(CHAIN_ID),
                        gasPrice: GAS_PRICE_TOO_LOW,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address)
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.GAS_PRICE_TOO_LOW);
                });

                it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions', async function () {
                    const transaction = {
                        ...defaultLegacy2930TransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx]);
                });

                it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions (with gas price too low)', async function () {
                    const transaction = {
                        ...defaultLegacy2930TransactionData,
                        gasPrice: GAS_PRICE_TOO_LOW,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address)
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.GAS_PRICE_TOO_LOW);
                });

                it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions (with insufficient balance)', async function () {
                    const balanceInWeiBars = await servicesNode.getAccountBalanceInWeiBars(accounts[2].accountId);
                    const transaction = {
                        ...defaultLegacy2930TransactionData,
                        value: balanceInWeiBars,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        gasPrice: await relay.gasPrice()
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.INSUFFICIENT_ACCOUNT_BALANCE);
                });

                it('should fail "eth_sendRawTransaction" for London transactions (with gas price too low)', async function () {
                    const transaction = {
                        ...defaultLondonTransactionData,
                        maxPriorityFeePerGas: GAS_PRICE_TOO_LOW,
                        maxFeePerGas: GAS_PRICE_TOO_LOW,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address)
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.GAS_PRICE_TOO_LOW);
                });

                it('should fail "eth_sendRawTransaction" for London transactions (with insufficient balance)', async function () {
                    const balanceInWeiBars = await servicesNode.getAccountBalanceInWeiBars(accounts[2].accountId);
                    const gasPrice = await relay.gasPrice();

                    const transaction = {
                        ...defaultLondonTransactionData,
                        value: balanceInWeiBars,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        maxPriorityFeePerGas: gasPrice,
                        maxFeePerGas: gasPrice,
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.INSUFFICIENT_ACCOUNT_BALANCE);
                });

                it('should execute "eth_sendRawTransaction" for London transactions', async function () {
                    const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
                    const gasPrice = await relay.gasPrice();

                    const transaction = {
                        ...defaultLondonTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        maxPriorityFeePerGas: gasPrice,
                        maxFeePerGas: gasPrice,
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const transactionHash = await relay.call('eth_sendRawTransaction', [signedTx]);

                    // Since the transactionId is not available in this context
                    // Wait for the transaction to be processed and imported in the mirror node with axios-retry
                    await mirrorNode.get(`/contracts/results/${transactionHash}`);
                    const receiverEndBalance = await relay.getBalance(mirrorContract.evm_address);
                    const balanceChange = receiverEndBalance.sub(receiverInitialBalance);
                    expect(balanceChange.toString()).to.eq(ONE_TINYBAR.toString());
                });

                it('should execute "eth_sendRawTransaction" and deploy a large contract', async function () {
                    const gasPrice = await relay.gasPrice();
                    const transaction = {
                        type: 2,
                        chainId: Number(CHAIN_ID),
                        nonce: await relay.getAccountNonce(accounts[2].address),
                        maxPriorityFeePerGas: gasPrice,
                        maxFeePerGas: gasPrice,
                        gasLimit: defaultGasLimit,
                        data: '0x' + '00'.repeat(5121),
                    };

                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const transactionHash = await relay.call('eth_sendRawTransaction', [signedTx]);
                    const info = await mirrorNode.get(`/contracts/results/${transactionHash}`);
                    expect(info).to.have.property('contract_id');
                    expect(info.contract_id).to.not.be.null;
                    expect(info).to.have.property('created_contract_ids');
                    expect(info.created_contract_ids.length).to.be.equal(1);
                });

                describe('Prechecks', async function () {
                    it('should fail "eth_sendRawTransaction" for transaction with incorrect chain_id', async function () {
                        const transaction = {
                            ...default155TransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address),
                            chainId: INCORRECT_CHAIN_ID
                        };
                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        try {
                            await relay.sendRawTransaction(signedTx);
                            Assertions.expectedError();
                        }
                        catch(e) {
                            Assertions.jsonRpcError(e, predefined.UNSUPPORTED_CHAIN_ID('0x3e7', CHAIN_ID));
                        }
                    });

                    it('should fail "eth_sendRawTransaction" for EIP155 transaction with not enough gas', async function () {
                        const transaction = {
                            ...default155TransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address),
                            gasLimit: 100,
                            gasPrice: await relay.gasPrice()
                        };

                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        try {
                            await relay.sendRawTransaction(signedTx);
                            Assertions.expectedError();
                        }
                        catch (e) {
                            Assertions.jsonRpcError(e, predefined.GAS_LIMIT_TOO_LOW);
                        }
                    });

                    it('should fail "eth_sendRawTransaction" for EIP155 transaction with a too high gasLimit', async function () {
                        const transaction = {
                            ...default155TransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address),
                            gasLimit: 999999999,
                            gasPrice: await relay.gasPrice()
                        };

                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        try {
                            await relay.sendRawTransaction(signedTx);
                            Assertions.expectedError();
                        } catch (e) {
                            Assertions.jsonRpcError(e, predefined.GAS_LIMIT_TOO_HIGH);
                        }
                    });


                    it('should fail "eth_sendRawTransaction" for London transaction with not enough gas', async function () {
                        const transaction = {
                            ...defaultLondonTransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address),
                            gasLimit: 100
                        };
                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        try {
                            await relay.sendRawTransaction(signedTx);
                            Assertions.expectedError();
                        }
                        catch (e) {
                            Assertions.jsonRpcError(e, predefined.GAS_LIMIT_TOO_LOW);
                        }
                    });

                    it('should fail "eth_sendRawTransaction" for London transaction with a too high gasLimit', async function () {
                        const transaction = {
                            ...defaultLondonTransactionData,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address),
                            gasLimit: 999999999
                        };
                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        try {
                            await relay.sendRawTransaction(signedTx);
                            Assertions.expectedError();
                        } catch (e) {
                            Assertions.jsonRpcError(e, predefined.GAS_LIMIT_TOO_HIGH);
                        }
                    });

                    it('should fail "eth_sendRawTransaction" for legacy EIP 155 transactions (with gas price too low)', async function () {
                        const transaction = {
                            ...default155TransactionData,
                            gasPrice: GAS_PRICE_TOO_LOW,
                            to: mirrorContract.evm_address,
                            nonce: await relay.getAccountNonce(accounts[2].address)
                        };
                        const signedTx = await accounts[2].wallet.signTransaction(transaction);
                        await relay.callFailing('eth_sendRawTransaction', [signedTx], predefined.GAS_PRICE_TOO_LOW);
                    });
                });

                it('@release should execute "eth_getTransactionCount" primary', async function () {
                    const res = await relay.call('eth_getTransactionCount', [mirrorPrimaryAccount.evm_address, mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x0');
                });

                it('should execute "eth_getTransactionCount" secondary', async function () {
                    const res = await relay.call('eth_getTransactionCount', [mirrorSecondaryAccount.evm_address, mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x0');
                });

                it('@release should execute "eth_getTransactionCount" contract', async function () {
                    const res = await relay.call('eth_getTransactionCount', [mirrorContract.evm_address, mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x1');
                });

                it('@release should execute "eth_getTransactionCount" for account with id converted to evm_address', async function () {
                    const res = await relay.call('eth_getTransactionCount', [Utils.idToEvmAddress(mirrorPrimaryAccount.account), mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x0');
                });

                it('@release should execute "eth_getTransactionCount" contract with id converted to evm_address', async function () {
                    const res = await relay.call('eth_getTransactionCount', [Utils.idToEvmAddress(contractId.toString()), mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x1');
                });

                it('should execute "eth_getTransactionCount" for non-existing address', async function () {
                    const res = await relay.call('eth_getTransactionCount', [NON_EXISTING_ADDRESS, mirrorContractDetails.block_number]);
                    expect(res).to.be.equal('0x0');
                });

                it('should execute "eth_getTransactionCount" for account with non-zero nonce', async function () {
                    const account = await servicesNode.createAliasAccount();
                    // Wait for account creation to propagate
                    await mirrorNode.get(`/accounts/${account.accountId}`);
                    const transaction = {
                        ...defaultLondonTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(account.address)
                    };

                    const signedTx = await account.wallet.signTransaction(transaction);
                    const transactionHash = await relay.call('eth_sendRawTransaction', [signedTx]);
                    // Since the transactionId is not available in this context
                    // Wait for the transaction to be processed and imported in the mirror node with axios-retry
                    await mirrorNode.get(`/contracts/results/${transactionHash}`);

                    const res = await relay.call('eth_getTransactionCount', [account.address, 'latest']);
                    expect(res).to.be.equal('0x1');
                });

                it('@release should execute "eth_getTransactionByHash" for existing transaction', async function () {
                    const transaction = {
                        ...defaultLondonTransactionData,
                        to: mirrorContract.evm_address,
                        nonce: await relay.getAccountNonce(accounts[2].address)
                    };
                    const signedTx = await accounts[2].wallet.signTransaction(transaction);
                    const transactionHash = await relay.sendRawTransaction(signedTx);
                    const mirrorTransaction = await mirrorNode.get(`/contracts/results/${transactionHash}`);

                    const res = await relay.call('eth_getTransactionByHash', [transactionHash]);
                    const addressResult = await mirrorNode.get(`/accounts/${res.from}`);
                    mirrorTransaction.from = addressResult.evm_address;

                    Assertions.transaction(res, mirrorTransaction);
                });

                it('should execute "eth_getTransactionByHash" for non-existing transaction and return null', async function () {
                    const res = await relay.call('eth_getTransactionByHash', [NON_EXISTING_TX_HASH]);
                    expect(res).to.be.null;
                });
            });

            it('@release should execute "eth_estimateGas"', async function () {
                const res = await relay.call('eth_estimateGas', []);
                expect(res).to.contain('0x');
                expect(res).to.not.be.equal('0x');
                expect(res).to.not.be.equal('0x0');
            });

            it('@release should call eth_gasPrice', async function () {
                const res = await relay.call('eth_gasPrice', []);
                expect(res).to.exist;
                if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
                    expect(res).be.equal(ethers.utils.hexValue(Assertions.defaultGasPrice));
                }
                else {
                    expect(Number(res)).to.be.gt(0);
                }
            });

            it('@release should execute "eth_getBalance" for newly created account with 10 HBAR', async function () {
                const account = await servicesNode.createAliasAccount(10);
                const mirrorAccount = await mirrorNode.get(`/accounts/${account.accountId}`);

                const res = await relay.call('eth_getBalance', [account.address, 'latest']);
                const balanceInWeiBars = BigNumber.from(mirrorAccount.balance.balance.toString()).mul(constants.TINYBAR_TO_WEIBAR_COEF);
                // balance for tests changes as accounts are in use. Ensure non zero value
                expect(res).to.not.be.eq(EthImpl.zeroHex);
            });

            it('should execute "eth_getBalance" for non-existing address', async function () {
                const res = await relay.call('eth_getBalance', [NON_EXISTING_ADDRESS, 'latest']);
                expect(res).to.eq('0x0');
            });

            it('@release should execute "eth_getBalance" for contract', async function () {
                const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), 'latest']);
                expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
            });

            it('@release should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
                const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), 'latest']);
                expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
            });

            it('@release should execute "eth_getBalance" with latest block number', async function () {
                const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`)).blocks[0];
                const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), latestBlock.number]);
                expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
            });

            it('@release should execute "eth_getBalance" with pending', async function () {
                const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), 'pending']);
                expect(res).to.eq(ethers.utils.hexValue(ONE_WEIBAR));
            });

            it('@release should fail "eth_getBalance" with block number in the last 15 minutes', async function () {
                const latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`)).blocks[0];
                const earlierBlockNumber = latestBlock.number - 1;

                try {
                    await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), earlierBlockNumber]);
                }
                catch(error) {
                    Assertions.jsonRpcError(error, predefined.UNKNOWN_HISTORICAL_BALANCE);
                }
            });

            describe('@release Hardcoded RPC Endpoints', () => {
                let mirrorBlock;

                before(async () => {
                    mirrorBlock = (await mirrorNode.get(`/blocks?block.number=${mirrorContractDetails.block_number}`)).blocks[0];
                });

                it('should execute "eth_chainId"', async function () {
                    const res = await relay.call('eth_chainId', [null]);
                    expect(res).to.be.equal(CHAIN_ID);
                });

                it('should execute "net_listening"', async function () {
                    const res = await relay.call('net_listening', []);
                    expect(res).to.be.equal('false');
                });

                it('should execute "net_version"', async function () {
                    const res = await relay.call('net_version', []);
                    expect(res).to.be.equal(CHAIN_ID);
                });

                it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
                    const res = await relay.call('eth_getUncleByBlockHashAndIndex', [mirrorBlock.hash, 0]);
                    expect(res).to.be.null;
                });

                it('should execute "eth_getUncleByBlockHashAndIndex" for non-existing block hash and index=0', async function () {
                    const res = await relay.call('eth_getUncleByBlockHashAndIndex', [NON_EXISTING_BLOCK_HASH, 0]);
                    expect(res).to.be.null;
                });

                it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
                    const res = await relay.call('eth_getUncleByBlockNumberAndIndex', [mirrorBlock.number, 0]);
                    expect(res).to.be.null;
                });

                it('should execute "eth_getUncleByBlockNumberAndIndex" for non-existing block number and index=0', async function () {
                    const res = await relay.call('eth_getUncleByBlockNumberAndIndex', [NON_EXISTING_BLOCK_NUMBER, 0]);
                    expect(res).to.be.null;
                });

                it('should execute "eth_getUncleCountByBlockHash"', async function () {
                    const res = await relay.call('eth_getUncleCountByBlockHash', []);
                    expect(res).to.be.equal('0x0');
                });

                it('should execute "eth_getUncleCountByBlockNumber"', async function () {
                    const res = await relay.call('eth_getUncleCountByBlockNumber', []);
                    expect(res).to.be.equal('0x0');
                });

                it('should return empty on "eth_accounts"', async function () {
                    const res = await relay.call('eth_accounts', []);
                    expect(res).to.deep.equal([]);
                });

                it('should execute "eth_hashrate"', async function () {
                    const res = await relay.call('eth_hashrate', []);
                    expect(res).to.be.equal('0x0');
                });

                it('should execute "eth_mining"', async function () {
                    const res = await relay.call('eth_mining', []);
                    expect(res).to.be.equal(false);
                });

                it('should execute "eth_submitWork"', async function () {
                    const res = await relay.call('eth_submitWork', []);
                    expect(res).to.be.equal(false);
                });

                it('should execute "eth_syncing"', async function () {
                    const res = await relay.call('eth_syncing', []);
                    expect(res).to.be.equal(false);
                });

                it('should execute "web3_client_version"', async function () {
                    const res = await relay.call('web3_client_version', []);
                    expect(res).to.contain('relay/');
                });

                it('should execute "eth_maxPriorityFeePerGas"', async function () {
                    const res = await relay.call('eth_maxPriorityFeePerGas', []);
                    expect(res).to.be.equal('0x0');
                });
            });

            describe('@release Unsupported RPC Endpoints', () => {

                it('should not support "eth_submitHashrate"', async function () {
                    await relay.callUnsupported('eth_submitHashrate', []);
                });

                it('should not support "eth_getWork"', async function () {
                    await relay.callUnsupported('eth_getWork', []);
                });

                it('should not support "eth_coinbase"', async function () {
                    await relay.callUnsupported('eth_coinbase', []);
                });

                it('should not support "eth_sendTransaction"', async function () {
                    await relay.callUnsupported('eth_sendTransaction', []);
                });

                it('should not support "eth_protocolVersion"', async function () {
                    await relay.callUnsupported('eth_protocolVersion', []);
                });

                it('should not support "eth_sign"', async function () {
                    await relay.callUnsupported('eth_sign', []);
                });

                it('should not support "eth_signTransaction"', async function () {
                    await relay.callUnsupported('eth_signTransaction', []);
                });
            });

            describe('eth_getCode', () => {

                let basicContract;
                let mainContractAddress: string;
                let NftHTSTokenContractAddress: string;
                let redirectBytecode: string;

                async function deploymainContract() {
                    const mainFactory = new ethers.ContractFactory(TokenCreateJson.abi, TokenCreateJson.bytecode, accounts[3].wallet);
                    const mainContract = await mainFactory.deploy({gasLimit: 15000000});
                    const { contractAddress } = await mainContract.deployTransaction.wait();
                
                    return contractAddress;
                }

                async function createNftHTSToken() {
                    const mainContract = new ethers.Contract(mainContractAddress, TokenCreateJson.abi, accounts[3].wallet);
                    const tx = await mainContract.createNonFungibleTokenPublic(accounts[3].wallet.address, {
                        value: ethers.BigNumber.from('10000000000000000000'),
                        gasLimit: 10000000
                    });
                    const { tokenAddress } = (await tx.wait()).events.filter(e => e.event = 'CreatedToken')[0].args;
                    
                    return tokenAddress;
                }

                before(async () => {
                    basicContract = await servicesNode.deployContract(basicContractJson);
                    mainContractAddress = await deploymainContract();
                    NftHTSTokenContractAddress = await createNftHTSToken();
                    // Wait for creation to propagate
                    await mirrorNode.get(`/contracts/${basicContract.contractId}`);
                });

                it('should execute "eth_getCode" for hts token', async function () {
                    const tokenAddress = NftHTSTokenContractAddress.slice(2);
                    redirectBytecode = `6080604052348015600f57600080fd5b506000610167905077618dc65e${tokenAddress}600052366000602037600080366018016008845af43d806000803e8160008114605857816000f35b816000fdfea2646970667358221220d8378feed472ba49a0005514ef7087017f707b45fb9bf56bb81bb93ff19a238b64736f6c634300080b0033`
                    const res = await relay.call('eth_getCode', [NftHTSTokenContractAddress]);
                    expect(res).to.equal(redirectBytecode);
                });

                it('@release should execute "eth_getCode" for contract evm_address', async function () {
                    const evmAddress = basicContract.contractId.toSolidityAddress();
                    const res = await relay.call('eth_getCode', [evmAddress]);
                    expect(res).to.eq(basicContractJson.deployedBytecode);
                });

                it('@release should execute "eth_getCode" for contract with id converted to evm_address', async function () {
                    const evmAddress = Utils.idToEvmAddress(basicContract.contractId.toString());
                    const res = await relay.call('eth_getCode', [evmAddress]);
                    expect(res).to.eq(basicContractJson.deployedBytecode);
                });

                it('should return 0x0 for non-existing contract on eth_getCode', async function () {
                    const res = await relay.call('eth_getCode', [NON_EXISTING_ADDRESS]);
                    expect(res).to.eq(EthImpl.emptyHex);
                });

                it('should return 0x0 for account evm_address on eth_getCode', async function () {
                    const evmAddress = Utils.idToEvmAddress(accounts[2].accountId.toString());
                    const res = await relay.call('eth_getCode', [evmAddress]);
                    expect(res).to.eq(EthImpl.emptyHex);
                });

                it('should return 0x0 for account alias on eth_getCode', async function () {
                    const alias = Utils.idToEvmAddress(accounts[2].accountId.toString());
                    const res = await relay.call('eth_getCode', [alias]);
                    expect(res).to.eq(EthImpl.emptyHex);
                });
            });

            describe('eth_call', () => {
                let basicContract, evmAddress;

                before(async () => {
                    basicContract = await servicesNode.deployContract(basicContractJson);
                    // Wait for creation to propagate
                    await mirrorNode.get(`/contracts/${basicContract.contractId}`);

                    evmAddress = `0x${basicContract.contractId.toSolidityAddress()}`;
                });

                it('@release should execute "eth_call" request to Basic contract', async function () {
                    const callData = {
                        from: accounts[2].address,
                        to: evmAddress,
                        gas: 30000,
                        data: BASIC_CONTRACT_PING_CALL_DATA
                    };

                    const res = await relay.call('eth_call', [callData]);
                    expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
                });

                it('should fail "eth_call" request without data field', async function () {
                    const callData = {
                        from: accounts[2].address,
                        to: evmAddress,
                        gas: 30000
                    };

                    const res = await relay.call('eth_call', [callData]);
                    expect(res).to.eq('0x'); // confirm no error
                });

                it('should fail "eth_call" for non-existing contract address', async function () {
                    const callData = {
                        from: accounts[2].address,
                        to: NON_EXISTING_ADDRESS,
                        gas: 30000,
                        data: BASIC_CONTRACT_PING_CALL_DATA
                    };

                    await relay.callFailing('eth_call', [callData]);
                });

                it('should execute "eth_call" without from field', async function () {
                    const callData = {
                        to: evmAddress,
                        gas: 30000,
                        data: BASIC_CONTRACT_PING_CALL_DATA
                    };

                    const res = await relay.call('eth_call', [callData]);
                    expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
                });

                it('should execute "eth_call" without gas field', async function () {
                    const callData = {
                        from: accounts[2].address,
                        to: evmAddress,
                        data: BASIC_CONTRACT_PING_CALL_DATA
                    };

                    const res = await relay.call('eth_call', [callData]);
                    expect(res).to.eq(BASIC_CONTRACT_PING_RESULT);
                });
            });
        });

        // Only run the following tests against a local node since they only work with the genesis account
        if (process.env.LOCAL_NODE && process.env.LOCAL_NODE !== 'false') {
            describe('Gas Price related RPC endpoints', () => {
                let lastBlockBeforeUpdate;
                let lastBlockAfterUpdate;

                before(async () => {
                    await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, FEE_SCHEDULE_FILE_CONTENT_DEFAULT);
                    await servicesNode.updateFileContent(EXCHANGE_RATE_FILE_ID, EXCHANGE_RATE_FILE_CONTENT_DEFAULT);
                    lastBlockBeforeUpdate = (await mirrorNode.get(`/blocks?limit=1&order=desc`)).blocks[0];
                    await new Promise(resolve => setTimeout(resolve, 4000));
                    await servicesNode.updateFileContent(FEE_SCHEDULE_FILE_ID, FEE_SCHEDULE_FILE_CONTENT_UPDATED);
                    await new Promise(resolve => setTimeout(resolve, 4000));
                    lastBlockAfterUpdate = (await mirrorNode.get(`/blocks?limit=1&order=desc`)).blocks[0];
                });

                it('should call eth_feeHistory with updated fees', async function () {
                    const blockCountNumber = lastBlockAfterUpdate.number - lastBlockBeforeUpdate.number;
                    const blockCountHex = ethers.utils.hexValue(blockCountNumber);
                    const datedGasPriceHex = ethers.utils.hexValue(Assertions.datedGasPrice);
                    const updatedGasPriceHex = ethers.utils.hexValue(Assertions.updatedGasPrice);
                    const newestBlockNumberHex = ethers.utils.hexValue(lastBlockAfterUpdate.number);
                    const oldestBlockNumberHex = ethers.utils.hexValue(lastBlockAfterUpdate.number - blockCountNumber + 1);

                    const res = await relay.call('eth_feeHistory', [blockCountHex, newestBlockNumberHex, [0]]);

                    Assertions.feeHistory(res, {
                        resultCount: blockCountNumber,
                        oldestBlock: oldestBlockNumberHex,
                        checkReward: true
                    });
                    // We expect all values in the array to be from the mirror node. If there is discrepancy in the blocks, the first value is from the consensus node and it's different from expected.
                    expect(res.baseFeePerGas[1]).to.equal(datedGasPriceHex);
                    expect(res.baseFeePerGas[res.baseFeePerGas.length - 2]).to.equal(updatedGasPriceHex);
                    expect(res.baseFeePerGas[res.baseFeePerGas.length - 1]).to.equal(updatedGasPriceHex);
                });

                it('should call eth_feeHistory with newest block > latest', async function () {
                    let latestBlock;
                    const blocksAhead = 10;
                    try {
                        latestBlock = (await mirrorNode.get(`/blocks?limit=1&order=desc`)).blocks[0];
                        const newestBlockNumberHex = ethers.utils.hexValue(latestBlock.number + blocksAhead);
                        await relay.call('eth_feeHistory', ['0x1', newestBlockNumberHex, null]);
                    } catch (error) {
                        Assertions.jsonRpcError(error, predefined.REQUEST_BEYOND_HEAD_BLOCK(latestBlock.number + blocksAhead, latestBlock.number));
                    }
                });

                it('should call eth_feeHistory with zero block count', async function () {
                    const res = await relay.call('eth_feeHistory', ['0x0', 'latest', null]);

                    expect(res.reward).to.not.exist;
                    expect(res.baseFeePerGas).to.not.exist;
                    expect(res.gasUsedRatio).to.equal(null);
                    expect(res.oldestBlock).to.equal('0x0');
                });
            });
        }

        describe('eth_feeHistory', () => {
            it('should call eth_feeHistory', async function () {
                const res = await relay.call('eth_feeHistory', ['0x1', 'latest', null]);
                expect(res.baseFeePerGas).to.exist.to.be.an('Array');
                expect(res.baseFeePerGas.length).to.be.gt(0);
                expect(res.gasUsedRatio).to.exist.to.be.an('Array');
                expect(res.gasUsedRatio.length).to.be.gt(0);
                expect(res.oldestBlock).to.exist;
                expect(Number(res.oldestBlock)).to.be.gt(0);
            });
        });

        describe('Contract call reverts', () => {
            let reverterContract, reverterEvmAddress;
            const PURE_METHOD_CALL_DATA = '0xb2e0100c';
            const VIEW_METHOD_CALL_DATA = '0x90e9b875';
            const PAYABLE_METHOD_CALL_DATA = '0xd0efd7ef';
            const PURE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5075726500000000000000000000000000000000';
            const VIEW_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010526576657274526561736f6e5669657700000000000000000000000000000000';
            const PAYABLE_METHOD_ERROR_DATA = '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013526576657274526561736f6e50617961626c6500000000000000000000000000';
            const PURE_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonPure';
            const VIEW_METHOD_ERROR_MESSAGE = 'execution reverted: RevertReasonView';

            before(async () => {
                reverterContract = await servicesNode.deployContract(reverterContractJson);
                // Wait for creation to propagate
                await mirrorNode.get(`/contracts/${reverterContract.contractId}`);
                reverterEvmAddress = `0x${reverterContract.contractId.toSolidityAddress()}`;
            });

            it('Returns revert message for pure methods', async () => {
                const callData = {
                    from: accounts[0].address,
                    to: reverterEvmAddress,
                    gas: 30000,
                    data: PURE_METHOD_CALL_DATA
                };

                await relay.callFailing('eth_call', [callData], {
                    code: -32008,
                    message: PURE_METHOD_ERROR_MESSAGE,
                    data: PURE_METHOD_ERROR_DATA
                });
            });

            it('Returns revert message for view methods', async () => {
                const callData = {
                    from: accounts[0].address,
                    to: reverterEvmAddress,
                    gas: 30000,
                    data: VIEW_METHOD_CALL_DATA
                };

                await relay.callFailing('eth_call', [callData], {
                    code: -32008,
                    message: VIEW_METHOD_ERROR_MESSAGE,
                    data: VIEW_METHOD_ERROR_DATA
                });
            });

            it('Returns revert reason in receipt for payable methods', async () => {
                const transaction = {
                    value: ONE_TINYBAR,
                    gasLimit: 30000,
                    chainId: Number(CHAIN_ID),
                    to: reverterEvmAddress,
                    nonce: await relay.getAccountNonce(accounts[0].address),
                    gasPrice: await relay.gasPrice(),
                    data: PAYABLE_METHOD_CALL_DATA
                };
                const signedTx = await accounts[0].wallet.signTransaction(transaction);
                const transactionHash = await relay.call('eth_sendRawTransaction', [signedTx]);

                // Wait until receipt is available in mirror node
                await mirrorNode.get(`/contracts/results/${transactionHash}`);

                const receipt = await relay.call('eth_getTransactionReceipt', [transactionHash]);
                expect(receipt?.revertReason).to.exist;
                expect(receipt.revertReason).to.eq(PAYABLE_METHOD_ERROR_DATA);
            });
        });
    });
});
