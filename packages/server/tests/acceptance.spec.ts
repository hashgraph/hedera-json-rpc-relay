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

import {
    Client,
    PrivateKey,
    Hbar,
    HbarUnit,
    AccountId,
    AccountBalanceQuery,
    AccountInfoQuery,
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    FileCreateTransaction,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    TransferTransaction,
} from "@hashgraph/sdk";

import app from '../src/server';

import Axios, { AxiosInstance } from 'axios';
import { expect } from 'chai';
import path from 'path';
import dotenv from 'dotenv';
import shell from 'shelljs';
import crypto from 'crypto';

; import parentContract from './parentContract/Parent.json';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const useLocalNode = process.env.LOCAL_NODE || 'true';

let client: Client;
let tokenId;
let opPrivateKey;
let contractId;
let contractExecuteTimestamp;
let contractExecutedTransactionId;
let mirrorBlock;
let mirrorContractDetails;
let mirrorPrimaryAccount;
let mirrorSecondaryAccount;

describe('RPC Server Integration Tests', async function () {
    this.timeout(180 * 1000);

    before(async function () {
        console.log('Setting up SDK Client for local instances');
        setupClient();

        if (useLocalNode === 'true') {
            // start local-node
            console.log('Start local node and genereate accounts');
            shell.exec('npx hedera-local start');
            shell.exec('npx hedera-local generate-accounts 0');
        }

        // set up mirror node contents
        console.log('Submit eth account create transactions via crypto transfers');
        // 1. Crypto create with alias - metamask flow
        const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await createEthCompatibleAccount();
        const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await createEthCompatibleAccount();

        console.log('Create and execute contracts');
        // 2. contract create amd execute
        // Take Parent contract used in mirror node acceptance tests since it's well use
        await createParentContract();
        await executeContractCall();
        console.log(`*** contractExecuteTimestamp: ${contractExecuteTimestamp}, contractExecutedTransactionId: ${contractExecutedTransactionId}`);

        console.log('Create token');
        // 2. Token create
        await createToken();

        console.log('Associate and transfer tokens');
        // 4. associate and transfer 2 tokens
        await associateAndTransferToken(primaryAccountInfo.accountId, primaryKey);
        await associateAndTransferToken(secondaryAccountInfo.accountId, secondaryKey);

        console.log('Send file close crypto transfers');
        // 5. simple crypto trasnfer to ensure file close
        await sendFileClosingCryptoTransfer(primaryAccountInfo.accountId);
        await sendFileClosingCryptoTransfer(secondaryAccountInfo.accountId);

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
        const mirrorContractDetailsResponse = await callMirrorNode(mirrorNodeClient, `/contracts/${contractId}/results/${contractExecuteTimestamp}`);
        mirrorContractDetails = mirrorContractDetailsResponse.data;
        console.log(`*** mirrorContractDetails: ${JSON.stringify(mirrorContractDetails)}`);

        // get block
        const mirrorBlockResponse = await callMirrorNode(mirrorNodeClient, `/blocks?block.number=${mirrorContractDetails.block_number}`);
        mirrorBlock = mirrorBlockResponse.data.blocks[0];
        console.log(`*** mirrorBlock: ${JSON.stringify(mirrorBlock)}`);

        const mirrorPrimaryAccountResponse = await callMirrorNode(mirrorNodeClient, `accounts?account.id=${primaryAccountInfo.accountId}`);
        mirrorPrimaryAccount = mirrorPrimaryAccountResponse.data.accounts[0];
        console.log(`*** mirrorPrimaryAccount: ${JSON.stringify(mirrorPrimaryAccount)}`);

        const mirrorSecondaryAccountResponse = await callMirrorNode(mirrorNodeClient, `accounts?account.id=${secondaryAccountInfo.accountId}`);
        mirrorSecondaryAccount = mirrorSecondaryAccountResponse.data.accounts[0];
        console.log(`*** mirrorSecondaryAccount: ${JSON.stringify(mirrorSecondaryAccount)}`);

        // may have to calculate the eth public key as metamask would for account hash

        // const mirrorBlocks = await callMirrorNode(mirrorNodeClient, `/blocks`);
        // console.log(`*** mirrorBlocks: ${JSON.stringify(mirrorBlocks.data.blocks)}`);

        // get contract details - transaction
        // const mirrorContractIdResults = await callMirrorNode(mirrorNodeClient, `/contracts/${contractId}/results`);
        // console.log(`*** mirrorContractIdResults: ${JSON.stringify(mirrorContractIdResults.data)}`);

        // const mirrorContractResults = await callMirrorNode(mirrorNodeClient, `/contracts/results`);
        // console.log(`*** mirrorContractResults: ${JSON.stringify(mirrorContractResults.data)}`);

        // const mirrorTransactionsResults = await callMirrorNode(mirrorNodeClient, `/transactions?order=desc&transactiontype=CONTRACTCALL`);
        // console.log(`*** mirrorTransactionsResults: ${JSON.stringify(mirrorTransactionsResults.data)}`);

        // const mirrorContractTransactionIdResults = await callMirrorNode(mirrorNodeClient, `/contracts/results/${contractExecutedTransactionId}`);
        // console.log(`*** mirrorContractTransactionIdResults: ${JSON.stringify(mirrorContractTransactionIdResults.data)}`);

        // const mirrorTransactionIdResults = await callMirrorNode(mirrorNodeClient, `/transactions/${contractExecutedTransactionId}`);
        // console.log(`*** mirrorTransactionIdResults: ${JSON.stringify(mirrorTransactionIdResults.data)}`);

        // start relay
        console.log(`Start relay on port ${process.env.SERVER_PORT}`);
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
            console.log('Shutdown local node');
            shell.exec('npx hedera-local stop');
        }

        // stop relay
        console.log('Stop relay');
        if (this.testServer !== undefined) {
            this.testServer.close();
        }
    });

    it('should execute "eth_chainId"', async function () {
        console.log('Start should execute "eth_chainId');
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_chainId',
            'params': [null]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('0x12a');
    });

    it('should execute "eth_getBlockByHash"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBlockByHash',
            'params': [mirrorBlock.hash, 'true']
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getBlockByNumber"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBlockByNumber',
            'params': [mirrorBlock.number, true]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        const blockResult = res.data.result;
        expect(blockResult.hash).to.be.equal(mirrorBlock.hash.slice(0, 66));
        expect(blockResult.number).to.be.equal(numberTo0x(mirrorBlock.number));
        expect(blockResult).to.have.property('transactions');
        expect(blockResult.transactions.length).to.be.greaterThan(0);
    });

    it('should execute "eth_getTransactionReceipt"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionReceipt',
            'params': [mirrorContractDetails.hash]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        const transactionResult = res.data.result;
        expect(transactionResult.transactionHash).to.be.equal(mirrorContractDetails.hash.slice(0, 66));
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "eth_getBalance" for primary account', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBalance',
            'params': [mirrorPrimaryAccount.evm_address, 'latest']
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('0x');
    });

    it('should execute "eth_getBalance" for secondary account', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBalance',
            'params': [mirrorSecondaryAccount.evm_address, 'latest']
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('0x');
    });

    it('should execute "eth_getTransactionCount"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionCount',
            'params': [mirrorPrimaryAccount.evm_address, 'latest']
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('');
    });

    it('should execute "eth_getBlockTransactionCountByHash"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBlockTransactionCountByHash',
            'params': [mirrorBlock.hash]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getBlockTransactionCountByNumber"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBlockTransactionCountByNumber',
            'params': [mirrorBlock.number]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal(mirrorBlock.count);
    });

    it('should execute "eth_getTransactionByBlockHashAndIndex"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionByBlockHashAndIndex',
            'params': [mirrorContractDetails.block_hash, mirrorContractDetails.transaction_index]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "eth_getTransactionByBlockNumberAndIndex"', async function () {
        const res = await this.relayClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionByBlockNumberAndIndex',
            'params': [mirrorContractDetails.block_number, mirrorContractDetails.transaction_index]
        });

        expect(res).to.have.property('data');
        console.log(`*** res: ${JSON.stringify(res.data)}`);
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        const transactionResult = res.data.result;
        expect(transactionResult.blockHash).to.be.equal(mirrorContractDetails.block_hash.slice(0, 66));
        expect(transactionResult.blockNumber).to.be.equal(numberTo0x(mirrorContractDetails.block_number));
    });

    it('should execute "net_listening"', async function () {
        const res = callRelay(this.relayClient, 'net_listening', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "net_version"', async function () {
        const res = callRelay(this.relayClient, 'net_version', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_estimateGas"', async function () {
        const res = callRelay(this.relayClient, 'eth_estimateGas', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_gasPrice"', async function () {
        const res = callRelay(this.relayClient, 'eth_gasPrice', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_getUncleByBlockHashAndIndex"', async function () {
        const res = callRelay(this.relayClient, 'eth_getUncleByBlockHashAndIndex', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_getUncleByBlockNumberAndIndex"', async function () {
        const res = callRelay(this.relayClient, 'eth_getUncleByBlockNumberAndIndex', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_getUncleCountByBlockHash"', async function () {
        const res = callRelay(this.relayClient, 'eth_getUncleCountByBlockHash', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_getUncleCountByBlockNumber"', async function () {
        const res = callRelay(this.relayClient, 'eth_getUncleCountByBlockNumber', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_getWork"', async function () {
        const res = callRelay(this.relayClient, 'eth_getWork', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_hashrate"', async function () {
        const res = callRelay(this.relayClient, 'eth_hashrate', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_mining"', async function () {
        const res = callRelay(this.relayClient, 'eth_mining', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_submitWork"', async function () {
        const res = callRelay(this.relayClient, 'eth_submitWork', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_syncing"', async function () {
        const res = callRelay(this.relayClient, 'eth_syncing', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "web3_client_version"', async function () {
        const res = callRelay(this.relayClient, 'web3_client_version', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "web3_client_version"', async function () {
        const res = callRelay(this.relayClient, 'web3_client_version', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    it('should execute "eth_protocolVersion"', async function () {
        const res = callRelay(this.relayClient, 'eth_protocolVersion', []);

        console.log(`*** res: ${JSON.stringify(res)}`);
        expect(res).to.not.be.null;
    });

    const callMirrorNode = (mirrorNodeClient: AxiosInstance, path: string) => {
        console.log(`[GET] mirrornode ${path} endpoint`);
        return mirrorNodeClient.get(path);
    };

    const callRelay = (client: any, methodName: string, params: any[]) => {
        return client.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': methodName,
            'params': params
        });
    };

    const setupClient = () => {
        opPrivateKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
        client = Client
            .forNetwork({
                '127.0.0.1:50211': '0.0.3'
            })
            .setOperator(AccountId.fromString(process.env.OPERATOR_ID), opPrivateKey);
    };

    const createEthCompatibleAccount = async () => {
        const privateKey = PrivateKey.generateECDSA();
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        console.log(`New Eth compatible account ID: ${aliasAccountId.toString()}`);
        const aliasCreationResponse = await new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(100).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(100))
            .execute(client);

        console.log(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse.getReceipt(client);

        const balance = await new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId)
            .execute(client);

        console.log(`Balances of the new account: ${balance.toString()}`);

        const accountInfo = await new AccountInfoQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId)
            .execute(client);

        console.log(`New account Info: ${accountInfo.accountId.toString()}`);
        return { accountInfo, privateKey };
    };

    const createToken = async () => {
        const symbol = Math.random().toString(36).slice(2, 6); //crypto.randomBytes(2).toString('hex').toUpperCase();
        console.log(`symbol = ${symbol}`);
        const resp = await new TokenCreateTransaction()
            .setTokenName("relay-1")
            .setTokenSymbol("RL")
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(client.operatorAccountId)
            .execute(client);

        console.log(`get token id from receipt`);
        tokenId = (await resp.getReceipt(client)).tokenId;
        console.log(`token id = ${tokenId.toString()}`);
    };

    const associateAndTransferToken = async (accountId: AccountId, pk: PrivateKey) => {
        console.log(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await (
            await (
                await new TokenAssociateTransaction()
                    .setAccountId(accountId)
                    .setTokenIds([tokenId])
                    .freezeWith(client)
                    .sign(pk)
            ).execute(client)
        ).getReceipt(client);

        console.log(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        await (
            await new TransferTransaction()
                .addTokenTransfer(tokenId, client.operatorAccountId, -10)
                .addTokenTransfer(tokenId, accountId, 10)
                .execute(client)
        ).getReceipt(client);

        console.log(
            `Sent 10 tokens from account ${client.operatorAccountId.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await new AccountBalanceQuery()
            .setAccountId(accountId)
            .execute(client);

        console.log(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    const sendFileClosingCryptoTransfer = async (accountId: AccountId) => {
        const aliasCreationResponse = await new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar))
            .execute(client);

        await aliasCreationResponse.getReceipt(client);

        const balance = await new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(accountId)
            .execute(client);

        console.log(`Balances of the new account: ${balance.toString()}`);
    };

    const createParentContract = async () => {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileTransactionResponse = await new FileCreateTransaction()
            .setKeys([client.operatorPublicKey])
            .setContents(contractByteCode)
            .execute(client);

        // Fetch the receipt for transaction that created the file
        const fileReceipt = await fileTransactionResponse.getReceipt(client);

        // The file ID is located on the transaction receipt
        const fileId = fileReceipt.fileId;
        console.log(`contract bytecode file: ${fileId.toString()}`);

        // Create the contract
        const contractTransactionResponse = await new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setBytecodeFileId(fileId)
            .setAdminKey(client.operatorPublicKey)
            .execute(client);

        // Fetch the receipt for the transaction that created the contract
        const contractReceipt = await contractTransactionResponse.getReceipt(
            client
        );

        // The conract ID is located on the transaction receipt
        contractId = contractReceipt.contractId;

        console.log(`new contract ID: ${contractId.toString()}`);
    };

    const executeContractCall = async () => {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        const contractExecTransactionResponse =
            await new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    "createChild",
                    new ContractFunctionParameters()
                        .addUint256(1000)
                )
                .execute(client);

        const record = await contractExecTransactionResponse.getRecord(client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        contractExecuteTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart.nanos.toString();
        contractExecutedTransactionId = `${transactionId.accountId}@${transactionIdNanoString.padStart(9, '0')}`;
    };

    const numberTo0x = (input: number): string => {
        return `0x${input.toString(16)}`;
    };
});