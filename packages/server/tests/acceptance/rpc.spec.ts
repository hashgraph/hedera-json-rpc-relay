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
import { BigNumber, ethers } from 'ethers';

import pino from 'pino';
import ServicesClient from '../clients/servicesClient';
import MirrorClient from '../clients/mirrorClient';
import RelayClient from '../clients/relayClient';
import app from '../../dist/server';
import Assertions from '../helpers/assertions';
import { Utils } from '../helpers/utils';
import { AccountBalanceQuery } from '@hashgraph/sdk';

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

// local resources
const contractJson = require('../parentContract/Parent.json');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// const refs
// const privateKeyHex1 = 'a3e5428dd97d479b1ee4690ef9ec627896020d79883c38e9c1e9a45087959888';
// const privateKeyHex2 = '93239c5e19d76c0bd5d62d713cd90f0c3af80c9cb467db93fd92f3772c00985f';
// const privateKeyHex3 = '3e389f612c4b27de9c817299d2b3bd0753b671036608a30a90b0c4bea8b97e74';

// cached entities
let tokenId;
let contractId;
let contractExecuteTimestamp;
let mirrorBlock;
let mirrorContract;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;

const USE_LOCAL_NODE = process.env.LOCAL_NODE || 'true';
const CHAIN_ID = process.env.CHAIN_ID || 0;
const NETWORK = process.env.HEDERA_NETWORK || '';
const OPERATOR_KEY = process.env.OPERATOR_KEY_MAIN || '';
const OPERATOR_ID = process.env.OPERATOR_ID_MAIN || '';
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || '';
const RELAY_URL = 'http://localhost:7546';
const ONE_WEIBAR = ethers.utils.parseUnits("1", 18);
const NON_EXISTING_ADDRESS = '0x5555555555555555555555555555555555555555';

const defaultLegacyTransactionData = {
    value: ONE_WEIBAR,
    gasPrice: 720000000000,
    gasLimit: 3000000
};

const default155TransactionData = {
    ...defaultLegacyTransactionData,
    chainId: Number(CHAIN_ID)
};

const defaultLondonTransactionData = {
    value: ONE_WEIBAR,
    chainId: Number(CHAIN_ID),
    maxPriorityFeePerGas: 720000000000,
    maxFeePerGas: 720000000000,
    gasLimit: 300000,
    type: 2
};

