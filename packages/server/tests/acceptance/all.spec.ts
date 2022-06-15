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
import dotenv from 'dotenv';
import path from 'path';
import shell from 'shelljs';
import {BigNumber} from "ethers";


// local resources
import parentContract from '../parentContract/Parent.json';
import app from '../../src/server';
import TestUtils from '../helpers/utils';
import Assertions from '../helpers/assertions';

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
    gasPrice: 720000000000,
    gasLimit: 3000000
};

const default155TransactionData = {
    ...defaultLegacyTransactionData,
    chainId: defaultChainId
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
let utils;
let tokenId;
let contractId;
let contractExecuteTimestamp;
let mirrorBlock;
let mirrorContract;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;
let accountEvmAddr;
const accounts :any[] = [];

describe('RPC Server Acceptance Tests', async function () {
    this.timeout(240 * 1000);

    before(async function () {
        const serverUrl = 'http://localhost:7546';

        utils = new TestUtils({
            mirrorNodeUrl: process.env['MIRROR_NODE_URL'],
            serverUrl,
            services: {
                network: process.env.HEDERA_NETWORK,
                key: process.env.OPERATOR_KEY_MAIN,
                accountId: process.env.OPERATOR_ID_MAIN
            }
        });

        if (useLocalNode === 'true') {
            // set env variables for docker images until local-node is updated
            process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
            process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
            process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
            utils.logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

            // start local-node
            utils.logger.debug('Start local node');
            shell.exec('npx hedera-local restart');
            utils.logger.trace('Hedera Hashgraph local node env started');
        }

        // set up mirror node contents
        utils.logger.info('Submit eth account create transactions via crypto transfers');
        // 1. Crypto create with alias - metamask flow

        accounts[0] = await utils.createEthCompatibleAccount(privateKeyHex1);
        accounts[1] = await utils.createEthCompatibleAccount(privateKeyHex2);
        accounts[2] = await utils.createEthCompatibleAccount(privateKeyHex3);
        accountEvmAddr = utils.idToEvmAddress(accounts[2].accountInfo.accountId.toString());

        utils.logger.info('Create and execute contracts');
        // 2. contract create amd execute
        // Take Parent contract used in mirror node acceptance tests since it's well use
        contractId = await utils.createParentContract(parentContract);
        const contractCallResult = await utils.executeContractCall(contractId);
        contractExecuteTimestamp = contractCallResult.contractExecuteTimestamp;

        utils.logger.info('Create parent contract with AccountOne');
        await accounts[0].utils.createParentContract(parentContract);
        await accounts[0].utils.executeContractCall(contractId);

        utils.logger.info('Create token');
        // 3. Token create
        tokenId = await utils.createToken();

        utils.logger.info('Associate and transfer tokens');
        // 4. associate and transfer 2 tokens
        await utils.associateAndTransferToken(accounts[0].accountInfo.accountId, accounts[0].privateKey, tokenId);
        await utils.associateAndTransferToken(accounts[1].accountInfo.accountId, accounts[1].privateKey, tokenId);

        utils.logger.info('Send file close crypto transfers');
        // 5. simple crypto transfer to ensure file close
        await utils.sendFileClosingCryptoTransfer(accounts[0].accountInfo.accountId);
        await utils.sendFileClosingCryptoTransfer(accounts[1].accountInfo.accountId);

        // get contract details
        const mirrorContractResponse = await utils.callMirrorNode(`/contracts/${contractId}`);
        mirrorContract = mirrorContractResponse.data;

        // get contract details
        const mirrorContractDetailsResponse = await utils.callMirrorNode(`/contracts/${contractId}/results/${contractExecuteTimestamp}`);
        mirrorContractDetails = mirrorContractDetailsResponse.data;

        // get block
        const mirrorBlockResponse = await utils.callMirrorNode(`/blocks?block.number=${mirrorContractDetails.block_number}`);
        mirrorBlock = mirrorBlockResponse.data.blocks[0];

        const mirrorPrimaryAccountResponse = await utils.callMirrorNode(`accounts?account.id=${accounts[0].accountInfo.accountId}`);
        mirrorPrimaryAccount = mirrorPrimaryAccountResponse.data.accounts[0];

        const mirrorSecondaryAccountResponse = await utils.callMirrorNode(`accounts?account.id=${accounts[1].accountInfo.accountId}`);
        mirrorSecondaryAccount = mirrorSecondaryAccountResponse.data.accounts[0];

        // start relay
        utils.logger.info(`Start relay on port ${process.env.SERVER_PORT}`);
        this.testServer = app.listen({ port: process.env.SERVER_PORT });
    });

    after(function () {
        if (useLocalNode === 'true') {
            // stop local-node
            utils.logger.info('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        utils.logger.info('Stop relay');
        if (this.testServer !== undefined) {
            this.testServer.close();
        }
    });

    it('should execute "eth_chainId"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_chainId', [null]);
        expect(res).to.be.equal(utils.numberTo0x(defaultChainId));
    });

    it('should execute "eth_getBlockByHash"', async function () {
        const blockResult = await utils.callSupportedRelayMethod('eth_getBlockByHash', [mirrorBlock.hash, 'true']);
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(utils.numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockByNumber"', async function () {
        const blockResult = await utils.callSupportedRelayMethod('eth_getBlockByNumber', [mirrorBlock.number, true]);
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(utils.numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockTransactionCountByHash"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getBlockTransactionCountByHash', [mirrorBlock.hash]);
        expect(res).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getBlockTransactionCountByNumber"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getBlockTransactionCountByNumber', [mirrorBlock.number]);
        expect(res).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const transactionResult = await utils.callSupportedRelayMethod('eth_getTransactionByBlockHashAndIndex', [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]);
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(utils.numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const transactionResult = await utils.callSupportedRelayMethod('eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]);
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(utils.numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "net_listening"', async function () {
        const res = await utils.callSupportedRelayMethod('net_listening', []);
        expect(res).to.be.equal('false');
    });

    it('should execute "net_version"', async function () {
        const res = await utils.callSupportedRelayMethod('net_version', []);
        expect(res).to.be.equal('0x12a');
    });

    it('should execute "eth_estimateGas"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_estimateGas', []);
        expect(res).to.contain('0x');
        expect(res).to.not.be.equal('0x');
        expect(res).to.not.be.equal('0x0');
    });

    it('should execute "eth_gasPrice"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_gasPrice', []);
        expect(res).to.be.equal('0xa7a3582000');
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getUncleByBlockHashAndIndex', []);
        expect(res).to.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getUncleByBlockNumberAndIndex', []);
        expect(res).to.be.null;
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getUncleCountByBlockHash', []);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getUncleCountByBlockNumber', []);
        expect(res).to.be.equal('0x0');
    });

    it('should not support "eth_getWork"', async function () {
        await utils.callUnsupportedRelayMethod('eth_getWork', []);
    });

    it('should not support "eth_coinbase"', async function () {
        await utils.callUnsupportedRelayMethod('eth_coinbase', []);
    });

    it('should not support "eth_sendTransaction"', async function () {
        await utils.callUnsupportedRelayMethod('eth_sendTransaction', []);
    });

    it('should return empty on "eth_accounts"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_accounts', []);
        expect(res).to.deep.equal([]);
    });

    it('should execute "eth_hashrate"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_hashrate', []);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_mining"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_mining', []);
        expect(res).to.be.equal(false);
    });

    it('should execute "eth_submitWork"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_submitWork', []);
        expect(res).to.be.equal(false);
    });

    it('should not support "eth_submitHashrate"', async function () {
        await utils.callUnsupportedRelayMethod('eth_submitHashrate', []);
    });

    it('should execute "eth_getBalance" for newly created account with 5000 HBAR', async function () {
        const { accountInfo } = await utils.createEthCompatibleAccount(null, 5000);
        const mirrorResponse = await utils.callMirrorNode(`accounts/${accountInfo.accountId}`);
        const mirrorAccount = mirrorResponse.data;
        const res = await utils.callSupportedRelayMethod('eth_getBalance', [mirrorAccount.evm_address, 'latest']);
        expect(res).to.eq('0x10f0777f464e77a2400');
    });

    it('should execute "eth_getBalance" for non-existing address', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getBalance', [nonExistingAddress, 'latest']);
        expect(res).to.eq('0x0');
    });

    it('should execute "eth_getBalance" for contract', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getBalance', [mirrorContract.evm_address, 'latest']);
        expect(res).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_getBalance" for account with id converted to evm_address', async function () {
        const { accountInfo } = await utils.createEthCompatibleAccount(null, 5000);
        const accountId = accountInfo.accountId.toString();
        const evmAddress = utils.idToEvmAddress(accountId);

        // wait for the account to be imported in the Mirror Node
        await utils.callMirrorNode(`accounts/${accountId}`);
        const res = await utils.callSupportedRelayMethod('eth_getBalance', [evmAddress, 'latest']);
        expect(res).to.eq('0x10f0777f464e77a2400');
    });

    it('should execute "eth_getBalance" for contract with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getBalance', [utils.idToEvmAddress(contractId.toString()), 'latest']);
        expect(res).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_sendRawTransaction" for legacy EIP 155 transactions', async function () {
        const senderInitialBalance = await utils.getBalance(accountEvmAddr);
        const receiverInitialBalance = await utils.getBalance(mirrorContract.evm_address);

        const signedTx = await utils.signRawTransaction({
            ...default155TransactionData,
            to: mirrorContract.evm_address
        }, accounts[2].privateKey);

        const res = await utils.callSupportedRelayMethod('eth_sendRawTransaction', [signedTx]);
        expect(res).to.be.equal('0x872d83c28c30ec48befb6cd77c1588e5589e00b7c61fcbc942a5b26ea23b9694');

        const senderEndBalance = await utils.getBalance(accountEvmAddr);
        const receiverEndBalance = await utils.getBalance(mirrorContract.evm_address);

        expect(utils.subtractBigNumberHexes(receiverEndBalance, receiverInitialBalance).toHexString()).to.eq(oneHbarInWeiHexString);
        expect(senderInitialBalance).to.not.eq(senderEndBalance);
        expect(utils.subtractBigNumberHexes(senderInitialBalance, senderEndBalance).toHexString()).to.not.eq(oneHbarInWeiHexString);
        expect(BigNumber.from(senderInitialBalance).sub(BigNumber.from(senderEndBalance)).gt(0)).to.eq(true);

    });

    it('should fail "eth_sendRawTransaction" for Legacy transactions (with no chainId)', async function () {
        const signedTx = await utils.signRawTransaction({
            ...defaultLegacyTransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(accountEvmAddr)
        }, accounts[2].privateKey);

        const res = await utils.callFailingRelayMethod('eth_sendRawTransaction', [signedTx]);
        expect(res.error.message).to.be.equal('Internal error');
        expect(res.error.code).to.be.equal(-32603);
    });

    it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions', async function () {
        const signedTx = await utils.signRawTransaction({
            ...defaultLegacy2930TransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(accountEvmAddr)
        }, accounts[2].privateKey);

        const res = await utils.callFailingRelayMethod('eth_sendRawTransaction', [signedTx]);
        expect(res.error.message).to.be.equal('Internal error');
        expect(res.error.code).to.be.equal(-32603);
    });

    it('should execute "eth_sendRawTransaction" for London transactions', async function () {
        const senderInitialBalance = await utils.getBalance(accountEvmAddr);
        const receiverInitialBalance = await utils.getBalance(mirrorContract.evm_address);

        const signedTx = await utils.signRawTransaction({
            ...defaultLondonTransactionData,
            to: mirrorContract.evm_address,
            nonce:  await utils.getAccountNonce(accountEvmAddr)
        }, accounts[2].privateKey);

        const res = await utils.callSupportedRelayMethod('eth_sendRawTransaction', [signedTx]);
        expect(res).to.be.equal('0xcf7df11282f835c05be88f9cc95e41f706fc12bd0833afd0212df32eeaf3eaf1');

        const senderEndBalance = await utils.getBalance(accountEvmAddr);
        const receiverEndBalance = await utils.getBalance(mirrorContract.evm_address);

        expect(utils.subtractBigNumberHexes(receiverEndBalance, receiverInitialBalance).toHexString()).to.eq(oneHbarInWeiHexString);
        expect(senderInitialBalance).to.not.eq(senderEndBalance);
        expect(utils.subtractBigNumberHexes(senderInitialBalance, senderEndBalance).toHexString()).to.not.eq(oneHbarInWeiHexString);
        expect(BigNumber.from(senderInitialBalance).sub(BigNumber.from(senderEndBalance)).gt(0)).to.eq(true);
    });

    it('should execute "eth_syncing"', async function () {
        const res = await utils.callSupportedRelayMethod('eth_syncing', []);
        expect(res).to.be.equal(false);
    });

    it('should execute "web3_client_version"', async function () {
        const res = await utils.callSupportedRelayMethod('web3_client_version', []);
        expect(res).to.contain('relay/');
    });

    it('should not support "eth_protocolVersion"', async function () {
        await utils.callUnsupportedRelayMethod('eth_protocolVersion', []);
    });

    it('should not support "eth_sign"', async function () {
        await utils.callUnsupportedRelayMethod('eth_sign', []);
    });

    it('should not support "eth_signTransaction"', async function () {
        await utils.callUnsupportedRelayMethod('eth_signTransaction', []);
    });

    it('should execute "eth_getTransactionCount" primary', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [mirrorPrimaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" secondary', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [mirrorSecondaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [mirrorContract.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for account with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [utils.idToEvmAddress(mirrorPrimaryAccount.account), mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract with id converted to evm_address', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [utils.idToEvmAddress(contractId.toString()), mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for non-existing address', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [nonExistingAddress, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" for account with non-zero nonce', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionCount', [accountEvmAddr, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x2');
    });

    it('should execute "eth_getTransactionReceipt" for hash of legacy transaction', async function () {
        const txRequest = {
            ...default155TransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(accountEvmAddr)
        };
        const submittedLegacyTransactionHash = await utils.sendRawTransaction(txRequest, accounts[2].privateKey);
        const res = await utils.callSupportedRelayMethod('eth_getTransactionReceipt', [submittedLegacyTransactionHash]);
        Assertions.transactionReceipt(res, txRequest, { from: accountEvmAddr });

    });

    it('should execute "eth_getTransactionReceipt" for hash of London transaction', async function () {
        const txRequest = {
            ...defaultLondonTransactionData,
            to: mirrorContract.evm_address,
            nonce: await utils.getAccountNonce(accountEvmAddr)
        };
        const submittedLondonTransactionHash = await utils.sendRawTransaction(txRequest, accounts[2].privateKey);
        const res = await utils.callSupportedRelayMethod('eth_getTransactionReceipt', [submittedLondonTransactionHash]);
        Assertions.transactionReceipt(res, txRequest, { from: accountEvmAddr });
    });

    it('should execute "eth_getTransactionReceipt" for non-existing hash', async function () {
        const res = await utils.callSupportedRelayMethod('eth_getTransactionReceipt', [nonExistingTxHash]);
        expect(res).to.be.null;
    });
});