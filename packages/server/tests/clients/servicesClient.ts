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
    Key,
    PrivateKey,
    Query,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Transaction,
    TransactionResponse,
    TransferTransaction
} from '@hashgraph/sdk';
import { Logger } from 'pino';

const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];

export default class ServicesClient {

    private readonly DEFAULT_KEY = new Key();

    public readonly client: Client;
    private readonly logger: Logger;

    constructor(network: string, accountId: string, key: string, logger: Logger) {
        this.logger = logger;

        if (!network) network = '{}';
        const opPrivateKey = PrivateKey.fromString(key);
        if (network.toLowerCase() in supportedEnvs) {
            this.client = Client.forName(network);
        } else {
            this.client = Client.forNetwork(JSON.parse(network));
        }
        this.client.setOperator(AccountId.fromString(accountId), opPrivateKey);
    }

    async executeQuery(query: Query<any>) {
        try {
            this.logger.info(`Execute ${query.constructor.name} query`);
            return query.execute(this.client);
        } catch (e) {
            this.logger.error(e, `Error executing ${query.constructor.name} query`);
        }
    };

    async executeTransaction(transaction: Transaction) {
        try {
            this.logger.info(`Execute ${transaction.constructor.name} transaction`);
            const resp = await transaction.execute(this.client);
            this.logger.info(`Executed transaction ${resp.transactionId.toString()}`);
            return resp;
        } catch (e) {
            this.logger.error(e, `Error executing ${transaction.constructor.name} transaction`);
        }
    };

    async executeAndGetTransactionReceipt(transaction: Transaction) {
        let resp;
        try {
            resp = await this.executeTransaction(transaction);
            return resp.getReceipt(this.client);
        } catch (e) {
            this.logger.error(e,
                `Error retrieving receipt for ${resp === undefined ? transaction.constructor.name : resp.transactionId.toString()} transaction`);
        }
    };

    async getRecordResponseDetails(resp: TransactionResponse) {
        this.logger.info(`Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(this.client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart?.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart?.seconds}-${transactionIdNanoString?.padStart(9, '0')}`;
        this.logger.info(`executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    async createToken() {
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.logger.trace(`symbol = ${symbol}`);
        const resp = await this.executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(1000)
            .setTreasuryAccountId(this.client.operatorAccountId || '0.0.0'));

        this.logger.trace(`get token id from receipt`);
        const tokenId = resp.tokenId;
        this.logger.info(`token id = ${tokenId.toString()}`);
        return tokenId;
    };

    async associateAndTransferToken(accountId: AccountId, pk: PrivateKey, tokenId) {
        this.logger.info(`Associate account ${accountId.toString()} with token ${tokenId.toString()}`);
        await this.executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(accountId)
                .setTokenIds([tokenId])
                .freezeWith(this.client)
                .sign(pk));

        this.logger.debug(
            `Associated account ${accountId.toString()} with token ${tokenId.toString()}`
        );

        await this.executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, this.client.operatorAccountId || '0.0.0', -10)
            .addTokenTransfer(tokenId, accountId, 10));

        this.logger.debug(
            `Sent 10 tokens from account ${this.client.operatorAccountId?.toString()} to account ${accountId.toString()} on token ${tokenId.toString()}`
        );

        const balances = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId));

        this.logger.debug(
            `Token balances for ${accountId.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    };

    async sendFileClosingCryptoTransfer(accountId: AccountId) {
        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(this.client.operatorAccountId || '0.0.0', new Hbar(1, HbarUnit.Millibar).negated())
            .addHbarTransfer(accountId, new Hbar(1, HbarUnit.Millibar)));

        await aliasCreationResponse?.getReceipt(this.client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId));

        this.logger.info(`Balances of the new account: ${balance.toString()}`);
    };

    async createParentContract(parentContract) {
        const contractByteCode = (parentContract.deployedBytecode.replace('0x', ''));

        const fileReceipt = await this.executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([this.client.operatorPublicKey || this.DEFAULT_KEY])
            .setContents(contractByteCode));

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
            .setAdminKey(this.client.operatorPublicKey || this.DEFAULT_KEY));

        // Fetch the receipt for the transaction that created the contract

        // The contract ID is located on the transaction receipt
        const contractId = contractReceipt.contractId;

        this.logger.info(`new contract ID: ${contractId.toString()}`);

        return contractId;
    };

    async executeContractCall(contractId) {
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        this.logger.info(`Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await this.executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(75000)
                .setFunction(
                    'createChild',
                    new ContractFunctionParameters()
                        .addUint256(1000)
                ));

        // @ts-ignore
        const resp = await this.getRecordResponseDetails(contractExecTransactionResponse);
        const contractExecuteTimestamp = resp.executedTimestamp;
        const contractExecutedTransactionId = resp.executedTransactionId;

        return { contractExecuteTimestamp, contractExecutedTransactionId };
    };

    async createAliasAccount(privateKeyHex: null | string, initialBalance = 5000) {
        const privateKey = privateKeyHex ?
            PrivateKey.fromBytesECDSA(Buffer.from(privateKeyHex, 'hex')) : PrivateKey.generateECDSA();
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        this.logger.trace(`New Eth compatible privateKey: ${privateKey}`);
        this.logger.trace(`New Eth compatible publicKey: ${publicKey}`);
        this.logger.debug(`New Eth compatible account ID: ${aliasAccountId.toString()}`);
        this.logger.info(`Transfer transaction attempt`);

        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(this.client.operatorAccountId || '0.0.0', new Hbar(initialBalance).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(initialBalance)));

        this.logger.debug(`Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse?.getReceipt(this.client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(aliasAccountId));
        this.logger.info(`Balance of the new account: ${balance.toString()}`);

        const accountInfo = await this.executeQuery(new AccountInfoQuery()
            .setAccountId(aliasAccountId));
        this.logger.info(`New account Info: ${accountInfo.accountId.toString()}`);

        return {
            accountInfo,
            privateKey,
            utils: new TestUtils({
                mirrorNodeClient: this.mirrorNodeClient,
                provider: this.provider,
                services: {
                    network: this.servicesNetwork,
                    key: privateKey.toString(),
                    accountId: accountInfo.accountId.toString()
                }
            })
        };
    };

}