describe('RPC Server Acceptance Tests', function() {
    this.timeout(240 * 1000); // 240 seconds

    const accounts: any[] = [];

    let relayServer; // Relay Server
    const servicesNode = new ServicesClient(NETWORK, OPERATOR_ID, OPERATOR_KEY, logger.child({ name: `services-client` }));
    const mirrorNode = new MirrorClient(MIRROR_NODE_URL, logger.child({ name: `mirror-node-client` }));
    const relay = new RelayClient(RELAY_URL, logger.child({ name: `relay-client` }));

    before(async () => {

        if (USE_LOCAL_NODE === 'true') {
            runLocalHederaNetwork();
        }

        // start relay
        logger.info(`Start relay on port ${process.env.SERVER_PORT}`);
        relayServer = app.listen({ port: process.env.SERVER_PORT });

        accounts[0] = await servicesNode.createAliasAccount();
        accounts[1] = await servicesNode.createAliasAccount();
        accounts[2] = await servicesNode.createAliasAccount();
        contractId = await accounts[0].client.createParentContract(contractJson);
        contractExecuteTimestamp = (await accounts[0].client.executeContractCall(contractId)).contractExecuteTimestamp;

        tokenId = await servicesNode.createToken();
        logger.info('Associate and transfer tokens');
        await accounts[0].client.associateToken(tokenId);
        await accounts[1].client.associateToken(tokenId);
        await servicesNode.transferToken(tokenId, accounts[0].accountId);
        await servicesNode.transferToken(tokenId, accounts[1].accountId);

        // simple crypto transfer to ensure file close
        await servicesNode.sendFileClosingCryptoTransfer(accounts[0].accountId);
        await servicesNode.sendFileClosingCryptoTransfer(accounts[1].accountId);

        // get contract details
        mirrorContract = await mirrorNode.get(`/contracts/${contractId}`);

        // // get contract details
        mirrorContractDetails = await mirrorNode.get(`/contracts/${contractId}/results/${contractExecuteTimestamp}`);

        // get block
        mirrorBlock = (await mirrorNode.get(`/blocks?block.number=${mirrorContractDetails.block_number}`)).blocks[0];

        mirrorPrimaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[0].accountId}`)).accounts[0];
        mirrorSecondaryAccount = (await mirrorNode.get(`accounts?account.id=${accounts[1].accountId}`)).accounts[0];
    });

    describe('Block related RPC calls', () => {

        it('should execute "eth_getBlockByHash"', async function() {
            const relayBlock = await relay.call('eth_getBlockByHash', [mirrorBlock.hash, 'true']);
            Assertions.block(relayBlock, mirrorBlock);
        });

        it('should execute "eth_getBlockByNumber"', async function() {
            const blockResult = await relay.call('eth_getBlockByNumber', [mirrorBlock.number, true]);
            Assertions.block(blockResult, mirrorBlock);
        });

        it('should execute "eth_getBlockTransactionCountByHash"', async function() {
            const res = await relay.call('eth_getBlockTransactionCountByHash', [mirrorBlock.hash]);
            expect(res).to.be.equal(mirrorBlock.count);
        });

        it('should execute "eth_getBlockTransactionCountByNumber"', async function() {
            const res = await relay.call('eth_getBlockTransactionCountByNumber', [mirrorBlock.number]);
            expect(res).to.be.equal(mirrorBlock.count);
        });

    });

    describe('Transaction related RPC Calls', () => {

        it('should execute "eth_getTransactionByBlockHashAndIndex"', async function() {
            const response = await relay.call('eth_getTransactionByBlockHashAndIndex',
                [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]);
            Assertions.transaction(response, mirrorContractDetails);
        });

        it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function() {
            const response = await relay.call('eth_getTransactionByBlockNumberAndIndex', [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]);
            Assertions.transaction(response, mirrorContractDetails);
        });

        it('should execute "eth_getTransactionReceipt" for hash of legacy transaction', async function() {
            const transaction = {
                ...default155TransactionData,
                to: mirrorContract.evm_address,
                nonce: await relay.getAccountNonce(accounts[2].address)
            };
            const signedTx = await accounts[2].wallet.signTransaction(transaction);
            const legacyTxHash = await relay.sendRawTransaction(signedTx);
            // Since the transactionId is not available in this context
            // Wait for the transaction to be processed and imported in the mirror node with axios-retry
            await mirrorNode.get(`contracts/results/${legacyTxHash}`);

            const res = await relay.call('eth_getTransactionReceipt', [legacyTxHash]);
            // FIXME here we must assert that the alias address is the `from` / `to` and not the `0x` prefixed one
            Assertions.transactionReceipt(res, transaction, { from: Utils.idToEvmAddress(accounts[2].accountId.toString()) });
        });

        it('should execute "eth_getTransactionReceipt" for hash of London transaction', async function() {
            const transaction = {
                ...defaultLondonTransactionData,
                to: mirrorContract.evm_address,
                nonce: await relay.getAccountNonce(accounts[2].address)
            };
            const signedTx = await accounts[2].wallet.signTransaction(transaction);
            const transactionHash = await relay.sendRawTransaction(signedTx);
            // Since the transactionId is not available in this context
            // Wait for the transaction to be processed and imported in the mirror node with axios-retry
            await mirrorNode.get(`contracts/results/${transactionHash}`);

            const res = await relay.call('eth_getTransactionReceipt', [transactionHash]);
            // FIXME here we must assert that the alias address is the `from` / `to` and not the `0x` prefixed one
            Assertions.transactionReceipt(res, transaction, { from: Utils.idToEvmAddress(accounts[2].accountId.toString()) });
        });

        it('should execute "eth_getTransactionReceipt" for non-existing hash', async function() {
            const nonExistingTxHash = '0x5555555555555555555555555555555555555555555555555555555555555555';
            const res = await relay.call('eth_getTransactionReceipt', [nonExistingTxHash]);
            expect(res).to.be.null;
        });

    });

    describe('sendRawTransaction RPC Calls', () => {

        it('should execute "eth_sendRawTransaction" for legacy EIP 155 transactions', async function() {
            const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
            const transaction = {
                ...defaultLondonTransactionData,
                to: mirrorContract.evm_address,
                nonce: await relay.getAccountNonce(accounts[2].address)
            };
            const signedTx = await accounts[2].wallet.signTransaction(transaction);
            const transactionHash = await relay.sendRawTransaction(signedTx);
            // Since the transactionId is not available in this context
            // Wait for the transaction to be processed and imported in the mirror node with axios-retry
            await mirrorNode.get(`contracts/results/${transactionHash}`);

            const receiverEndBalance = await relay.getBalance(mirrorContract.evm_address);
            const balanceChange = receiverEndBalance.sub(receiverInitialBalance);
            expect(balanceChange.toString()).to.eq(ONE_WEIBAR.toString());
        });

        xit('should fail "eth_sendRawTransaction" for Legacy transactions (with no chainId)', async function() {
            const transaction = {
                ...defaultLegacyTransactionData,
                to: mirrorContract.evm_address,
                nonce: await relay.getAccountNonce(accounts[2].address)
            };
            const signedTx = await accounts[2].wallet.signTransaction(transaction);
            const res = await relay.call('eth_sendRawTransaction', [signedTx]);
            expect(res.error.message).to.be.equal('Unknown error invoking RPC');
            expect(res.error.code).to.be.equal(-32603);
        });

        // it('should fail "eth_sendRawTransaction" for Legacy 2930 transactions', async function() {
        //     const signedTx = await utils.signRawTransaction({
        //         ...defaultLegacy2930TransactionData,
        //         to: mirrorContract.evm_address,
        //         nonce: await utils.getAccountNonce(accounts[2].address)
        //     }, accounts[2].privateKey);
        //
        //     const res = await utils.callFailingRelayMethod('eth_sendRawTransaction', [signedTx]);
        //     expect(res.error.message).to.be.equal('Unknown error invoking RPC');
        //     expect(res.error.code).to.be.equal(-32603);
        // });

        // it('should execute "eth_sendRawTransaction" for London transactions', async function() {
        //     const senderInitialBalance = await relay.getBalance(accounts[2].address);
        //     const receiverInitialBalance = await relay.getBalance(mirrorContract.evm_address);
        //
        //     const signedTx = await utils.signRawTransaction({
        //         ...defaultLondonTransactionData,
        //         to: mirrorContract.evm_address,
        //         nonce: await utils.getAccountNonce(accounts[2].address)
        //     }, accounts[2].privateKey);
        //
        //     const res = await relay.call('eth_sendRawTransaction', [signedTx]);
        //     expect(res).to.be.equal('0xcf7df11282f835c05be88f9cc95e41f706fc12bd0833afd0212df32eeaf3eaf1');
        //
        //     const senderEndBalance = await relay.getBalance(accounts[2].address);
        //     const receiverEndBalance = await relay.getBalance(mirrorContract.evm_address);
        //
        //     expect(Utils.subtractBigNumberHexes(receiverEndBalance, receiverInitialBalance).toHexString()).to.eq(oneHbarInWeiHexString);
        //     expect(senderInitialBalance).to.not.eq(senderEndBalance);
        //     expect(Utils.subtractBigNumberHexes(senderInitialBalance, senderEndBalance).toHexString()).to.not.eq(oneHbarInWeiHexString);
        //     expect(BigNumber.from(senderInitialBalance).sub(BigNumber.from(senderEndBalance)).gt(0)).to.eq(true);
        // });
    });

    it('should execute "eth_estimateGas"', async function() {
        const res = await relay.call('eth_estimateGas', []);
        expect(res).to.contain('0x');
        expect(res).to.not.be.equal('0x');
        expect(res).to.not.be.equal('0x0');
    });

    it('should execute "eth_gasPrice"', async function() {
        const res = await relay.call('eth_gasPrice', []);
        expect(res).to.be.equal('0xa7a3582000');
    });

    it('should execute "eth_getBalance" for newly created account with 1000 HBAR', async function() {
        const account = await servicesNode.createAliasAccount();
        // Wait for account creation to propagate
        console.log(await mirrorNode.get(`/accounts/${account.accountId}`));

        const res = await relay.call('eth_getBalance', [account.address, 'latest']);
        const balance = await servicesNode.executeQuery(new AccountBalanceQuery()
            .setAccountId(account.accountId));
        const balanceInWeiBars = BigNumber.from(balance.hbars.toTinybars().toString()).mul(10 ** 10);
        expect(res).to.eq(ethers.utils.hexlify(balanceInWeiBars));
    });

    it('should execute "eth_getBalance" for non-existing address', async function() {
        const res = await relay.call('eth_getBalance', [NON_EXISTING_ADDRESS, 'latest']);
        expect(res).to.eq('0x0');
    });

    it('should execute "eth_getBalance" for contract', async function() {
        const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), 'latest']);
        expect(res).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_getBalance" for contract with id converted to evm_address', async function() {
        const res = await relay.call('eth_getBalance', [Utils.idToEvmAddress(contractId.toString()), 'latest']);
        expect(res).to.eq('0x56bc75e2d63100000');
    });

    it('should execute "eth_getTransactionCount" primary', async function() {
        const res = await relay.call('eth_getTransactionCount', [mirrorPrimaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" secondary', async function() {
        const res = await relay.call('eth_getTransactionCount', [mirrorSecondaryAccount.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract', async function() {
        const res = await relay.call('eth_getTransactionCount', [mirrorContract.evm_address, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for account with id converted to evm_address', async function() {
        const res = await relay.call('eth_getTransactionCount', [Utils.idToEvmAddress(mirrorPrimaryAccount.account), mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount" contract with id converted to evm_address', async function() {
        const res = await relay.call('eth_getTransactionCount', [Utils.idToEvmAddress(contractId.toString()), mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x1');
    });

    it('should execute "eth_getTransactionCount" for non-existing address', async function() {
        const res = await relay.call('eth_getTransactionCount', [NON_EXISTING_ADDRESS, mirrorContractDetails.block_number]);
        expect(res).to.be.equal('0x0');
    });

    // it('should execute "eth_getTransactionCount" for account with non-zero nonce', async function() {
    //     const res = await relay.call('eth_getTransactionCount', [accounts[2].address, mirrorContractDetails.block_number]);
    //     expect(res).to.be.equal('0x2');
    // });

    describe('Hardcoded RPC Endpoints', () => {

        it('should execute "eth_chainId"', async function() {
            const res = await relay.call('eth_chainId', [null]);
            expect(res).to.be.equal(CHAIN_ID);
        });

        it('should execute "net_listening"', async function() {
            const res = await relay.call('net_listening', []);
            expect(res).to.be.equal('false');
        });

        it('should execute "net_version"', async function() {
            const res = await relay.call('net_version', []);
            expect(res).to.be.equal(CHAIN_ID);
        });

        it('should execute "eth_getUncleByBlockHashAndIndex"', async function() {
            const res = await relay.call('eth_getUncleByBlockHashAndIndex', []);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleByBlockNumberAndIndex"', async function() {
            const res = await relay.call('eth_getUncleByBlockNumberAndIndex', []);
            expect(res).to.be.null;
        });

        it('should execute "eth_getUncleCountByBlockHash"', async function() {
            const res = await relay.call('eth_getUncleCountByBlockHash', []);
            expect(res).to.be.equal('0x0');
        });

        it('should execute "eth_getUncleCountByBlockNumber"', async function() {
            const res = await relay.call('eth_getUncleCountByBlockNumber', []);
            expect(res).to.be.equal('0x0');
        });

        it('should return empty on "eth_accounts"', async function() {
            const res = await relay.call('eth_accounts', []);
            expect(res).to.deep.equal([]);
        });

        it('should execute "eth_hashrate"', async function() {
            const res = await relay.call('eth_hashrate', []);
            expect(res).to.be.equal('0x0');
        });

        it('should execute "eth_mining"', async function() {
            const res = await relay.call('eth_mining', []);
            expect(res).to.be.equal(false);
        });

        it('should execute "eth_submitWork"', async function() {
            const res = await relay.call('eth_submitWork', []);
            expect(res).to.be.equal(false);
        });

        it('should execute "eth_syncing"', async function() {
            const res = await relay.call('eth_syncing', []);
            expect(res).to.be.equal(false);
        });

        it('should execute "web3_client_version"', async function() {
            const res = await relay.call('web3_client_version', []);
            expect(res).to.contain('relay/');
        });

    });

    describe('Unsupported RPC Endpoints', () => {

        it('should not support "eth_submitHashrate"', async function() {
            await relay.callUnsupported('eth_submitHashrate', []);
        });

        it('should not support "eth_getWork"', async function() {
            await relay.callUnsupported('eth_getWork', []);
        });

        it('should not support "eth_coinbase"', async function() {
            await relay.callUnsupported('eth_coinbase', []);
        });

        it('should not support "eth_sendTransaction"', async function() {
            await relay.callUnsupported('eth_sendTransaction', []);
        });

        it('should not support "eth_protocolVersion"', async function() {
            await relay.callUnsupported('eth_protocolVersion', []);
        });

        it('should not support "eth_sign"', async function() {
            await relay.callUnsupported('eth_sign', []);
        });

        it('should not support "eth_signTransaction"', async function() {
            await relay.callUnsupported('eth_signTransaction', []);
        });
    });

    after(function() {
        if (USE_LOCAL_NODE === 'true') {
            // stop local-node
            logger.info('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        logger.info('Stop relay');
        if (relayServer !== undefined) {
            relayServer.close();
        }
    });

    function runLocalHederaNetwork() {
        // set env variables for docker images until local-node is updated
        process.env['NETWORK_NODE_IMAGE_TAG'] = '0.26.2';
        process.env['HAVEGED_IMAGE_TAG'] = '0.26.2';
        process.env['MIRROR_IMAGE_TAG'] = '0.58.0';
        logger.trace(`Docker container versions, services: ${process.env['NETWORK_NODE_IMAGE_TAG']}, mirror: ${process.env['MIRROR_IMAGE_TAG']}`);

        // start local-node
        logger.debug('Start local node');
        shell.exec('npx hedera-local restart');
        logger.trace('Hedera Hashgraph local node env started');
    }
});