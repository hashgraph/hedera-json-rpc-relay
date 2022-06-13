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
import { Client } from "@hashgraph/sdk";
import Axios from 'axios';
import axiosRetry from 'axios-retry';
import { expect } from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import pino from 'pino';
import shell from 'shelljs';
import {BigNumber} from "ethers";


// local resources
import parentContract from './parentContract/Parent.json';
import app from '../src/server';
import TestUtils from './utils';

const testLogger = pino({
    name: 'hedera-json-rpc-relay',
    level: process.env.LOG_LEVEL || 'trace',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: true
        }
    }
});
const logger = testLogger.child({ name: 'rpc-acceptance-test' });

const utils = new TestUtils(logger, 'http://localhost:7546');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const useLocalNode = process.env.LOCAL_NODE || 'true';

// const refs
const privateKeyHex1 = 'a3e5428dd97d479b1ee4690ef9ec627896020d79883c38e9c1e9a45087959888';
const privateKeyHex2 = '93239c5e19d76c0bd5d62d713cd90f0c3af80c9cb467db93fd92f3772c00985f';
const privateKeyHex3 = '3e389f612c4b27de9c817299d2b3bd0753b671036608a30a90b0c4bea8b97e74';
const nonExistingAddress = '0x5555555555555555555555555555555555555555';
const nonExistingTxHash = '0x5555555555555555555555555555555555555555555555555555555555555555';
const defaultChainId = Number(process.env.CHAIN_ID);
const oneHbarInWeiHexString = `0x0de0b6b3a7640000`;

const defaultLegacyTransactionData = {
    value: oneHbarInWeiHexString,
    chainId: defaultChainId,
    gasPrice: 720000000000,
    gasLimit: 3000000
};

const defaultLondonTransactionData = {
    value: oneHbarInWeiHexString,
    chainId: defaultChainId,
    maxPriorityFeePerGas: 720000000000,
    maxFeePerGas: 720000000000,
    gasLimit: 3000000,
    type: 2,
};

const defaultLegacy2930TransactionData = {
    value: oneHbarInWeiHexString,
    chainId: defaultChainId,
    gasPrice: 720000000000,
    gasLimit: 3000000,
    type: 1
};

// cached entities
let client: Client;
let accOneClient: Client;
let tokenId;
let contractId;
let contractExecuteTimestamp;
let mirrorBlock;
let mirrorContract;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;
let ethCompPrivateKey3;
let ethCompAccountInfo3;
let ethCompAccountEvmAddr3;

