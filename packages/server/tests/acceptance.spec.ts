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
import {
    Client,
    PrivateKey,
} from "@hashgraph/sdk";
import Axios from 'axios';
import Axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { expect } from 'chai';
import dotenv from 'dotenv';
import path from 'path';
import pino from 'pino';
import shell from 'shelljs';

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
const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];

// const refs
const privateKeyHex1 = 'a3e5428dd97d479b1ee4690ef9ec627896020d79883c38e9c1e9a45087959888';
const privateKeyHex2 = '93239c5e19d76c0bd5d62d713cd90f0c3af80c9cb467db93fd92f3772c00985f';
const privateKeyHex3 = '3e389f612c4b27de9c817299d2b3bd0753b671036608a30a90b0c4bea8b97e74';
const nonExistingAddress = '0x5555555555555555555555555555555555555555';
const defaultChainId = Number(process.env.CHAIN_ID);

const defaultLegacyTransactionData = {
    value: 1,
    chainId: defaultChainId,
    gasPrice: 720000000000,
    gasLimit: 3000000
};

const defaultLondonTransactionData = {
    value: 1,
    chainId: defaultChainId,
    maxPriorityFeePerGas: 720000000000,
    maxFeePerGas: 720000000000,
    gasLimit: 3000000,
    type: 2,
};

const defaultLegacy2930TransactionData = {
    value: 1,
    chainId: defaultChainId,
    gasPrice: 720000000000,
    gasLimit: 3000000,
    type: 1
};

// cached entities
let client: Client;
let accOneClient: Client;
let tokenId;
let opPrivateKey;
let contractId;
let contractExecuteTimestamp;
let contractExecutedTransactionId;
let mirrorBlock;
let mirrorContract;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;
let ethCompPrivateKey1;
let ethCompAccountInfo1;
let ethCompPrivateKey2;
let ethCompAccountInfo2;
let ethCompPrivateKey3;
let ethCompAccountInfo3;

