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

const utils = new TestUtils(logger);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const useLocalNode = process.env.LOCAL_NODE || 'true';

// const refs
const legacyTransactionHex = 'f864012f83018000947e3a9eaf9bcc39e2ffa38eb30bf7a93feacbc18180827653820277a0f9fbff985d374be4a55f296915002eec11ac96f1ce2df183adf992baa9390b2fa00c1e867cc960d9c74ec2e6a662b7908ec4c8cc9f3091e886bcefbeb2290fb792';
const eip155TransactionHex = 'f86c098504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a028ef61340bd939bc2195fe537567866003e1a15d3c71ff63e1590620aa636276a067cbe9d8997f761aecb703304b3800ccf555c9f3dc64214b297fb1966a3b6d83';
const londonTransactionHex = '02f902e082012a80a00000000000000000000000000000000000000000000000000000000000004e20a0000000000000000000000000000000000000000000000000000000746a528800830f42408080b9024d608060405261023a806100136000396000f3fe60806040526004361061003f5760003560e01c806312065fe01461008f5780633ccfd60b146100ba5780636f64234e146100d1578063b6b55f251461012c575b3373ffffffffffffffffffffffffffffffffffffffff167ff1b03f708b9c39f453fe3f0cef84164c7d6f7df836df0796e1e9c2bce6ee397e346040518082815260200191505060405180910390a2005b34801561009b57600080fd5b506100a461015a565b6040518082815260200191505060405180910390f35b3480156100c657600080fd5b506100cf610162565b005b3480156100dd57600080fd5b5061012a600480360360408110156100f457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190803590602001909291905050506101ab565b005b6101586004803603602081101561014257600080fd5b81019080803590602001909291905050506101f6565b005b600047905090565b3373ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f193505050501580156101a8573d6000803e3d6000fd5b50565b8173ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501580156101f1573d6000803e3d6000fd5b505050565b80341461020257600080fd5b5056fea265627a7a72315820f8f84fc31a845064b5781e908316f3c591157962deabb0fd424ed54f256400f964736f6c63430005110032c001a01f7e8e436e6035ef7e5cd1387e2ad679e74d6a78a2736efe3dee72e531e28505a042b40a9cf56aad4530a5beaa8623f1ac3554d59ac1e927c672287eb45bfe7b8d';
const nonExistingAddress = '0x5555555555555555555555555555555555555555';

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
        const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await utils.createEthCompatibleAccount(client);
        const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await utils.createEthCompatibleAccount(client);

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

        const mirrorNodeClient = Axios.create({
            baseURL: 'http://localhost:5551/api/v1',
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            timeout: 5 * 1000
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

    it('should execute eth_sendRawTransaction legacy', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', ['0x' + legacyTransactionHex]);
        expect(res.data.result).to.be.equal('0x9ffbd69c44cf643ed8d1e756b505e545e3b5dd3a6b5ef9da1d8eca6679706594');
    });

    it('should execute "eth_sendRawTransaction" london', async function () {
        const res = await utils.callSupportedRelayMethod(this.relayClient, 'eth_sendRawTransaction', ['0x' + londonTransactionHex]);
        expect(res.data.result).to.be.equal('0xcdbbfb6400aab319f97d32c38e285f0d0399c2b48b683f04878b5f07eb0d50e3');
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

});