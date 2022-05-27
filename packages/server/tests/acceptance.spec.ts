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

import Axios from 'axios';
import { expect } from 'chai';
import path from 'path';
import dotenv from 'dotenv';
import shell from 'shelljs';
import crypto from 'crypto';

; import parentContract from './parentContract/Parent.json';

dotenv.config({ path: path.resolve(__dirname, './test.env') });
let client: Client;
let tokenId;
let opPrivateKey;
let contractId;

describe('RPC Server Integration Tests', async function () {
    this.timeout(180 * 1000);

    before(async function () {
        console.log('Setting up SDK Client for local instances');
        setupClient();

        const useLocalNode = process.env.LOCAL_NODE || 'true';
        if (useLocalNode === 'true') {
            // start local-node
            console.log('Start local node and genereate accounts');
            shell.exec('npx hedera-local start');
            shell.exec('npx hedera-local generate-accounts 0');

            // set up mirror node contents
            console.log('Submit eth account create transactions via crypto transfers');
            // 1. Crypto create with alias - metamask flow
            const { accountInfo: primaryAccountInfo, privateKey: primaryKey } = await createEthCompatibleAccount();
            const { accountInfo: secondaryAccountInfo, privateKey: secondaryKey } = await createEthCompatibleAccount();

            console.log('Create token');
            // 2. Token create
            await createToken();

            console.log('Associate and transfer tokens');
            // 3. associate and transfer 2 tokens
            await associateAndTransferToken(primaryAccountInfo.accountId, primaryKey);
            await associateAndTransferToken(secondaryAccountInfo.accountId, secondaryKey);

            console.log('Create and execute contracts');
            // 4. contract create amd execute
            // Take Parent contract used in mirror node acceptance tests since it's well use
            await createParentContract();
            await executeContractCall();

            console.log('Send file close crypto transfers');
            // 5. simple crypto trasnfer to ensure file close
            await sendFileClosingCryptoTransfer(primaryAccountInfo.accountId);
            await sendFileClosingCryptoTransfer(secondaryAccountInfo.accountId);
        }

        // start relay
        console.log(`Start relay on port ${process.env.E2E_SERVER_PORT}`);
        this.testServer = app.listen(process.env.E2E_SERVER_PORT);
        this.testClient = Axios.create({
            baseURL: 'http://localhost:' + process.env.E2E_SERVER_PORT,
            responseType: 'json' as const,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST',
            timeout: 5 * 1000
        });
    });

    after(function () {
        // stop local-node
        console.log('Shutdown local node');
        shell.exec('npx hedera-local stop');

        // stop relay
        console.log('Stop relay');
        if (this.testServer !== undefined) {
            this.testServer.close();
        }
    });

    it('should execute "eth_chainId"', async function () {
        console.log('Start should execute "eth_chainId');
        const res = await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_chainId',
            'params': [null]
        });

        expect(res).to.have.property('data');
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('0x12a');
    });

    it('should execute "eth_getBlockNumber', async function () {
        const res = await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBlockNumber',
            'params': [null]
        });

        expect(res).to.have.property('data');
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('');
    });

    it('should execute "eth_getBalance', async function () {
        const res = await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getBalance',
            'params': ['pubKey', 'latest']
        });

        expect(res).to.have.property('data');
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('0x0');
    });

    it('should execute "eth_getTransactionCount', async function () {
        const res = await this.testClient.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': 'eth_getTransactionCount',
            'params': ['hex encoded address', 'latest']
        });

        expect(res).to.have.property('data');
        expect(res.data).to.have.property('id');
        expect(res.data).to.have.property('jsonrpc');
        expect(res.data).to.have.property('result');
        expect(res.data.id).to.be.equal('2');
        expect(res.data.jsonrpc).to.be.equal('2.0');
        expect(res.data.result).to.be.equal('');
    });

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
        const symbol = crypto.randomBytes(2).toString('hex').toUpperCase();
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

        await contractExecTransactionResponse.getReceipt(client);
    };
});