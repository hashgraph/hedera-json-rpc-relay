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
    Key,
    PrivateKey,
    Query,
    TokenAssociateTransaction,
    TokenCreateTransaction,
    Transaction,
    TransactionResponse,
    TransferTransaction,
    ContractCreateFlow,
    FileUpdateTransaction,
    TransactionId,
    AccountAllowanceApproveTransaction,
    AccountBalance,
    FileContentsQuery
} from '@hashgraph/sdk';
import { Logger } from 'pino';
import { ethers } from 'ethers';
import { Utils } from '../helpers/utils';

const supportedEnvs = ['previewnet', 'testnet', 'mainnet'];

export default class ServicesClient {
    static TINYBAR_TO_WEIBAR_COEF = 10_000_000_000;

    private readonly DEFAULT_KEY = new Key();
    private readonly logger: Logger;
    private readonly network: string;

    public readonly client: Client;

    constructor(network: string, accountId: string, key: string, logger: Logger) {
        this.logger = logger;
        this.network = network;

        if (!network) network = '{}';
        const opPrivateKey = PrivateKey.fromString(key);
        if (supportedEnvs.includes(network.toLowerCase())) {
            this.client = Client.forName(network);
        } else {
            this.client = Client.forNetwork(JSON.parse(network));
        }
        this.client.setOperator(AccountId.fromString(accountId), opPrivateKey);
    }

    async executeQuery(query: Query<any>, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        try {
            this.logger.info(`${requestIdPrefix} Execute ${query.constructor.name} query`);
            return query.execute(this.client);
        } catch (e) {
            this.logger.error(e, `${requestIdPrefix} Error executing ${query.constructor.name} query`);
        }
    };

    async executeTransaction(transaction: Transaction, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        try {
            const resp = await transaction.execute(this.client);
            this.logger.info(`${requestIdPrefix} Executed transaction of type ${transaction.constructor.name}. TX ID: ${resp.transactionId.toString()}`);
            return resp;
        } catch (e) {
            this.logger.error(e, `${requestIdPrefix} Error executing ${transaction.constructor.name} transaction`);
        }
    };

    async executeAndGetTransactionReceipt(transaction: Transaction, requestId?: string) {
        const resp = await this.executeTransaction(transaction, requestId);
        return resp?.getReceipt(this.client);
    };

    async getRecordResponseDetails(resp: TransactionResponse, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        this.logger.info(`${requestIdPrefix} Retrieve record for ${resp.transactionId.toString()}`);
        const record = await resp.getRecord(this.client);
        const nanoString = record.consensusTimestamp.nanos.toString();
        const executedTimestamp = `${record.consensusTimestamp.seconds}.${nanoString.padStart(9, '0')}`;
        const transactionId = record.transactionId;
        const transactionIdNanoString = transactionId.validStart?.nanos.toString();
        const executedTransactionId = `${transactionId.accountId}-${transactionId.validStart?.seconds}-${transactionIdNanoString?.padStart(9, '0')}`;
        this.logger.info(`${requestIdPrefix} executedTimestamp: ${executedTimestamp}, executedTransactionId: ${executedTransactionId}`);
        return { executedTimestamp, executedTransactionId };
    };

    async createToken(initialSupply = 1000, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const symbol = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.logger.trace(`${requestIdPrefix} symbol = ${symbol}`);
        const resp = await this.executeAndGetTransactionReceipt(new TokenCreateTransaction()
            .setTokenName(`relay-acceptance token ${symbol}`)
            .setTokenSymbol(symbol)
            .setDecimals(3)
            .setInitialSupply(new Hbar(initialSupply).toTinybars())
            .setTreasuryAccountId(this._thisAccountId())
            .setTransactionMemo('Relay test token create'), requestId);

        this.logger.trace(`${requestIdPrefix} get token id from receipt`);
        const tokenId = resp?.tokenId;
        this.logger.info(`${requestIdPrefix} token id = ${tokenId?.toString()}`);
        return tokenId;
    };

    async associateToken(tokenId, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        await this.executeAndGetTransactionReceipt(
            await new TokenAssociateTransaction()
                .setAccountId(this._thisAccountId())
                .setTokenIds([tokenId])
                .setTransactionMemo('Relay test token association'), requestId);

        this.logger.debug(
            `${requestIdPrefix} Associated account ${this._thisAccountId()} with token ${tokenId.toString()}`
        );
    }

    async transferToken(tokenId, recipient: AccountId, amount = 10, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        await this.executeAndGetTransactionReceipt(new TransferTransaction()
            .addTokenTransfer(tokenId, this._thisAccountId(), -amount)
            .addTokenTransfer(tokenId, recipient, amount)
            .setTransactionMemo('Relay test token transfer'), requestId);

        this.logger.debug(
            `${requestIdPrefix} Sent 10 tokens from account ${this._thisAccountId()} to account ${recipient.toString()} on token ${tokenId.toString()}`
        );

        const balances = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(recipient), requestId);