describe('RPC Server Integration Tests', async function () {
    this.timeout(180 * 1000);

    before(async function () {
        logger.info(`Setting up SDK Client for ${process.env['HEDERA_NETWORK']} env`);
        client = utils.setupClient(process.env.OPERATOR_KEY_MAIN, process.env.OPERATOR_ID_MAIN);
        opPrivateKey = PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN);


        if (useLocalNode === 'true') {
            // set env variables for docker images until local-node is updated
            process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2-patch.3';
            process.env['HAVEGED_IMAGE_TAG'] = '0.25.4';
            process.env['MIRROR_IMAGE_TAG'] = '0.58.0-rc1';
            logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

            // start local-node
            logger.debug('Start local node and genereate accounts');
            shell.exec('npx hedera-local start');
            shell.exec('npx hedera-local generate-accounts 0');
            logger.trace('Hedera Hashgraph local node env started');
        }

        // set up mirror node contents
        logger.info('Submit eth account create transactions via crypto transfers');
        // 1. Crypto create with alias - metamask flow
        const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await utils.createEthCompatibleAccount(client, privateKeyHex1);
        ethCompPrivateKey1 = primaryKey;
        ethCompAccountInfo1 = primaryAccountInfo;

        const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await utils.createEthCompatibleAccount(client, privateKeyHex2);
        ethCompPrivateKey2 = secondaryKey;
        ethCompAccountInfo2 = secondaryAccountInfo;

        const ethCompatibleAccount3 = await utils.createEthCompatibleAccount(client, privateKeyHex3);
        ethCompPrivateKey3 = ethCompatibleAccount3.privateKey;
        ethCompAccountInfo3 = ethCompatibleAccount3.accountInfo;

        logger.info(`Setup Client for AccountOne: ${primaryAccountInfo.accountId.toString()}`);
        accOneClient = utils.setupClient(primaryKey.toString(), primaryAccountInfo.accountId.toString());

        logger.info('Create and execute contracts');
        // 2. contract create amd execute
        // Take Parent contract used in mirror node acceptance tests since it's well use
        contractId = await utils.createParentContract(parentContract, client);
        const contractCallResult = await utils.executeContractCall(contractId, client);
        contractExecuteTimestamp = contractCallResult.contractExecuteTimestamp;
        contractExecutedTransactionId = contractCallResult.contractExecutedTransactionId;

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
        // 5. simple crypto trasnfer to ensure file close
        await utils.sendFileClosingCryptoTransfer(primaryAccountInfo.accountId, client);
        await utils.sendFileClosingCryptoTransfer(secondaryAccountInfo.accountId, client);

        logger.info(`Setting up Mirror Node Client for ${process.env['MIRROR_NODE_URL']} env`);
        this.mirrorNodeClient = Axios.create({
            baseURL: `${process.env['MIRROR_NODE_URL']}/api/v1`,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            timeout: 5 * 1000
        });

        // allow retries given mirror node waits for consensus, record stream serialization, export and import before parsing and exposing
        axiosRetry(this.mirrorNodeClient, {
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
        const mirrorContractDetailsResponse = await callMirrorNode(this.mirrorNodeClient, `/contracts/${contractId}/results/${contractExecuteTimestamp}`);
        mirrorContractDetails = mirrorContractDetailsResponse.data;

        // get block
        const mirrorBlockResponse = await callMirrorNode(this.mirrorNodeClient, `/blocks?block.number=${mirrorContractDetails.block_number}`);
        const mirrorBlockResponse = await utils.callMirrorNode(mirrorNodeClient, `/blocks?block.number=${mirrorContractDetails.block_number}`);
        mirrorBlock = mirrorBlockResponse.data.blocks[0];

        const mirrorPrimaryAccountResponse = await callMirrorNode(this.mirrorNodeClient, `accounts?account.id=${primaryAccountInfo.accountId}`);
        const mirrorPrimaryAccountResponse = await utils.callMirrorNode(mirrorNodeClient, `accounts?account.id=${primaryAccountInfo.accountId}`);
        mirrorPrimaryAccount = mirrorPrimaryAccountResponse.data.accounts[0];

        const mirrorSecondaryAccountResponse = await callMirrorNode(this.mirrorNodeClient, `accounts?account.id=${secondaryAccountInfo.accountId}`);
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
        expect(res.data.result).to.be.equal('0x12a');
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

    it('should execute "eth_getBalance" for primary account', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [mirrorPrimaryAccount.evm_address, 'latest']);
        expect(res.data.result).to.eq('0x1095793487fe22cac00');
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
        expect(res.data.result).to.eq('0x1095793487fe22cac00');
    });

    it('should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_getBalance', [utils.idToEvmAddress(contractId.toString()), 'latest']);
        expect(res.data.result).to.eq('0x56bc75e2d63100000');
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

    it('should execute "eth_getWork"', async function () {
        utils.callUnsupportedRelayMethod(this.relayClient, 'eth_getWork', []);
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

    it('should execute "eth_sendRawTransaction" for legacy transactions', async function () {
        const signedTx = await utils.signRawTransaction({
            ...defaultLegacyTransactionData,
            to: mirrorContract.evm_address
        }, ethCompPrivateKey3);

        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.result).to.be.equal('0x93c4b87f7fe3d6071a9c58acf5b64ec976c60ca2017f21fac42f445472885727');
    });

    it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions', async function () {
        // INVALID_ETHEREUM_TX
        const signedTx = await utils.signRawTransaction({
            ...defaultLegacy2930TransactionData,
            to: mirrorContract.evm_address,
            nonce: 1
        }, ethCompPrivateKey3);

        const res = await utils.callFailingRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.error.message).to.be.equal('Internal error');
        expect(res.data.error.code).to.be.equal(-32603);
    });

    it('should execute "eth_sendRawTransaction" for London transactions', async function () {
        const signedTx = await utils.signRawTransaction({
            ...defaultLondonTransactionData,
            to: mirrorContract.evm_address,
            nonce: 1
        }, ethCompPrivateKey3);

        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', [signedTx]);
        expect(res.data.result).to.be.equal('0x0a0bf0ecf2875f660ce2ccd3e9168b76ba56691fdee3a3400f91a8cc0ba51b47');
    });

    it('should execute "eth_syncing"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_syncing', []);
        expect(res.data.result).to.be.equal(false);
    });

    it('should execute "web3_client_version"', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'web3_client_version', []);
        expect(res.data.result).to.contain('relay/');
    });

    it('should execute "eth_protocolVersion"', async function () {
        utils.callUnsupportedRelayMethod(this.relayClient, 'eth_protocolVersion', []);
    });

    //callRelay
    ===================================

        expect(resp).to.not.be.null;
        expect(resp).to.have.property('data');
        expect(resp.data).to.have.property('id');
        expect(resp.data).to.have.property('jsonrpc');
        expect(resp.data.jsonrpc).to.be.equal('2.0');

        return resp;
    };

    const setupClient = () => {
        opPrivateKey = PrivateKey.fromString(process.env.OPERATOR_KEY_MAIN);
        const hederaNetwork: string = process.env.HEDERA_NETWORK || '{}';

        if (hederaNetwork.toLowerCase() in supportedEnvs) {
            client = Client.forName(hederaNetwork);
        } else {
            client = Client.forNetwork(JSON.parse(hederaNetwork));
        }

        client.setOperator(AccountId.fromString(process.env.OPERATOR_ID_MAIN), opPrivateKey);
    };

    const createEthCompatibleAccount = async () => {
        const privateKey = PrivateKey.generateECDSA();
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        logger.trace(`New Eth compatible privateKey: ${privateKey}`);
        logger.trace(`New Eth compatible publicKey: ${publicKey}`);
        logger.debug(`New Eth compatible account ID: ${aliasAccountId.toString()}`);

        logger.info(`Transfer transaction attempt`);
        const aliasCreationResponse = await executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(100).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(100)));

        logger.debug(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse.getReceipt(client);

        const balance = await executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        logger.info(`Balances of the new account: ${balance.toString()}`);

        const accountInfo = await executeQuery(new AccountInfoQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId));

        logger.info(`New account Info: ${accountInfo.accountId.toString()}`);
        return { accountInfo, privateKey };
    };

    const createToken = async () => {
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        logger.trace(`symbol = ${symbol}`);
        const resp = await executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(client.operatorAccountId));

        logger.trace(`get token id from receipt`);
        tokenId = resp.tokenId;
        logger.info(`token id = ${tokenId.toString()}`);
    };

    const associateAndTransferToken = async (accountId: AccountId, pk: PrivateKey) => {
        logger.info(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(client)
                .sign(pk));

        logger.debug(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, client.operatorAccountId, -10)
            .addTokenTransfer(tokenId, accountId, 10));

        logger.debug(
            `Sent 10 tokens from account ${client.operatorAccountId.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId));

        logger.debug(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    const sendFileClosingCryptoTransfer = async (accountId: AccountId) => {
        const aliasCreationResponse = await executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar)));

        await aliasCreationResponse.getReceipt(client);

        const balance = await executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(accountId));

        logger.info(`Balances of the new account: ${balance.toString()}`);
    };

    const createParentContract = async () => {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileReceipt = await executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([client.operatorPublicKey])
            .setContents(contractByteCode));

        // Fetch the receipt for transaction that created the file
        // The file ID is located on the transaction receipt
        const fileId = fileReceipt.fileId;
        logger.info(`contract bytecode file: ${fileId.toString()}`);

        // Create the contract
        const contractReceipt = await executeAndGetTransactionReceipt(new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setBytecodeFileId(fileId)
            .setAdminKey(client.operatorPublicKey));

        // Fetch the receipt for the transaction that created the contract

        // The conract ID is located on the transaction receipt
        contractId = contractReceipt.contractId;

        logger.info(`new contract ID: ${contractId.toString()}`);
    };

    const executeContractCall = async () => {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        logger.info(`Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    "createChild",
                    new ContractFunctionParameters()
                        .addUint256(1000)
                ));

        const resp = await getRecordResponseDetails(contractExecTransactionResponse);
        contractExecuteTimestamp = resp.executedTimestamp;
        contractExecutedTransactionId = resp.executedTransactionId;
    };

    const executeQuery = async (query: Query<any>) => {
        try {
            logger.info(`Execute ${query.constructor.name} query`);
            return query.execute(client);
        }
        catch (e) {
            logger.error(e, `Error executing ${query.constructor.name} query`);
        }
    };

    const executeTransaction = async (transaction: Transaction) => {
        try {
            logger.info(`Execute ${transaction.constructor.name} transaction`);
            const resp = await transaction.execute(client);
            logger.info(`Executed transaction ${resp.transactionId.toString()}`);
            return resp;
        }
        catch (e) {
            logger.error(e, `Error executing ${transaction.constructor.name} transaction`);
        }
    };

    const executeAndGetTransactionReceipt = async (transaction: Transaction) => {
        let resp;
        try {
            resp = await executeTransaction(transaction);
            return resp.getReceipt(client);
        }
        catch (e) {
            logger.error(e,
                `Error retrieving receipt for ${resp === undefined ? transaction.constructor.name : resp.transactionId.toString()} transaction`);
        }
    };

    const getRecordResponseDetails = async (resp: TransactionResponse) => {
        logger.info(`Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart.seconds}-${transactionIdNanoString.padStart(9, '0')}`;
        logger.info(`executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    const numberTo0x = (input: number): string => {
        return `0x${input.toString(16)}`;
    };

    const prune0x = (input: string): string => {
        return input.startsWith('0x') ? input.substring(2) : input;
    };
});