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


import {expect} from "chai";
import {
    AccountBalanceQuery,
    AccountId,
    AccountInfoQuery,
    Client,
    ContractCreateTransaction,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    FileCreateTransaction,
    Hbar,
    HbarUnit,
    PrivateKey,
    Query,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Transaction,
    TransactionResponse,
    TransferTransaction
} from "@hashgraph/sdk";
import {Logger} from "pino";
import {AxiosInstance} from "axios";
import {ethers} from "ethers";
import type { TransactionRequest } from "@ethersproject/abstract-provider";

export default class TestUtils {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    numberTo0x = (input: number): string => {
        return `0x${this.toHex(input)}`;
    };

    prune0x = (input: string): string => {
        return input.startsWith('0x') ? input.substring(2) : input;
    };

    toHex = (num) => {
        return parseInt(num).toString(16);
    };

    idToEvmAddress = (id): string => {
        const [shard, realm, num] = id.split('.');
        expect(shard).to.not.be.null;
        expect(realm).to.not.be.null;
        expect(num).to.not.be.null;

        return [
            '0x',
            this.toHex(shard).padStart(8, '0'),
            this.toHex(realm).padStart(16, '0'),
            this.toHex(num).padStart(16, '0'),
        ].join('');
    };

    executeQuery = async (query: Query<any>, client: Client) => {
        try {
            this.logger.info(`Execute ${query.constructor.name} query`);
            return query.execute(client);
        }
        catch (e) {
            this.logger.error(e, `Error executing ${query.constructor.name} query`);
        }
    };

    executeTransaction = async (transaction: Transaction, client: Client) => {
        try {
            this.logger.info(`Execute ${transaction.constructor.name} transaction`);
            const resp = await transaction.execute(client);
            this.logger.info(`Executed transaction ${resp.transactionId.toString()}`);
            return resp;
        }
        catch (e) {
            this.logger.error(e, `Error executing ${transaction.constructor.name} transaction`);
        }
    };

    executeAndGetTransactionReceipt = async (transaction: Transaction, client: Client) => {
        let resp;
        try {
            resp = await this.executeTransaction(transaction, client);
            return resp.getReceipt(client);
        }
        catch (e) {
            this.logger.error(e,
                `Error retrieving receipt for ${resp === undefined ? transaction.constructor.name : resp.transactionId.toString()} transaction`);
        }
    };

    getRecordResponseDetails = async (resp: TransactionResponse, client: Client) => {
        this.logger.info(`Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart.seconds}-${transactionIdNanoString.padStart(9, '0')}`;
        this.logger.info(`executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    callMirrorNode = (mirrorNodeClient: AxiosInstance, path: string) => {
        this.logger.debug(`[GET] mirrornode ${path} endpoint`);
        return mirrorNodeClient.get(path);
    };

    callSupportedRelayMethod = async (client: any, methodName: string, params: any[]) => {
        const resp = await this.callRelay(client, methodName, params);
        this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(resp.data.result)}`);

        expect(resp.data).to.have.property('result');
        expect(resp.data.id).to.be.equal('2');

        return resp;
    };

    callUnsupportedRelayMethod = async (client: any, methodName: string, params: any[]) => {
        const resp = await this.callRelay(client, methodName, params);
        this.logger.trace(`[POST] to relay '${methodName}' with params [${params}] returned ${JSON.stringify(resp.data.error)}`);

        expect(resp.data).to.have.property('error');
        expect(resp.data.error.code).to.be.equal(-32601);
        expect(resp.data.error.name).to.be.equal('Method not found');
        expect(resp.data.error.message).to.be.equal('Unsupported JSON-RPC method');

        return resp;
    };

    callRelay = async (client: any, methodName: string, params: any[]) => {
        this.logger.debug(`[POST] to relay '${methodName}' with params [${params}]`);
        const resp = await client.post('/', {
            'id': '2',
            'jsonrpc': '2.0',
            'method': methodName,
            'params': params
        });

        expect(resp).to.not.be.null;
        expect(resp).to.have.property('data');
        expect(resp.data).to.have.property('id');
        expect(resp.data).to.have.property('jsonrpc');
        expect(resp.data.jsonrpc).to.be.equal('2.0');

        return resp;
    };

    setupClient = (key, id) => {
        const opPrivateKey = PrivateKey.fromString(key);
        return Client
            .forNetwork({
                '127.0.0.1:50211': '0.0.3'
            })
            .setOperator(AccountId.fromString(id), opPrivateKey);
    };

    createEthCompatibleAccount = async (client: Client, privateKeyHex: string) => {
        const privateKey = PrivateKey.fromBytesECDSA(Buffer.from(privateKeyHex, 'hex'));
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        this.logger.trace(`New Eth compatible privateKey: ${privateKey}`);
        this.logger.trace(`New Eth compatible publicKey: ${publicKey}`);
        this.logger.debug(`New Eth compatible account ID: ${aliasAccountId.toString()}`);

        this.logger.info(`Transfer transaction attempt`);
        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(5000).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(5000)), client);