        this.logger.debug(
            `${requestIdPrefix} Token balances for ${recipient.toString()} are ${balances.tokens
                .toString()
                .toString()}`
        );
    }

    async createParentContract(contractJson, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const contractByteCode = (contractJson.deployedBytecode.replace('0x', ''));

        const fileReceipt = await this.executeAndGetTransactionReceipt(new FileCreateTransaction()
            .setKeys([this.client.operatorPublicKey || this.DEFAULT_KEY])
            .setContents(contractByteCode)
            .setTransactionMemo('Relay test file create'), requestId);

        // Fetch the receipt for transaction that created the file
        // The file ID is located on the transaction receipt
        const fileId = fileReceipt?.fileId;
        this.logger.info(`${requestIdPrefix} contract bytecode file: ${fileId?.toString()}`);

        // Create the contract
        const contractReceipt = await this.executeAndGetTransactionReceipt(new ContractCreateTransaction()
            .setConstructorParameters(
                new ContractFunctionParameters()
            )
            .setGas(75000)
            .setInitialBalance(1)
            .setBytecodeFileId(fileId || '')
            .setAdminKey(this.client.operatorPublicKey || this.DEFAULT_KEY)
            .setTransactionMemo('Relay test contract create'), requestId);

        // The contract ID is located on the transaction receipt
        const contractId = contractReceipt?.contractId;

        this.logger.info(`${requestIdPrefix} new contract ID: ${contractId?.toString()}`);

        return contractId;
    };

    async executeContractCall(contractId, functionName: string, params: ContractFunctionParameters, gasLimit = 75000, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        // Call a method on a contract exists on Hedera, but is allowed to mutate the contract state
        this.logger.info(`${requestIdPrefix} Execute contracts ${contractId}'s createChild method`);
        const contractExecTransactionResponse =
            await this.executeTransaction(new ContractExecuteTransaction()
                .setContractId(contractId)
                .setGas(gasLimit)
                .setFunction(
                    functionName,
                    params
                )
                .setTransactionMemo('Relay test contract execution'), requestId);

        // @ts-ignore
        const resp = await this.getRecordResponseDetails(contractExecTransactionResponse, requestId);
        const contractExecuteTimestamp = resp.executedTimestamp;
        const contractExecutedTransactionId = resp.executedTransactionId;

        return { contractExecuteTimestamp, contractExecutedTransactionId };
    };

    async createAliasAccount(initialBalance = 10, provider = null, requestId?: string): Promise<AliasAccount> {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const privateKey = PrivateKey.generateECDSA();
        const publicKey = privateKey.publicKey;
        const aliasAccountId = publicKey.toAccountId(0, 0);

        this.logger.trace(`${requestIdPrefix} Create new Eth compatible account w privateKey: ${privateKey}, alias: ${aliasAccountId.toString()} and balance ~${initialBalance} hb`);

        const aliasCreationResponse = await this.executeTransaction(new TransferTransaction()
            .addHbarTransfer(this._thisAccountId(), new Hbar(initialBalance).negated())
            .addHbarTransfer(aliasAccountId, new Hbar(initialBalance))
            .setTransactionMemo('Relay test crypto transfer'), requestId);

        this.logger.debug(`${requestIdPrefix} Get ${aliasAccountId.toString()} receipt`);
        await aliasCreationResponse?.getReceipt(this.client);

        const balance = await this.executeQuery(new AccountBalanceQuery()
            .setAccountId(aliasAccountId), requestId);
        this.logger.info(`${requestIdPrefix} Balance of the new account: ${balance.toString()}`);

        const accountInfo = await this.executeQuery(new AccountInfoQuery()
            .setAccountId(aliasAccountId), requestId);
        this.logger.info(`${requestIdPrefix} New account Info - accountId: ${accountInfo.accountId.toString()}, evmAddress: ${accountInfo.contractAccountId}`);
        const servicesClient = new ServicesClient(
            this.network,
            accountInfo.accountId.toString(),
            privateKey.toString(),
            this.logger.child({ name: `services-client` })
        );

        let wallet;
        if (provider) {
            wallet = new ethers.Wallet(privateKey.toStringRaw(), provider);
        }
        else {
            wallet = new ethers.Wallet(privateKey.toStringRaw());
        }

        return new AliasAccount(
            aliasAccountId,
            accountInfo.accountId,
            accountInfo.contractAccountId,
            servicesClient,
            privateKey,
            wallet
        );
    };

    async deployContract(contract, gas = 100_000, constructorParameters:Uint8Array = new Uint8Array(), initialBalance = 0) {
        const contractCreate = await (new ContractCreateFlow()
            .setGas(gas)
            .setBytecode(contract.bytecode)
            .setConstructorParameters(constructorParameters)
            .setInitialBalance(initialBalance)
            .execute(this.client));
        return contractCreate.getReceipt(this.client);
    };

    _thisAccountId() {
        return this.client.operatorAccountId || AccountId.fromString('0.0.0');
    }

    async getOperatorBalance(): Promise<Hbar> {
        const accountBalance = await (new AccountBalanceQuery()
            .setAccountId(this.client.operatorAccountId!))
            .execute(this.client);
        return accountBalance.hbars;
    }

    async getFileContent(fileId: string): Promise<any> {
        const query = new FileContentsQuery()
            .setFileId(fileId);

        return await query.execute(this.client);
    }

    async updateFileContent(fileId: string, content: string, requestId?: string): Promise<void> {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const response = await new FileUpdateTransaction()
            .setFileId(fileId)
            .setContents(Buffer.from(content, 'hex'))
            .setTransactionMemo('Relay test update')
            .execute(this.client);

        const receipt = await response.getReceipt(this.client);
        this.logger.info(`${requestIdPrefix} File ${fileId} updated with status: ${receipt.status.toString()}`);
    }

    async getAccountBalance(account: string | AccountId, requestId?: string): Promise<AccountBalance> {
        const accountId = typeof account === "string" ? AccountId.fromString(account) : account;
        return this.executeQuery(new AccountBalanceQuery()
            .setAccountId(accountId), requestId);
    }

    async getAccountBalanceInWeiBars(account: string | AccountId, requestId?: string) {
        const balance = await this.getAccountBalance(account, requestId);

        return ethers.BigNumber.from(balance.hbars.toTinybars().toString()).mul(ServicesClient.TINYBAR_TO_WEIBAR_COEF);
    }

    async createHTS( args = {
        tokenName: 'Default Name',
        symbol: 'HTS',
        treasuryAccountId: '0.0.2',
        initialSupply: 5000,
        adminPrivateKey: this.DEFAULT_KEY,
    }) {
        const {} = args;

        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30);

        let network = this.network;
        try {
            network = JSON.parse(this.network);
        }
        catch(e) {
            // network config is a string and not a valid JSON
        }

        const htsClient = Client.forNetwork(network);
        htsClient.setOperator(AccountId.fromString(args.treasuryAccountId), args.adminPrivateKey);

        const tokenCreate = await (await new TokenCreateTransaction()
            .setTokenName(args.tokenName)
            .setTokenSymbol(args.symbol)
            .setExpirationTime(expiration)
            .setDecimals(18)
            .setTreasuryAccountId(AccountId.fromString(args.treasuryAccountId))
            .setInitialSupply(args.initialSupply)
            .setTransactionId(TransactionId.generate(AccountId.fromString(args.treasuryAccountId)))
            .setNodeAccountIds([htsClient._network.getNodeAccountIdsForExecute()[0]]))
            .execute(htsClient);

        const receipt = await tokenCreate.getReceipt(this.client);
        return {
            client: htsClient,
            receipt
        };
    }

    async associateHTSToken(accountId, tokenId, privateKey, htsClient, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const tokenAssociate = await (await new TokenAssociateTransaction()
            .setAccountId(accountId)
            .setTokenIds([tokenId])
            .freezeWith(htsClient)
            .sign(privateKey))
            .execute(htsClient);

        await tokenAssociate.getReceipt(htsClient);
        this.logger.info(`${requestIdPrefix} HTS Token ${tokenId} associated to : ${accountId}`);
    };

    async approveHTSToken(spenderId, tokenId, htsClient, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        const amount = 10000;
        const tokenApprove = await (new AccountAllowanceApproveTransaction()
            .addTokenAllowance(tokenId, spenderId, amount))
            .execute(htsClient);

        await tokenApprove.getReceipt(htsClient);
        this.logger.info(`${requestIdPrefix} ${amount} of HTS Token ${tokenId} can be spent by ${spenderId}`);
    };

    async transferHTSToken(accountId, tokenId, amount, fromId = this.client.operatorAccountId, requestId?: string) {
        const requestIdPrefix = Utils.formatRequestIdMessage(requestId);
        try {
            const tokenTransfer = await (await new TransferTransaction()
                .addTokenTransfer(tokenId, fromId, -amount)
                .addTokenTransfer(tokenId, accountId, amount))
                .execute(this.client);

            const rec = await tokenTransfer.getReceipt(this.client);
            this.logger.info(`${requestIdPrefix} ${amount} of HTS Token ${tokenId} can be spent by ${accountId}`);
            this.logger.debug(`${requestIdPrefix} ${rec}`);
        }
        catch(e) {
            this.logger.error(e, `${requestIdPrefix} TransferTransaction failed`);
        }
    };

}

export class AliasAccount {

    public readonly alias: AccountId;
    public readonly accountId: AccountId;
    public readonly address: string;
    public readonly client: ServicesClient;
    public readonly privateKey: PrivateKey;
    public readonly wallet: ethers.Wallet;

    constructor(_alias, _accountId, _address, _client, _privateKey, _wallet) {
        this.alias = _alias;
        this.accountId = _accountId;
        this.address = _address;
        this.client = _client;
        this.privateKey = _privateKey;
        this.wallet = _wallet;
    }

}