describe('RPC Server Integration Tests', async function () {
    this.timeout(180 * 1000);

    before(async function () {
        logger.info(`Setting up SDK Client for ${process.env['HEDERA_NETWORK']} env`);
        client = utils.setupClient(process.env.OPERATOR_KEY_MAIN, process.env.OPERATOR_ID_MAIN);

        if (useLocalNode === 'true') {
            // set env variables for docker images until local-node is updated
            process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
            process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
            process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
            logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

            // start local-node
            logger.debug('Start local node and generate accounts');
            shell.exec('npx hedera-local start');
            shell.exec('npx hedera-local generate-accounts 0');
            logger.trace('Hedera Hashgraph local node env started');
        }

        // set up mirror node contents
        logger.info('Submit eth account create transactions via crypto transfers');
        // 1. Crypto create with alias - metamask flow
        const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await utils.createEthCompatibleAccount(client, privateKeyHex1);
        const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await utils.createEthCompatibleAccount(client, privateKeyHex2);

        const ethCompatibleAccount3 = await utils.createEthCompatibleAccount(client, privateKeyHex3);
        ethCompPrivateKey3 = ethCompatibleAccount3.privateKey;
        ethCompAccountInfo3 = ethCompatibleAccount3.accountInfo;
        ethCompAccountEvmAddr3 = utils.idToEvmAddress(ethCompAccountInfo3.accountId.toString());

        logger.info(`Setup Client for AccountOne: ${primaryAccountInfo.accountId.toString()}`);
        accOneClient = utils.setupClient(primaryKey.toString(), primaryAccountInfo.accountId.toString());

        logger.info('Create and execute contracts');
        // 2. contract create amd execute
        // Take Parent contract used in mirror node acceptance tests since it's well use
        contractId = await utils.createParentContract(parentContract, client);
        const contractCallResult = await utils.executeContractCall(contractId, client);
        contractExecuteTimestamp = contractCallResult.contractExecuteTimestamp;

        logger.info('Create parent contract with AccountOne');
        await utils.createParentContract(parentContract, accOneClient);
        await utils.executeContractCall(contractId, accOneClient);

        logger.info('Create token');
        // 3. Token create
        tokenId = await utils.createToken(client);

        logger.info('Associate and transfer tokens');
        // 4. associate and transfer 2 tokens
        await utils.associateAndTransferToken(primaryAccountInfo.accountId, primaryKey, tokenId, client);
        await utils.associateAndTransferToken(secondaryAccountInfo.accountId, secondaryKey, tokenId, client);

        logger.info('Send file close crypto transfers');
        // 5. simple crypto transfer to ensure file close
        await utils.sendFileClosingCryptoTransfer(primaryAccountInfo.accountId, client);
        await utils.sendFileClosingCryptoTransfer(secondaryAccountInfo.accountId, client);

        logger.info(`Setting up Mirror Node Client for ${process.env['MIRROR_NODE_URL']} env`);
        const mirrorNodeClient = Axios.create({
            baseURL: `${process.env['MIRROR_NODE_URL']}/api/v1`,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            timeout: 5 * 1000
        });

        // allow retries given mirror node waits for consensus, record stream serialization, export and import before parsing and exposing
        axiosRetry(mirrorNodeClient, {
            retries: 5,
            retryDelay: (retryCount) => {
                logger.info(`Retry delay ${retryCount * 1000} s`);
                return retryCount * 1000;
            },
            retryCondition: (error) => {
                // if retry condition is not specified, by default idempotent requests are retried
                return error.response.status === 400 || error.response.status === 404;
            }
        });

        // get contract details
        const mirrorContractResponse = await utils.callMirrorNode(mirrorNodeClient, `/contracts/${contractId}`);
        mirrorContract = mirrorContractResponse.data;

        // get contract details
        const mirrorContractDetailsResponse = await utils.callMirrorNode(mirrorNodeClient, `/contracts/${contractId}/results/${contractExecuteTimestamp}`);
        mirrorContractDetails = mirrorContractDetailsResponse.data;

        // get block
        const mirrorBlockResponse = await utils.callMirrorNode(mirrorNodeClient, `/blocks?block.number=${mirrorContractDetails.block_number}`);
        mirrorBlock = mirrorBlockResponse.data.blocks[0];

        const mirrorPrimaryAccountResponse = await utils.callMirrorNode(mirrorNodeClient, `accounts?account.id=${primaryAccountInfo.accountId}`);
        mirrorPrimaryAccount = mirrorPrimaryAccountResponse.data.accounts[0];

        const mirrorSecondaryAccountResponse = await utils.callMirrorNode(mirrorNodeClient, `accounts?account.id=${secondaryAccountInfo.accountId}`);
        mirrorSecondaryAccount = mirrorSecondaryAccountResponse.data.accounts[0];

        // start relay
        logger.info(`Start relay on port ${process.env.SERVER_PORT}`);
        this.testServer = app.listen({ port: process.env.SERVER_PORT });
        this.relayClient = Axios.create({
            baseURL: 'http://localhost:7546',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            timeout: 5 * 1000
        });
    });

    after(function () {
        if (useLocalNode === 'true') {
            // stop local-node
            logger.info('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        logger.info('Stop relay');
        if (this.testServer !== undefined) {
            this.testServer.close();
        }
    });

    it('should execute "eth_chainId"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_chainId', [null]);
        expect(res.data.result).to.be.equal(utils.numberTo0x(defaultChainId));
    });

    it('should execute "eth_getBlockByHash"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBlockByHash', [mirrorBlock.hash, 'true']);

        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(utils.numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockByNumber"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBlockByNumber', [mirrorBlock.number, true]);

        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(utils.numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockTransactionCountByHash"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBlockTransactionCountByHash', [mirrorBlock.hash]);
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getBlockTransactionCountByNumber"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBlockTransactionCountByNumber', [mirrorBlock.number]);
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionByBlockHashAndIndex', [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]);

        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(utils.numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]);

        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(utils.numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "net_listening"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'net_listening', []);
        expect(res.data.result).to.be.equal('false');
    });

    it('should execute "net_version"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'net_version', []);
        expect(res.data.result).to.be.equal('0x12a');
    });

    it('should execute "eth_estimateGas"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_estimateGas', []);
        expect(res.data.result).to.contain('0x');
        expect(res.data.result).to.not.be.equal('0x');
        expect(res.data.result).to.not.be.equal('0x0');
    });

    it('should execute "eth_gasPrice"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_gasPrice', []);
        expect(res.data.result).to.be.equal('0xa7a3582000');
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getUncleByBlockHashAndIndex', []);
        expect(res.data.result).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getUncleByBlockNumberAndIndex', []);
        expect(res.data.result).to.be.null;
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getUncleCountByBlockHash', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getUncleCountByBlockNumber', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should not support "eth_getWork"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_getWork', []);
    });

    it('should not support "eth_coinbase"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_coinbase', []);
    });

    it('should not support "eth_sendTransaction"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_sendTransaction', []);
    });

    it('should return empty on "eth_accounts"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_accounts', []);
        expect(res.data.result).to.deep.equal([]);
    });

    it('should execute "eth_hashrate"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_hashrate', []);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_mining"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_mining', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute "eth_submitWork"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_submitWork', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should not support "eth_submitHashrate"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_submitHashrate', []);
    });

    it('should execute "eth_getBalance" for primary account', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorPrimaryAccount.evm_address, 'latest']);
        expect(res.data.result).to.eq('0x1095793487d8e20c800');
    });

    it('should execute "eth_getBalance" for secondary account', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorSecondaryAccount.evm_address, 'latest']);
        expect(res.data.result).to.eq('0x10f077b81e38c40a400');
    });

    it('should execute "eth_getBalance" for non-existing address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [nonExistingAddress, 'latest']);
        expect(res.data.result).to.eq('0x0');
    });

    it('should execute "eth_getBalance" for contract', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        expect(res.data.result).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_getBalance" for account with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [utils.idToEvmAddress(mirrorPrimaryAccount.account), 'latest']);
        expect(res.data.result).to.eq('0x1095793487d8e20c800');
    });

    it('should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [utils.idToEvmAddress(contractId.toString()), 'latest']);
        expect(res.data.result).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_sendRawTransaction" for legacy transactions', async function () {
        const senderInitialBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [ethCompAccountEvmAddr3, 'latest']);
        const senderInitialBalance = senderInitialBalanceRes.data.result;
        const receiverInitialBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        const receiverInitialBalance = receiverInitialBalanceRes.data.result;

        const signedTx = await utils.signRawTransaction({
            ...defaultLegacyTransactionData,
            to: mirrorContract.evm_address
        }, ethCompPrivateKey3);

        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.result).to.be.equal('0x872d83c28c30ec48befb6cd77c1588e5589e00b7c61fcbc942a5b26ea23b9694');

        const senderEndBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [ethCompAccountEvmAddr3, 'latest']);
        const senderEndBalance = senderEndBalanceRes.data.result;
        const receiverEndBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        const receiverEndBalance = receiverEndBalanceRes.data.result;

        expect(utils.subtractBigNumberHexes(receiverEndBalance, receiverInitialBalance).toHexString()).to.eq(oneHbarInWeiHexString);
        expect(senderInitialBalance).to.not.eq(senderEndBalance);
        expect(utils.subtractBigNumberHexes(senderInitialBalance, senderEndBalance).toHexString()).to.not.eq(oneHbarInWeiHexString);
        expect(BigNumber.from(senderInitialBalance).sub(BigNumber.from(senderEndBalance)).gt(0)).to.eq(true);

    });

    it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions', async function () {
        // INVALID_ETHEREUM_TX
        const signedTx = await utils.signRawTransaction({
            ...defaultLegacy2930TransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(ethCompAccountEvmAddr3)
        }, ethCompPrivateKey3);

        const res = await utils.callFailingRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.error.message).to.be.equal('Internal error');
        expect(res.data.error.code).to.be.equal(-32603);
    });

    it('should execute "eth_sendRawTransaction" for London transactions', async function () {
        const senderInitialBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [ethCompAccountEvmAddr3, 'latest']);
        const senderInitialBalance = senderInitialBalanceRes.data.result;
        const receiverInitialBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        const receiverInitialBalance = receiverInitialBalanceRes.data.result;

        const signedTx = await utils.signRawTransaction({
            ...defaultLondonTransactionData,
            to: mirrorContract.evm_address,
            nonce:  await utils.getAccountNonce(ethCompAccountEvmAddr3)
        }, ethCompPrivateKey3);

        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.result).to.be.equal('0xcf7df11282f835c05be88f9cc95e41f706fc12bd0833afd0212df32eeaf3eaf1');

        const senderEndBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [ethCompAccountEvmAddr3, 'latest']);
        const senderEndBalance = senderEndBalanceRes.data.result;
        const receiverEndBalanceRes = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorContract.evm_address, 'latest']);
        const receiverEndBalance = receiverEndBalanceRes.data.result;

        expect(utils.subtractBigNumberHexes(receiverEndBalance, receiverInitialBalance).toHexString()).to.eq(oneHbarInWeiHexString);
        expect(senderInitialBalance).to.not.eq(senderEndBalance);
        expect(utils.subtractBigNumberHexes(senderInitialBalance, senderEndBalance).toHexString()).to.not.eq(oneHbarInWeiHexString);
        expect(BigNumber.from(senderInitialBalance).sub(BigNumber.from(senderEndBalance)).gt(0)).to.eq(true);
    });

    it('should execute "eth_syncing"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_syncing', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute "web3_client_version"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'web3_client_version', []);
        expect(res.data.result).to.contain('relay/');
    });

    it('should not support "eth_protocolVersion"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_protocolVersion', []);
    });

    it('should not support "eth_sign"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_sign', []);
    });

    it('should not support "eth_signTransaction"', async function () {
        await utils.callUnsupportedRelayMethod(this.relayClient, 'eth_signTransaction', []);
    });

    it('should execute "eth_getTransactionCount" primary', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [mirrorPrimaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" secondary', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [mirrorSecondaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [mirrorContract.evm_address, mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for account with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [utils.idToEvmAddress(mirrorPrimaryAccount.account), mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [utils.idToEvmAddress(contractId.toString()), mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for non-existing address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [nonExistingAddress, mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" for account with non-zero nonce', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionCount', [ethCompAccountEvmAddr3, mirrorContractDetails.block_number]);
        expect(res.data.result).to.be.equal('0x2');
    });

    it('should execute "eth_getTransactionReceipt" for hash of legacy transaction', async function () {
        const txRequest = {
            ...defaultLegacyTransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(ethCompAccountEvmAddr3)
        };
        const submittedLegacyTransactionHash = await utils.sendRawTransaction(txRequest, ethCompPrivateKey3);
        await utils.sleep(3000);
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionReceipt', [submittedLegacyTransactionHash]);
        utils.assertTransactionReceipt(res.data.result, txRequest, {
            from: ethCompAccountEvmAddr3
        });

    });

    it('should execute "eth_getTransactionReceipt" for hash of London transaction', async function () {
        const txRequest = {
            ...defaultLondonTransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(ethCompAccountEvmAddr3)
        };
        const submittedLondonTransactionHash = await utils.sendRawTransaction(txRequest, ethCompPrivateKey3);
        await utils.sleep(3000);
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionReceipt', [submittedLondonTransactionHash]);
        utils.assertTransactionReceipt(res.data.result, txRequest, {
            from: ethCompAccountEvmAddr3
        });
    });

    it('should execute "eth_getTransactionReceipt" for non-existing hash', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getTransactionReceipt', [nonExistingTxHash]);
        expect(res.data.result).to.be.null;
    });
});