        this.logger.debug(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse.getReceipt(client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId), client);

        this.logger.info(`Balances of the new account: ${balance.toString()}`);

        const accountInfo = await this.executeQuery(new AccountInfoQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(aliasAccountId), client);

        this.logger.info(`New account Info: ${accountInfo.accountId.toString()}`);
        return { accountInfo, privateKey };
    };

    createToken = async (client: Client) => {
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.logger.trace(`symbol = ${symbol}`);
        const resp = await this.executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(client.operatorAccountId), client);

        this.logger.trace(`get token id from receipt`);
        const tokenId = resp.tokenId;
        this.logger.info(`token id = ${tokenId.toString()}`);
        return tokenId;
    };

    associateAndTransferToken = async (accountId: AccountId, pk: PrivateKey, tokenId, client) => {
        this.logger.info(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await this.executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(client)
                .sign(pk), client);

        this.logger.debug(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        this.executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, client.operatorAccountId, -10)
            .addTokenTransfer(tokenId, accountId, 10), client);

        this.logger.debug(
            `Sent 10 tokens from account ${client.operatorAccountId.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId), client);

        this.logger.debug(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    sendFileClosingCryptoTransfer = async (accountId: AccountId, client: Client) => {
        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(client.operatorAccountId, new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar)), client);

        await aliasCreationResponse.getReceipt(client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setNodeAccountIds([aliasCreationResponse.nodeId])
            .setAccountId(accountId), client);

        this.logger.info(`Balances of the new account: ${balance.toString()}`);
    };

    createParentContract = async (parentContract, client: Client) => {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileReceipt = await this.executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([client.operatorPublicKey])
            .setContents(contractByteCode), client);

        // Fetch the receipt for transaction that created the file
        // The file ID is located on the transaction receipt
        const fileId = fileReceipt.fileId;
        this.logger.info(`contract bytecode file: ${fileId.toString()}`);

        // Create the contract
        const contractReceipt = await this.executeAndGetTransactionReceipt(new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setInitialBalance(100)
            .setBytecodeFileId(fileId)
            .setAdminKey(client.operatorPublicKey), client);

        // Fetch the receipt for the transaction that created the contract

        // The conract ID is located on the transaction receipt
        const contractId = contractReceipt.contractId;

        this.logger.info(`new contract ID: ${contractId.toString()}`);

        return contractId;
    };

    executeContractCall = async (contractId, client: Client) => {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        this.logger.info(`Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await this.executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    "createChild",
                    new ContractFunctionParameters()
                        .addUint256(1000)
                ), client);

        const resp = await this.getRecordResponseDetails(contractExecTransactionResponse, client);
        const contractExecuteTimestamp = resp.executedTimestamp;
        const contractExecutedTransactionId = resp.executedTransactionId;

        return {contractExecuteTimestamp, contractExecutedTransactionId};
    };

    signRawTransaction = async (tx: TransactionRequest, privateKey) => {
        const provider = new ethers.providers.JsonRpcProvider('http://localhost:7546');
        const wallet = new ethers.Wallet(privateKey.toStringRaw(), provider);
        return await wallet.signTransaction(tx);
    };
}
